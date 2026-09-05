import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  writeFile,
  cp,
  rm,
  stat,
  readdir,
  mkdir,
  chmod,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, delimiter } from "node:path";
import { once } from "node:events";
import { createHash } from "node:crypto";

const project = resolve(import.meta.dirname, "..");
test("portable compiled Runtime through executable playwright-cli protocol fixture", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "portable-runtime-"));
  try {
    await cp(join(project, "runtime"), join(root, "runtime"), {
      recursive: true,
    });
    await cp(join(project, "scripts"), join(root, "scripts"), {
      recursive: true,
    });
    await cp(join(project, "tests"), join(root, "tests"), { recursive: true });
    await mkdir(join(root, "bin"));
    await cp(join(root, "tests/fake-process-list.mjs"), join(root, "bin/ps"));
    await chmod(join(root, "bin/ps"), 0o700);
    const manifestPath = join(root, "runtime/manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.config.browser.cliScript = join(
      root,
      "tests/fake-playwright-cli.mjs",
    );
    await writeFile(manifestPath, JSON.stringify(manifest));
    const statePath = join(root, "fixture-state.json");
    const fresh = () => ({
      account: "fixture-account",
      version: 1,
      title: "Forest",
      query: "SKU-42",
      field: "",
      editTitle: "",
      dialog: false,
      mutations: 0,
      uiChanges: 0,
      scenario: "normal",
      attached: false,
      calls: [],
    });
    const reset = async (scenario = "normal", attached = false) =>
      writeFile(statePath, JSON.stringify({ ...fresh(), scenario, attached }));
    const state = async () => JSON.parse(await readFile(statePath, "utf8"));
    const change = async (values: object) =>
      writeFile(statePath, JSON.stringify({ ...(await state()), ...values }));
    function run(...args: string[]) {
      const result = spawnSync(
        process.execPath,
        [join(root, "scripts/site-runtime.mjs"), ...args],
        {
          cwd: tmpdir(),
          encoding: "utf8",
          timeout: 15000,
          env: {
            ...process.env,
            SITE_FIXTURE_STATE: statePath,
            PATH: join(root, "bin") + delimiter + process.env.PATH,
          },
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.stdout.trim().split("\n").length, 1, result.stderr);
      return JSON.parse(result.stdout);
    }
    const plan = () =>
      run(
        "plan",
        "inventory.update-title",
        "--json",
        '{"sku":"SKU-42","title":"New Forest"}',
      );
    const execute = (p: any, approval = p.approvalHash) =>
      run("execute", "--plan", p.planId, "--approve", approval);
    await t.test(
      "list and describe work with no browser, dependencies or sources",
      async () => {
        await reset();
        assert.equal(await stat(join(root, "src")).catch(() => null), null);
        assert.equal(
          await stat(join(root, "node_modules")).catch(() => null),
          null,
        );
        assert.deepEqual(run("list").actions, [
          "inventory.find",
          "inventory.update-title",
        ]);
        assert.equal(
          run("describe", "inventory.find").input.sku.required,
          true,
        );
        assert.equal(run("describe", "browser.inspect").global, true);
        assert.deepEqual((await state()).calls, []);
      },
    );
    await t.test(
      "invalid inputs, unknown actions, raw mutation and mode escape fail before browser access",
      async () => {
        await reset();
        for (const args of [
          ["run", "inventory.find", "--json", "{}"],
          ["run", "inventory.find", "--json", '{"sku":3}'],
          [
            "run",
            "inventory.find",
            "--json",
            '{"sku":"x","selector":"button"}',
          ],
          ["click", "button"],
          ["run-code", "page=>page.click()"],
          ["run", "inventory.find", "--mode", "diagnostic"],
          ["inspect", "--mode", "builder"],
          ["list", "--bad"],
        ])
          assert.equal(run(...args).ok, false);
        assert.equal(run("run", "not.known").error, "UNKNOWN_ACTION");
        assert.equal(run("execute").error, "APPROVAL_REQUIRED");
        assert.deepEqual((await state()).calls, []);
      },
    );
    await t.test(
      "extension attaches once and exact named session is reused",
      async () => {
        await reset();
        assert.equal(run("status").pageState, "inventory");
        assert.equal(run("doctor").attached, true);
        const calls = (await state()).calls;
        assert.equal(
          calls.filter((a: string[]) => a[0] === "attach").length,
          1,
        );
        assert.ok(
          calls.some((a: string[]) => a.includes("--extension=chrome")),
        );
        assert.equal(
          calls
            .flat()
            .some((a: string) =>
              /^(open|close|--headless|--persistent)$/.test(a),
            ),
          false,
        );
      },
    );
    await t.test(
      "browser missing, attach failure, managed session and version mismatch are distinct",
      async () => {
        for (const [scenario, expected, attached] of [
          ["no-browser", "BROWSER_REQUIRED", false],
          ["attach-failed", "ATTACH_FAILED", false],
          ["managed", "ATTACH_FAILED", true],
          ["wrong-version", "CLI_PROTOCOL", false],
        ] as const) {
          await reset(scenario, attached);
          assert.equal(run("status").error, expected);
          if (scenario === "no-browser")
            assert.equal(
              (await state()).calls.some((a: string[]) => a[0] === "attach"),
              false,
            );
          assert.equal(
            (await state()).calls.some((a: string[]) => a.includes("open")),
            false,
          );
        }
      },
    );
    await t.test(
      "explicit CDP uses only its configured attach transport",
      async () => {
        await reset();
        manifest.config.browser.attach = {
          mode: "cdp",
          target: "http://127.0.0.1:9222",
        };
        await writeFile(manifestPath, JSON.stringify(manifest));
        assert.equal(run("status").ok, true);
        assert.ok(
          (await state()).calls.some((a: string[]) =>
            a.includes("--cdp=http://127.0.0.1:9222"),
          ),
        );
        manifest.config.browser.attach = {
          mode: "extension",
          target: "chrome",
        };
        await writeFile(manifestPath, JSON.stringify(manifest));
      },
    );
    await t.test(
      "compiled POM read, empty result, JSON parameters and next",
      async () => {
        await reset();
        const result = run(
          "run",
          "inventory.find",
          "--json",
          '{"sku":"SKU-42"}',
        );
        assert.deepEqual(result.data, { sku: "SKU-42", title: "Forest" });
        assert.equal(result.state, "inventory");
        assert.deepEqual(result.next, ["inventory.update-title"]);
        assert.equal(
          run(
            "run",
            "inventory.find",
            "--json",
            JSON.stringify({ sku: 'missing"; ${notCode}' }),
          ).data,
          null,
        );
        assert.equal((await state()).mutations, 0);
        assert.deepEqual(await readdir(join(root, ".local/run-code")), []);
      },
    );
    await t.test(
      "observe and diagnostic paths are compact, regional and non-mutating",
      async () => {
        await reset("normal", true);
        const before = await state();
        assert.ok(JSON.stringify(run("status")).length < 400);
        const inspect = run("inspect");
        assert.ok(inspect.headings.includes("Inventory fixture"));
        assert.equal(inspect.visibleData.inventory, "1 article");
        assert.equal(inspect.diagnostic, undefined);
        const region = run("inspect-region", "search-filters");
        assert.ok(region.headings.includes("Search filters"));
        assert.equal(JSON.stringify(region).includes("Forest"), false);
        assert.equal(run("inspect-region", "unknown").error, "UNKNOWN_REGION");
        assert.equal(run("run", "browser.inspect").ok, true);
        assert.ok(
          run("inspect", "--mode", "diagnostic").diagnostic.accessibility,
        );
        const shot = run("screenshot");
        assert.equal(shot.ok, true);
        assert.ok((await stat(shot.screenshot)).size > 0);
        const after = await state();
        assert.deepEqual({ ...after, calls: [] }, { ...before, calls: [] });
        assert.ok(JSON.stringify(inspect).length < 4096);
      },
    );
    await t.test(
      "missing/ambiguous locator and unknown UI state retain observation recovery",
      async () => {
        for (const [scenario, error] of [
          ["missing", "UI_DRIFT"],
          ["ambiguous", "AMBIGUOUS_SELECTOR"],
          ["unknown", "UNSUPPORTED_UI_STATE"],
        ]) {
          await reset(scenario);
          const result = run(
            "run",
            "inventory.find",
            "--json",
            '{"sku":"SKU-42"}',
          );
          assert.equal(result.error, error);
          assert.equal(run("inspect").ok, true);
        }
        await reset("outside");
        assert.equal(run("status").pageState, "outside-site");
        assert.equal(run("inspect").error, "UNSUPPORTED_UI_STATE");
      },
    );
    await t.test(
      "plan has no UI or business mutation; exact approval and persisted postcondition required",
      async () => {
        await reset();
        const p = plan();
        assert.equal(p.ok, true);
        assert.equal((await state()).uiChanges, 0);
        assert.equal((await state()).mutations, 0);
        assert.equal(execute(p, "0".repeat(64)).error, "APPROVAL_REQUIRED");
        const result = execute(p);
        assert.equal(result.ok, true);
        assert.deepEqual(result.data, { sku: "SKU-42", title: "New Forest" });
        assert.equal((await state()).version, 2);
        assert.equal(execute(p).error, "PLAN_USED");
      },
    );
    await t.test(
      "changed account/version/config and expired plans cannot execute",
      async () => {
        for (const changed of [{ account: "other-account" }, { version: 2 }]) {
          await reset();
          const p = plan();
          await change(changed);
          assert.equal(execute(p).error, "PLAN_CHANGED");
          assert.equal((await state()).mutations, 0);
        }
        await reset();
        let p = plan();
        manifest.config.version++;
        await writeFile(manifestPath, JSON.stringify(manifest));
        assert.equal(execute(p).error, "PLAN_CHANGED");
        const previousTtl = manifest.config.planTtlMs;
        manifest.config.planTtlMs = -1;
        await writeFile(manifestPath, JSON.stringify(manifest));
        p = plan();
        assert.equal(execute(p).error, "PLAN_EXPIRED");
        manifest.config.planTtlMs = previousTtl;
        await writeFile(manifestPath, JSON.stringify(manifest));
      },
    );
    await t.test(
      "uncertain commit and failed postcondition are never replayed",
      async () => {
        for (const scenario of ["lost-commit", "bad-postcondition"]) {
          await reset();
          const p = plan();
          await change({ scenario });
          assert.equal(execute(p).error, "UNKNOWN_COMMIT");
          assert.equal((await state()).mutations, 1);
          assert.equal(execute(p).error, "PLAN_USED");
          assert.equal((await state()).mutations, 1);
          assert.equal(
            run("run", "inventory.find", "--json", '{"sku":"SKU-42"}').ok,
            true,
          );
        }
      },
    );
    await t.test(
      "tampered precompiled artifact fails before transport; malformed CLI response fails closed",
      async () => {
        await reset();
        const path = join(root, "runtime", manifest.actions[0].bundle.file);
        const code = await readFile(path, "utf8");
        await writeFile(path, code + "\n//tampered");
        assert.equal(
          run("run", "inventory.find", "--json", '{"sku":"SKU-42"}').error,
          "BUILD_REQUIRED",
        );
        assert.deepEqual((await state()).calls, []);
        await writeFile(path, code);
        assert.equal(
          createHash("sha256").update(code).digest("hex"),
          manifest.actions[0].bundle.sha256,
        );
        await reset("malformed-response");
        assert.equal(run("status").error, "CLI_PROTOCOL");
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local fixture server script serves the demo HTML", async () => {
  const child = spawn(
    process.execPath,
    [join(project, "scripts/fixture-server.mjs"), "0"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const failures: string[] = [];
  child.stderr.on("data", (chunk) => failures.push(String(chunk)));
  try {
    const line = await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw new Error(failures.join(""));
      }),
    ]);
    const port = JSON.parse(String(line[0])).port;
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /data-testid="inventory"/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/missing`)).status, 404);
  } finally {
    child.kill("SIGTERM");
  }
});
