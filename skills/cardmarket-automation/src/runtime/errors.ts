export type ErrorCode = 'INVALID_INPUT' | 'UNKNOWN_ACTION' | 'AUTH_REQUIRED' |
  'HUMAN_REQUIRED' | 'BROWSER_REQUIRED' | 'ATTACH_FAILED' | 'CLI_PROTOCOL' |
  'UI_DRIFT' | 'AMBIGUOUS_SELECTOR' | 'POSTCONDITION_FAILED' |
  'PLAN_CHANGED' | 'PLAN_EXPIRED' | 'APPROVAL_REQUIRED' | 'PLAN_USED' |
  'UNKNOWN_COMMIT' | 'BUSY' | 'TIMEOUT' | 'INTERNAL' | 'NOT_CONFIGURED' | 'BUILD_ERROR' |
  'WRONG_STATE' | 'UNKNOWN_STATE' | 'STALE_CONTEXT' | 'FILTER_MISMATCH' |
  'SESSION_MISMATCH' | 'CONSENT_REQUIRED' | 'SESSION_QUARANTINED' | 'OUTPUT_LIMIT' |
  'BUILD_INVALID' | 'NOT_VERIFIED';
export type ErrorContext = Readonly<{
  /** Last observed state when the transport could report one. */
  state?: string;
  page?: string;
  component?: string;
  operation?: string;
  expected?: unknown;
  actual?: unknown;
  cause?: string;
  recovery?: Readonly<{ disposition: string; owner: 'operator' | 'user' | 'builder'; command?: string; prerequisite?: string }>;
}>;
const messages: Record<ErrorCode, string> = {
  INVALID_INPUT: 'Invalid input. Read the action contract; check required fields, types and limits.',
  UNKNOWN_ACTION: 'Unknown or unsupported action. Use list/describe; do not improvise.',
  AUTH_REQUIRED: 'The already-open browser is not authenticated as the required account. Let the user log in there, then retry.',
  HUMAN_REQUIRED: 'Manual user interaction is required in the already-open browser. Do not bypass this state.',
  BROWSER_REQUIRED: 'The configured browser must already be open. Do not launch a replacement browser.',
  ATTACH_FAILED: 'Could not attach playwright-cli to the configured open browser/session. Check the browser, extension/CDP setup and session.',
  CLI_PROTOCOL: 'playwright-cli returned an unexpected result. Stop instead of guessing or falling back to raw browser commands.',
  UI_DRIFT: 'The observed UI no longer matches the documented flow. Stop and repair the POM.',
  AMBIGUOUS_SELECTOR: 'The target locator matches more than one element. Stop; do not pick the first.',
  POSTCONDITION_FAILED: 'The action result or expected business state could not be verified.',
  PLAN_CHANGED: 'Account, target, state, input or implementation changed. Review a new plan.',
  PLAN_EXPIRED: 'The plan expired. Create and review a new plan.',
  APPROVAL_REQUIRED: 'The exact stored plan and its approval hash are required.',
  PLAN_USED: 'This plan has already been attempted. Check the business state before doing anything else.',
  UNKNOWN_COMMIT: 'A write may have happened. Do not retry; verify the business state with a read action.',
  BUSY: 'This project already has a runtime lock. Check the running process; do not blindly remove it.',
  TIMEOUT: 'The bounded operation timed out. Inspect the state; do not blindly retry writes.',
  INTERNAL: 'The operation failed. Inspect local diagnostics without exposing secrets.',
  NOT_CONFIGURED: 'Website implementation and verification are not complete.',
  BUILD_ERROR: 'The bundled action or SitePage imports a Node builtin, which the browser run-code runtime cannot load (require is not defined). Keep runtime code require-free: expose modulePath via import.meta.url and let the CLI runtime resolve the path.',
  WRONG_STATE: 'The action is not legal in the observed Cardmarket state. Observe status and use one of the supplied actions.',
  UNKNOWN_STATE: 'The page does not match a verified Cardmarket surface. Stop; do not guess a route or selector.',
  STALE_CONTEXT: 'The previously observed target or collection changed. Observe the current page and resolve the target again.',
  FILTER_MISMATCH: 'The requested seller or stock filter was not verified after submission. Do not report or compare those prices.',
  SESSION_MISMATCH: 'The configured playwright-cli session or tab is not the exact attached browser context. Stop and inspect the session.',
  CONSENT_REQUIRED: 'A consent or cookie decision is blocking the page. The user must handle it in the already-open browser.',
  SESSION_QUARANTINED: 'A previous write has unresolved commit state. Reconcile that attempt before any new account write.',
  OUTPUT_LIMIT: 'The bounded result did not fit the output limit. Use the supplied continuation or smaller read.',
  BUILD_INVALID: 'The compiled action artifact or manifest is invalid. Repair and rebuild the skill before running it.',
  NOT_VERIFIED: 'This action lacks the required fixture or live evidence and is disabled.'
};
export class AutomationError extends Error {
  readonly code: ErrorCode;
  readonly step?: string;
  readonly context?: ErrorContext;
  constructor(code: ErrorCode, step?: string, context?: ErrorContext) {
    super(messages[code]); this.name = 'AutomationError'; this.code = code; this.step = step; this.context = context;
  }
}
export function normalizeError(error: unknown): AutomationError {
  if (error instanceof AutomationError) return error;
  if (error instanceof Error && /strict mode violation/i.test(error.message))
    return new AutomationError('AMBIGUOUS_SELECTOR');
  if (error instanceof Error && error.name === 'TimeoutError') return new AutomationError('TIMEOUT');
  return new AutomationError('INTERNAL');
}
export function exitCode(code: ErrorCode): number {
  if (['INVALID_INPUT','UNKNOWN_ACTION'].includes(code)) return 2;
  if (['AUTH_REQUIRED','HUMAN_REQUIRED','BROWSER_REQUIRED','ATTACH_FAILED','APPROVAL_REQUIRED'].includes(code)) return 3;
  if (['PLAN_USED','UNKNOWN_COMMIT'].includes(code)) return 5;
  return 4;
}

