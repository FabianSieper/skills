import type { Page } from "playwright";
import type { Action, ExecuteGuard } from "./engine.ts";
import type { Input } from "./input.ts";
import { allowedURL } from "./guards.ts";

type Phase = "run" | "prepare" | "execute";
type SitePageConstructor = new (page: Page) => {
  assertReady(): Promise<{ accountKey: string }>;
  detectState?(): Promise<string>;
};

export interface InvocationOptions {
  phase: Phase;
  input: Input;
  guard?: ExecuteGuard;
  allowedOrigins: readonly string[];
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function checkOrigin(page: Page, allowedOrigins: readonly string[]): void {
  allowedURL(page.url(), allowedOrigins);
}

function errorPayload(error: unknown): object {
  const value = error as { code?: unknown; step?: unknown; hint?: unknown };
  const message = error instanceof Error ? error.message : "";
  const code =
    typeof value?.code === "string"
      ? value.code
      : /strict mode violation/i.test(message)
        ? "AMBIGUOUS_SELECTOR"
        : error instanceof Error && error.name === "TimeoutError"
          ? "TIMEOUT"
          : "INTERNAL";
  return {
    code,
    ...(typeof value?.step === "string" ? { step: value.step } : {}),
    ...(typeof value?.hint === "string" ? { hint: value.hint } : {}),
  };
}

export async function invokeAction(
  page: Page,
  action: Action,
  SitePage: SitePageConstructor,
  options: InvocationOptions,
): Promise<object> {
  try {
    checkOrigin(page, options.allowedOrigins);
    const ready = await new SitePage(page).assertReady();
    if (!ready?.accountKey)
      return { ok: false, error: { code: "AUTH_REQUIRED" } };
    if (options.guard && ready.accountKey !== options.guard.accountKey)
      return { ok: false, error: { code: "PLAN_CHANGED", step: "account" } };

    let value: unknown;
    if (options.phase === "run" && action.kind === "read") {
      value = await action.run(page, options.input);
    } else if (options.phase === "prepare" && action.kind === "write") {
      value = await action.prepare(page, options.input);
    } else if (
      options.phase === "execute" &&
      action.kind === "write" &&
      options.guard?.preview
    ) {
      const current = await action.prepare(page, options.input);
      if (!sameValue(current, options.guard.preview))
        return { ok: false, error: { code: "PLAN_CHANGED", step: "preview" } };
      if (
        options.guard.expiresAt !== undefined &&
        Date.now() >= options.guard.expiresAt
      )
        return { ok: false, error: { code: "PLAN_EXPIRED" } };
      value = await action.execute(page, options.input, options.guard.preview);
    } else {
      return { ok: false, error: { code: "INTERNAL", step: "action-kind" } };
    }

    checkOrigin(page, options.allowedOrigins);
    if (
      (await new SitePage(page).assertReady()).accountKey !== ready.accountKey
    )
      return { ok: false, error: { code: "PLAN_CHANGED", step: "account" } };
    if (options.phase !== "prepare") value = action.validateOutput(value);
    const state = (await new SitePage(page).detectState?.()) ?? "unknown";
    return { ok: true, accountKey: ready.accountKey, value, state };
  } catch (error) {
    return { ok: false, error: errorPayload(error) };
  }
}
