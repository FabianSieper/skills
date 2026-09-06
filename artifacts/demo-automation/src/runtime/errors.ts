export type ErrorCode =
  | "INVALID_INPUT"
  | "UNKNOWN_ACTION"
  | "AUTH_REQUIRED"
  | "HUMAN_REQUIRED"
  | "BROWSER_REQUIRED"
  | "ATTACH_FAILED"
  | "CLI_PROTOCOL"
  | "UI_DRIFT"
  | "UNSUPPORTED_UI_STATE"
  | "UNKNOWN_REGION"
  | "BUILD_REQUIRED"
  | "AMBIGUOUS_SELECTOR"
  | "POSTCONDITION_FAILED"
  | "PLAN_CHANGED"
  | "PLAN_EXPIRED"
  | "APPROVAL_REQUIRED"
  | "PLAN_USED"
  | "UNKNOWN_COMMIT"
  | "BUSY"
  | "TIMEOUT"
  | "INTERNAL"
  | "NOT_CONFIGURED";
const messages: Record<ErrorCode, string> = {
  UNSUPPORTED_UI_STATE:
    "Observe the current state; use a known recovery action or return to Builder/Repair mode.",
  UNKNOWN_REGION:
    "Use a registered region ID; diagnostic inspect can explain an unknown page.",
  BUILD_REQUIRED:
    "Precompiled runtime is missing, stale or damaged. Rebuild in Builder mode.",
  INVALID_INPUT:
    "Invalid input. Read the action contract; check required fields, types and limits.",
  UNKNOWN_ACTION:
    "Unknown or unsupported action. Use list/describe; do not improvise.",
  AUTH_REQUIRED:
    "The already-open browser is not authenticated as the required account. Let the user log in there, then retry.",
  HUMAN_REQUIRED:
    "Manual user interaction is required in the already-open browser. Do not bypass this state.",
  BROWSER_REQUIRED:
    "The configured browser must already be open. Do not launch a replacement browser.",
  ATTACH_FAILED:
    "Could not attach playwright-cli to the configured open browser/session. Check the browser, extension/CDP setup and session.",
  CLI_PROTOCOL:
    "playwright-cli returned an unexpected result. Stop instead of guessing or falling back to raw browser commands.",
  UI_DRIFT:
    "The observed UI no longer matches the documented flow. Stop and repair the POM.",
  AMBIGUOUS_SELECTOR:
    "The target locator matches more than one element. Stop; do not pick the first.",
  POSTCONDITION_FAILED:
    "The action result or expected business state could not be verified.",
  PLAN_CHANGED:
    "Account, target, state, input or implementation changed. Review a new plan.",
  PLAN_EXPIRED: "The plan expired. Create and review a new plan.",
  APPROVAL_REQUIRED:
    "The exact stored plan and its approval hash are required.",
  PLAN_USED:
    "This plan has already been attempted. Check the business state before doing anything else.",
  UNKNOWN_COMMIT:
    "A write may have happened. Do not retry; verify the business state with a read action.",
  BUSY: "This project already has a runtime lock. Check the running process; do not blindly remove it.",
  TIMEOUT:
    "The bounded operation timed out. Inspect the state; do not blindly retry writes.",
  INTERNAL:
    "The operation failed. Inspect local diagnostics without exposing secrets.",
  NOT_CONFIGURED: "Website implementation and verification are not complete.",
};
export class AutomationError extends Error {
  readonly code: ErrorCode;
  readonly step?: string;
  readonly hint?: string;
  constructor(code: ErrorCode, step?: string, hint?: string) {
    super(messages[code]);
    this.name = "AutomationError";
    this.code = code;
    this.step = step;
    this.hint = hint;
  }
}
export function normalizeError(error: unknown): AutomationError {
  if (error instanceof AutomationError) return error;
  if (error instanceof Error && /strict mode violation/i.test(error.message))
    return new AutomationError("AMBIGUOUS_SELECTOR");
  if (error instanceof Error && error.name === "TimeoutError")
    return new AutomationError("TIMEOUT");
  return new AutomationError("INTERNAL");
}
export function exitCode(code: ErrorCode): number {
  if (["INVALID_INPUT", "UNKNOWN_ACTION"].includes(code)) return 2;
  if (
    [
      "AUTH_REQUIRED",
      "HUMAN_REQUIRED",
      "BROWSER_REQUIRED",
      "ATTACH_FAILED",
      "APPROVAL_REQUIRED",
    ].includes(code)
  )
    return 3;
  if (["PLAN_USED", "UNKNOWN_COMMIT"].includes(code)) return 5;
  return 4;
}
export function recovery(
  code: ErrorCode,
):
  | "fix-input"
  | "user-action"
  | "repair"
  | "replan"
  | "inspect-state"
  | "none" {
  if (["INVALID_INPUT", "UNKNOWN_ACTION"].includes(code)) return "fix-input";
  if (
    [
      "AUTH_REQUIRED",
      "HUMAN_REQUIRED",
      "BROWSER_REQUIRED",
      "ATTACH_FAILED",
      "APPROVAL_REQUIRED",
    ].includes(code)
  )
    return "user-action";
  if (
    [
      "POSTCONDITION_FAILED",
      "CLI_PROTOCOL",
      "NOT_CONFIGURED",
      "BUILD_REQUIRED",
    ].includes(code)
  )
    return "repair";
  if (["PLAN_CHANGED", "PLAN_EXPIRED"].includes(code)) return "replan";
  if (
    [
      "UI_DRIFT",
      "AMBIGUOUS_SELECTOR",
      "UNSUPPORTED_UI_STATE",
      "UNKNOWN_REGION",
      "PLAN_USED",
      "UNKNOWN_COMMIT",
      "BUSY",
      "TIMEOUT",
      "INTERNAL",
    ].includes(code)
  )
    return "inspect-state";
  return "none";
}
