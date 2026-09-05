import { parseArgs } from "node:util";
import { readFile, stat, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  Engine,
  withLock,
  cleanupLocal,
  type RegisteredAction,
} from "./runtime/engine.ts";
import { CliBrowser } from "./runtime/cli-browser.ts";
import { digest, jsonValue, validateInput } from "./runtime/input.ts";
import {
  AutomationError,
  normalizeError,
  exitCode,
  recovery,
} from "./runtime/errors.ts";
import type { Manifest } from "./runtime/manifest.ts";
import type { ObserveRequest } from "./runtime/observation.ts";

process.umask(0o077);
// Both source (Builder only) and compiled scripts live one level below the skill root.
const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(project, ".local");
async function main(): Promise<object> {
  let manifest: Manifest;
  try {
    manifest = JSON.parse(
      await readFile(join(project, "runtime/manifest.json"), "utf8"),
    );
    if (
      manifest.format !== 1 ||
      !Array.isArray(manifest.actions) ||
      !manifest.config ||
      !manifest.observe
    )
      throw new Error();
  } catch {
    throw new AutomationError("BUILD_REQUIRED", "manifest");
  }
  const config = manifest.config;
  const browser = new CliBrowser(project, root, config);
  // Metadata only: domain implementations and their output validators live in precompiled bundles.
  const unavailable = async (): Promise<never> => {
    throw new AutomationError("BUILD_REQUIRED");
  };
  const registry = manifest.actions.map((a) => ({
    ...a,
    modulePath: a.bundle.file,
    parameters: a.input,
    postcondition: a.postconditions.join("; "),
    outputDescription: a.output.description,
    validateOutput: jsonValue,
    run: unavailable,
    prepare: unavailable,
    execute: unavailable,
  })) as RegisteredAction[];
  const engine = new Engine(
    root,
    { ...config, implementationHash: digest(manifest) },
    registry,
    (action, phase, input, guard) =>
      browser.domain(manifest, action.id, phase, input, guard),
  );
  let args: {
    values: {
      json?: string;
      input?: string;
      plan?: string;
      approve?: string;
      mode?: string;
    };
    positionals: string[];
  };
  try {
    args = parseArgs({
      options: {
        json: { type: "string" },
        input: { type: "string" },
        plan: { type: "string" },
        approve: { type: "string" },
        mode: { type: "string" },
      },
      strict: true,
      allowPositionals: true,
    });
  } catch {
    throw new AutomationError("INVALID_INPUT");
  }
  const [command, id, ...extra] = args.positionals;
  const mode = args.values.mode ?? "runtime";
  if (!["runtime", "diagnostic"].includes(mode))
    throw new AutomationError("INVALID_INPUT", "mode");
  function syntax(needsId: boolean, options: string[]): void {
    if (
      extra.length ||
      (needsId ? !id : !!id) ||
      Object.keys(args.values).some((k) => ![...options, "mode"].includes(k))
    )
      throw new AutomationError("INVALID_INPUT");
  }
  async function input(): Promise<unknown> {
    if (args.values.json !== undefined && args.values.input !== undefined)
      throw new AutomationError("INVALID_INPUT");
    try {
      let text = args.values.json ?? "{}";
      if (args.values.input) {
        const info = await stat(args.values.input);
        if (!info.isFile() || info.size > config.maxInputBytes)
          throw new Error();
        text = await readFile(args.values.input, "utf8");
      }
      if (Buffer.byteLength(text) > config.maxInputBytes) throw new Error();
      return JSON.parse(text);
    } catch {
      throw new AutomationError("INVALID_INPUT");
    }
  }
  const observeIDs = [
    "browser.status",
    "browser.inspect",
    "browser.inspectRegion",
    "browser.screenshot",
  ];
  async function observation(
    action: string,
    raw: unknown = {},
  ): Promise<object> {
    const input = validateInput(
      action === "browser.inspectRegion"
        ? {
            region: {
              type: "string",
              required: true,
              description: "Known region ID",
              min: 1,
              max: 80,
            },
          }
        : {},
      raw,
    );
    return withLock(root, async () => {
      const request: ObserveRequest = {
        action: action as ObserveRequest["action"],
        mode: mode as ObserveRequest["mode"],
        ...(input.region ? { region: input.region as string } : {}),
      };
      if (action === "browser.screenshot") {
        await mkdir(join(root, "screenshots"), {
          recursive: true,
          mode: 0o700,
        });
        request.screenshotPath = join(
          root,
          "screenshots",
          `${randomUUID()}.png`,
        );
      }
      return (await browser.invoke(manifest.observe.bundle, request))
        .value as object;
    });
  }
  switch (command) {
    case "list":
      syntax(false, []);
      return { actions: engine.list(), observe: observeIDs };
    case "describe": {
      syntax(true, []);
      if (observeIDs.includes(id!))
        return {
          id,
          kind: "observe",
          global: true,
          input:
            id === "browser.inspectRegion"
              ? { region: "string|required; registered region ID" }
              : {},
        };
      const action = manifest.actions.find((a) => a.id === id);
      if (!action) throw new AutomationError("UNKNOWN_ACTION");
      const { bundle: _, ...contract } = action;
      return contract;
    }
    case "status":
      syntax(false, []);
      return observation("browser.status");
    case "inspect":
      syntax(false, []);
      return observation("browser.inspect");
    case "inspect-region":
      syntax(true, []);
      return observation("browser.inspectRegion", { region: id });
    case "screenshot":
      syntax(false, []);
      return observation("browser.screenshot");
    case "doctor": {
      syntax(false, []);
      return {
        session: config.browser.session,
        version: config.browser.cliVersion,
        attached: true,
        browserLaunch: false,
        configured: config.configured,
        ...(await observation("browser.status")),
      };
    }
    case "cleanup":
      syntax(false, []);
      return withLock(root, () => cleanupLocal(root));
    case "run":
      syntax(true, ["json", "input"]);
      if (observeIDs.includes(id!)) return observation(id!, await input());
      if (mode !== "runtime")
        throw new AutomationError(
          "INVALID_INPUT",
          "diagnostic-is-observation-only",
        );
      return (await engine.run(id!, await input())) as object;
    case "plan":
      syntax(true, ["json", "input"]);
      if (mode !== "runtime")
        throw new AutomationError(
          "INVALID_INPUT",
          "diagnostic-is-observation-only",
        );
      return (await engine.plan(id!, await input())) as object;
    case "execute":
      syntax(false, ["plan", "approve"]);
      if (mode !== "runtime")
        throw new AutomationError(
          "INVALID_INPUT",
          "diagnostic-is-observation-only",
        );
      return (await engine.execute(
        args.values.plan ?? "",
        args.values.approve ?? "",
      )) as object;
    default:
      throw new AutomationError("INVALID_INPUT");
  }
}
main()
  .then((data) =>
    process.stdout.write(JSON.stringify({ ok: true, ...data }) + "\n"),
  )
  .catch((raw) => {
    const error = normalizeError(raw);
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: error.code,
        ...(error.step ? { step: error.step } : {}),
        recovery: recovery(error.code),
        ...(["PLAN_USED", "UNKNOWN_COMMIT"].includes(error.code)
          ? { mayHaveCommitted: true }
          : {}),
      }) + "\n",
    );
    process.exitCode = exitCode(error.code);
  });