export function recoveryFor(code: ErrorCode): ErrorContext['recovery'] {
  if (['INVALID_INPUT', 'UNKNOWN_ACTION'].includes(code)) return { disposition: 'fix_input', owner: 'operator' };
  if (['WRONG_STATE', 'STALE_CONTEXT', 'UNKNOWN_STATE', 'SESSION_MISMATCH'].includes(code)) return { disposition: 'observe', owner: 'operator', command: 'npm --prefix <skill-root> run cli -- status' };
  if (['AUTH_REQUIRED', 'CONSENT_REQUIRED', 'HUMAN_REQUIRED'].includes(code)) return { disposition: 'user_action', owner: 'user', prerequisite: 'Handle the visible login, consent or challenge in the attached browser.' };
  if (['UI_DRIFT', 'AMBIGUOUS_SELECTOR', 'BUILD_ERROR', 'BUILD_INVALID', 'NOT_VERIFIED', 'NOT_CONFIGURED'].includes(code)) return { disposition: 'repair', owner: 'builder' };
  if (['PLAN_CHANGED', 'PLAN_EXPIRED'].includes(code)) return { disposition: 'replan', owner: 'operator' };
  if (['PLAN_USED', 'UNKNOWN_COMMIT', 'SESSION_QUARANTINED'].includes(code)) return { disposition: 'reconcile', owner: 'operator', prerequisite: 'Read the affected business state before any new write.' };
  if (code === 'FILTER_MISMATCH' || code === 'POSTCONDITION_FAILED') return { disposition: 'stop', owner: 'operator' };
  if (code === 'OUTPUT_LIMIT') return { disposition: 'retry_safe', owner: 'operator' };
  return { disposition: 'stop', owner: 'operator' };
}
