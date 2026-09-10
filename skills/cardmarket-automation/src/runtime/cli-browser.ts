import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { config } from '../../site.config.ts';
import { AutomationError, type ErrorCode, type ErrorContext } from './errors.ts';
import type { Action, Preview } from './engine.ts';
import type { Input, Json } from './input.ts';
import { actionContract } from './contracts.ts';
import { isStateId, type StateId } from '../types.ts';

const execFileAsync = promisify(execFile);

type Phase = 'run' | 'prepare' | 'execute';
export interface BrowserResult { accountKey: string; value: Json; state?: StateId }

function cliArgs(...args: string[]): string[] { return args; }

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

export type TabInfo = {index: number; url: string; title: string};

/**
 * Session and tab-group state of the shared relay, observed by the CLI itself.
 * This is the single source of truth for the operator: never inspect the
 * browser or its tab groups manually.
 */
export interface BrowserState {
  session: string;
  /** Session exists in `playwright-cli list` (daemon socket alive). */
  attached: boolean;
  /** Relay answered `tab-list` (extension + browser reachable). */
  live: boolean;
  /** Session was listed but its relay was dead. */
  stale: boolean;
  waiting: boolean;
  /** Controlled tab group (index/url/title), latest observation. */
  tabs: TabInfo[];
  /** The one tab the transport maintains for this invocation, if any. */
  workTab: TabInfo | null;
  /** Tab group changed between the pre- and post-action observation. */
  drifted: boolean;
}

let current: BrowserState | null = null;
export function currentBrowserState(): BrowserState | null { return current; }

let stateRoot: string | null = null;
export function setBrowserStateRoot(root: string): void { stateRoot = resolve(root); }

type AttachMemo = { at: number; outcome: 'timeout' | 'success' };
const ATTACH_RECENT_MS = 10 * 60_000;
function attachMemoPath(): string | null { return stateRoot ? join(stateRoot, 'attach-memo.json') : null; }
async function readAttachMemo(): Promise<AttachMemo | null> {
  const path = attachMemoPath();
  if (!path) return null;
  try {
    const data = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (!data || typeof data !== 'object') return null;
    const memo = data as Record<string, unknown>;
    if (typeof memo.at !== 'number' || (memo.outcome !== 'timeout' && memo.outcome !== 'success')) return null;
    if (Date.now() - memo.at > ATTACH_RECENT_MS) return null;
    return { at: memo.at, outcome: memo.outcome };
  } catch { return null; }
}
async function writeAttachMemo(outcome: AttachMemo['outcome']): Promise<void> {
  const path = attachMemoPath();
  if (!path || !stateRoot) return;
  await mkdir(stateRoot, { recursive: true, mode: 0o700 }).catch(() => {});
  await writeFile(path, JSON.stringify({ at: Date.now(), outcome }), { mode: 0o600 }).catch(() => {});
}
async function clearAttachMemo(): Promise<void> {
  const path = attachMemoPath();
  if (!path) return;
  await unlink(path).catch(() => {});
}

export function parseTabList(stdout: string): TabInfo[] {
  const trimmed = stdout.trim();
  if (trimmed.startsWith('[')) {
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); }
    catch { throw new AutomationError('CLI_PROTOCOL', 'tab-list'); }
    if (!Array.isArray(parsed)) throw new AutomationError('CLI_PROTOCOL', 'tab-list');
    return (parsed as Array<Record<string, unknown>>).map((t, i) => ({
      index: typeof t.index === 'number' ? t.index : i,
      url: typeof t.url === 'string' ? t.url : '',
      title: typeof t.title === 'string' ? t.title : ''
    }));
  }
  let text = trimmed;
  if (trimmed.startsWith('{')) {
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); }
    catch { throw new AutomationError('CLI_PROTOCOL', 'tab-list'); }
    const result = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).result : undefined;
    if (typeof result !== 'string') throw new AutomationError('CLI_PROTOCOL', 'tab-list');
    text = result;
  }
  const tabs: TabInfo[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^- (\d+):(?: \(current\))? \[([^\]]*)\]\(([^)]*)\)/);
    if (m) tabs.push({index: Number(m[1] ?? '0'), title: m[2] ?? '', url: m[3] ?? ''});
  }
  if (tabs.length === 0 && !/^(No open tabs\.|- \d+:)/.test(text.trim())) throw new AutomationError('CLI_PROTOCOL', 'tab-list');
  return tabs;
}

/**
 * Choose the single maintained work tab: prefer a Cardmarket tab, then any
 * non-extension tab (for example a debug tab the user dragged into the group).
 * Extension handoff tabs are never chosen; a group that contains only
 * extension tabs yields `undefined` and fails with `no-controllable-tab`.
 */
export function chooseWorkTab(tabs: TabInfo[]): TabInfo | undefined {
  return tabs.find(t => t.url.startsWith(config.baseURL))
    ?? tabs.find(t => !t.url.startsWith('chrome-extension:'));
}

/** True when the tab group composition changed between two observations. */
export function tabDrift(before: TabInfo[], after: TabInfo[]): boolean {
  if (before.length !== after.length) return true;
  const key = (t: TabInfo) => `${t.url}\u0000${t.title}`;
  const seen = new Map<string, number>();
  for (const t of before) seen.set(key(t), (seen.get(key(t)) ?? 0) + 1);
  for (const t of after) {
    const count = seen.get(key(t)) ?? 0;
    if (count === 0) return true;
    seen.set(key(t), count - 1);
  }
  return false;
}

function causeContext(stderr: string | undefined): ErrorContext | undefined {
  const cause = (stderr ?? '').trim().slice(0, 240);
  return cause ? {cause} : undefined;
}

async function runCli(args: string[], timeoutMs = 20_000): Promise<{stdout:string;stderr:string}> {
  const step = `playwright-cli:${args.find(arg => !arg.startsWith('-')) ?? 'cli'}`;
  try {
    const result = await execFileAsync(config.browser.cliCommand, args, {
      timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024, env: process.env
    });
    return {stdout: result.stdout, stderr: result.stderr};
  } catch (raw) {
    const error = raw as NodeJS.ErrnoException & {stderr?: string; killed?: boolean; signal?: string};
    if (error.code === 'ENOENT') throw new AutomationError('ATTACH_FAILED', 'playwright-cli-not-found');
    if (error.code === 'ETIMEDOUT' || error.killed || error.signal === 'SIGTERM')
      throw new AutomationError('TIMEOUT', step, causeContext(error.stderr) ?? {cause: `bounded budget of ${timeoutMs} ms exceeded`});
    throw new AutomationError('ATTACH_FAILED', step, causeContext(error.stderr));
  }
}

function errorContext(error: unknown): ErrorContext | undefined {
  if (error instanceof AutomationError) return error.context;
  return {cause: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240)};
}

function treeContainsSession(value: unknown, session: string): boolean {
  if (value === session) return true;
  if (Array.isArray(value)) return value.some(v => treeContainsSession(v, session));
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(object, session)) return true;
    return Object.values(object).some(v => treeContainsSession(v, session));
  }
  return false;
}

export async function sessionAttached(): Promise<boolean> {
  const {stdout} = await runCli(cliArgs('list','--json'));
  try { return treeContainsSession(JSON.parse(stdout), config.browser.session); }
  catch { throw new AutomationError('CLI_PROTOCOL', 'session-list'); }
}

type ProbeReason = 'ok' | 'not-open' | 'relay-dead' | 'protocol' | 'unknown';
function failureText(error: unknown): string {
  if (error instanceof AutomationError)
    return [error.step, error.context?.cause, error.message].filter(Boolean).join(' ').slice(0, 240);
  if (error instanceof Error) return `${error.name} ${error.message}`.slice(0, 240);
  return String(error).slice(0, 240);
}
export function classifyTabListFailure(cause: string, attached: boolean): ProbeReason {
  const lower = cause.toLowerCase();
  if (attached) return 'relay-dead';
  if (lower.includes('is not open') || lower.includes('not open')) return 'not-open';
  if (/(browser|target|page|websocket|socket)[\s:,-]*(closed|disconnect|reset|error)/.test(lower) ||
      lower.includes('connection closed') || lower.includes('econnreset') || lower.includes('socket hang up'))
    return 'relay-dead';
  if (lower.includes('protocol') || lower.includes('unexpected') || lower.includes('syntaxerror') || lower.includes('parse'))
    return 'protocol';
  return 'unknown';
}
async function probeTabs(attached: boolean): Promise<{ tabs: TabInfo[] | null; reason: ProbeReason }> {
  try {
    const {stdout} = await runCli(cliArgs('-s=' + config.browser.session, 'tab-list', '--raw'), 15_000);
    return {tabs: parseTabList(stdout), reason: 'ok'};
  } catch (error) {
    if (error instanceof AutomationError && error.code === 'CLI_PROTOCOL') return {tabs: null, reason: 'protocol'};
    return {tabs: null, reason: classifyTabListFailure(failureText(error), attached)};
  }
}
async function stopSession(): Promise<void> {
  try { await runCli(cliArgs('-s=' + config.browser.session, 'close'), 10_000); } catch {}
}

function recordState(session: string, attached: boolean, live: boolean, stale: boolean, waiting: boolean, tabs: TabInfo[]): BrowserState {
  const state: BrowserState = {session, attached, live, stale, waiting, tabs, workTab: null, drifted: false};
  current = state;
  return state;
}

/**
 * Select the one maintained tab and record it. `BROWSER_REQUIRED
 * no-controllable-tab` when the group has no usable tab at all.
 */
async function selectWorkTab(state: BrowserState): Promise<BrowserState> {
  const workTab = chooseWorkTab(state.tabs);
  if (!workTab) throw new AutomationError('BROWSER_REQUIRED', 'no-controllable-tab');
  try {
    await runCli(cliArgs('-s=' + state.session, 'tab-select', String(workTab.index)), 10_000);
  } catch (error) {
    throw new AutomationError('ATTACH_FAILED', 'tab-select', errorContext(error));
  }
  const selected = {...state, workTab};
  current = selected;
  return selected;
}

const POLL_MS = 2_000;
const PROBE_MS = 8_000;

async function waitForHandoff(deadlineMs: number): Promise<BrowserState | null> {
  const session = config.browser.session;
  const started = Date.now();
  let anyTab = false;
  for (;;) {
    let attached = false;
    try { attached = await sessionAttached(); } catch {}
    if (attached) {
      const probe = await probeTabs(true);
      if (probe.tabs) {
        anyTab = anyTab || probe.tabs.length > 0;
        if (chooseWorkTab(probe.tabs)) return selectWorkTab(recordState(session, true, true, false, false, probe.tabs));
      }
    }
    const elapsed = Date.now() - started;
    if (!anyTab && elapsed + POLL_MS > PROBE_MS) break;
    if (elapsed + POLL_MS > deadlineMs) break;
    await sleep(POLL_MS);
  }
  return null;
}

/**
 * Point the operator at the explicit, human-facing `doctor` step. `doctor`
 * performs the one-time attach and the bounded handoff wait (up to
 * `attachWaitMs`), which a data command must never do itself.
 */
function doctorRecovery(prerequisite: string): ErrorContext['recovery'] {
  return {disposition:'handoff',owner:'operator',command:'npm run cli -- doctor',prerequisite};
}

/**
 * Enforce the session lifecycle in two modes:
 *  - `handoff` (connect/doctor): the explicit, human-facing step. It performs
 *    the one-time attach and the bounded handoff wait (up to `attachWaitMs`).
 *  - `fast` (every data command): never blocks on a human step and never runs
 *    `attach`. If the session is missing or the relay is not usable it fails
 *    closed and points the operator at `doctor` — mirroring how login/consent
 *    live outside the bounded runtime.
 *  - session exists, relay live, usable tab     -> proceed; never re-attach
 *  - session exists, relay live, no usable tab  -> fast: fail closed;
 *    handoff: bounded wait for the user's "Allow & select"
 *  - session listed, relay dead (stale)         -> fast: fail closed;
 *    handoff: run the documented one-time re-handshake
 *  - session missing                            -> fast: fail closed;
 *    handoff: fresh attach
 */
function handoffRecovery(): ErrorContext['recovery'] {
  return {disposition:'handoff', owner:'user', prerequisite:'Complete the existing Playwright connect/welcome tab by choosing the tab and clicking "Allow & select". Use doctor --reset only if that tab is missing or broken.'};
}
async function freshAttachFlow(): Promise<BrowserState> {
  const session = config.browser.session;
  const attach = config.browser.attach;
  const target = attach.mode === 'extension' ? `--extension=${attach.target}` : `--cdp=${attach.target}`;
  try {
    await runCli(cliArgs('attach', target, `--session=${session}`), 30_000);
  } catch (error) {
    if (error instanceof AutomationError && error.code === 'TIMEOUT') {
      await writeAttachMemo('timeout');
      recordState(session, false, false, false, true, []);
      const waited = await waitForHandoff(config.attachWaitMs);
      if (waited) { await clearAttachMemo(); return waited; }
      throw new AutomationError('BROWSER_REQUIRED', 'handoff-waiting', {recovery:handoffRecovery()});
    }
    throw new AutomationError('ATTACH_FAILED', 'attach-open-browser', errorContext(error));
  }
  await clearAttachMemo();
  let attached = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { attached = await sessionAttached(); if (attached) break; } catch {}
    if (attempt < 2) await sleep(500);
  }
  if (!attached) throw new AutomationError('ATTACH_FAILED', 'session-not-visible');
  const settled = await waitForHandoff(config.attachWaitMs);
  if (settled) return settled;
  const probe = await probeTabs(true);
  if (probe.reason === 'relay-dead') throw new AutomationError('ATTACH_FAILED', 'relay-stale', {recovery:doctorRecovery('The freshly attached session is listed but its relay is dead. Run doctor --reset to perform a clean re-handshake.')});
  throw new AutomationError('BROWSER_REQUIRED', 'handoff-waiting', {recovery:handoffRecovery()});
}
export async function ensureAttached(mode: 'fast' | 'handoff', options: { forceFresh?: boolean } = {}): Promise<BrowserState> {
  const session = config.browser.session;
  let attached = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { attached = await sessionAttached(); if (attached) break; } catch {}
    if (attempt < 2) await sleep(500);
  }
  if (options.forceFresh && attached) {
    await stopSession();
    await clearAttachMemo();
    attached = false;
  }
  if (!attached && mode === 'fast') {
    recordState(session, false, false, false, false, []);
    throw new AutomationError('BROWSER_REQUIRED', 'session-missing',
      {recovery:doctorRecovery('The shared Chrome session is not started. Run doctor to open the one-time extension handoff, then complete it in the browser.')});
  }
  if (attached) {
    const probe = await probeTabs(true);
    if (probe.tabs) {
      const state = recordState(session, true, true, false, false, probe.tabs);
      if (chooseWorkTab(probe.tabs)) return selectWorkTab(state);
      if (mode === 'fast') {
        throw new AutomationError('BROWSER_REQUIRED', 'no-controllable-tab',
          {recovery:doctorRecovery('The controlled group has no usable tab (only the extension handoff page). Run doctor and finish the handoff, or drag an existing tab into the Playwright · playwright-cli group.')});
      }
      const waited = await waitForHandoff(config.attachWaitMs);
      if (waited) return waited;
      throw new AutomationError('BROWSER_REQUIRED', 'no-controllable-tab',
        {recovery:doctorRecovery('The controlled group has no usable tab. Finish the handoff in the existing Playwright tab or drag an existing tab into the Playwright · playwright-cli group.')});
    }
    if (probe.reason === 'protocol') {
      recordState(session, true, false, false, false, []);
      throw new AutomationError('CLI_PROTOCOL', 'tab-list');
    }
    if (probe.reason === 'relay-dead') {
      recordState(session, true, false, true, false, []);
      if (mode === 'fast') {
        throw new AutomationError('ATTACH_FAILED', 'relay-stale',
          {recovery:doctorRecovery('The session is listed but its relay is dead (stale). Run doctor to perform the one-time re-handshake, then complete it in the browser.')});
      }
      await stopSession();
      await clearAttachMemo();
      return freshAttachFlow();
    }
    recordState(session, true, false, false, false, []);
    throw new AutomationError('ATTACH_FAILED', 'relay-unknown',
      {recovery:doctorRecovery('The listed session returned an unrecognized tab-list failure. Run doctor to inspect it; do not re-attach repeatedly.')});
  }
  recordState(session, false, false, false, false, []);
  const memo = await readAttachMemo();
  if (memo) {
    recordState(session, false, false, false, true, []);
    const waited = await waitForHandoff(config.attachWaitMs);
    if (waited) { await clearAttachMemo(); return waited; }
    const probe = await probeTabs(true);
    if (probe.reason === 'relay-dead') throw new AutomationError('ATTACH_FAILED', 'relay-stale',
      {recovery:doctorRecovery('The session is listed but its relay is dead. Run doctor --reset to perform a clean re-handshake.')});
    throw new AutomationError('BROWSER_REQUIRED', 'handoff-waiting', {recovery:handoffRecovery()});
  }
  await clearAttachMemo();
  return freshAttachFlow();
}

function assertBrowserPayload(raw: unknown): BrowserResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new AutomationError('CLI_PROTOCOL');
  const object = raw as Record<string, unknown>;
  if (object.ok === false) {
    const error = object.error as Record<string, unknown> | undefined;
    const known = new Set<ErrorCode>(['INVALID_INPUT','UNKNOWN_ACTION','AUTH_REQUIRED','HUMAN_REQUIRED','BROWSER_REQUIRED','ATTACH_FAILED',
      'CLI_PROTOCOL','UI_DRIFT','AMBIGUOUS_SELECTOR','POSTCONDITION_FAILED','PLAN_CHANGED','PLAN_EXPIRED','APPROVAL_REQUIRED',
      'PLAN_USED','UNKNOWN_COMMIT','BUSY','TIMEOUT','INTERNAL','NOT_CONFIGURED','BUILD_ERROR','WRONG_STATE','UNKNOWN_STATE',
      'STALE_CONTEXT','FILTER_MISMATCH','SESSION_MISMATCH','CONSENT_REQUIRED','SESSION_QUARANTINED','OUTPUT_LIMIT','BUILD_INVALID',
      'NOT_VERIFIED']);
    const candidate = typeof error?.code === 'string' ? error.code as ErrorCode : undefined;
    const code: ErrorCode = candidate && known.has(candidate) ? candidate : 'INTERNAL';
    throw new AutomationError(code,
      typeof error?.step === 'string' ? error.step : undefined,
      { ...(Object.prototype.hasOwnProperty.call(error ?? {}, 'expected') ? { expected: error?.expected } : {}),
        ...(Object.prototype.hasOwnProperty.call(error ?? {}, 'actual') ? { actual: error?.actual } : {}),
        ...(isStateId(object.state) ? { state: object.state } : {}),
        ...(typeof error?.cause === 'string' ? { cause: error.cause } : {}) });
  }
  if (object.ok !== true || typeof object.accountKey !== 'string' || !object.accountKey) throw new AutomationError('CLI_PROTOCOL');
  if (object.state !== undefined && !isStateId(object.state)) throw new AutomationError('CLI_PROTOCOL', 'state');
  const state = object.state === undefined ? undefined : object.state;
  return {accountKey: object.accountKey, value: object.value as Json, ...(state ? { state } : {})};
}

/** Best-effort post-action tab observation; never fails the action. */
async function refreshDrift(state: BrowserState): Promise<void> {
  try {
    const {stdout} = await runCli(cliArgs('-s=' + state.session, 'tab-list', '--raw'), 15_000);
    const tabs = parseTabList(stdout);
    current = {...state, tabs, workTab: chooseWorkTab(tabs) ?? state.workTab, drifted: tabDrift(state.tabs, tabs)};
  } catch {
    // Keep the pre-action observation.
  }
}

export async function invokeBrowser(
  project: string, root: string, action: Action, phase: Phase, input: Input, preview?: Preview
): Promise<BrowserResult> {
  if (!config.configured) throw new AutomationError('NOT_CONFIGURED');
  await ensureAttached('fast');

  const actionPath = resolve(action.modulePath.startsWith('file:') ? fileURLToPath(action.modulePath) : action.modulePath);
  const sitePagePath = resolve(project, 'src/pages/SitePage.ts');
  const statePath = resolve(project, 'src/lib/state.ts');
  const contract = actionContract(action.id);
  if (!contract) throw new AutomationError('NOT_CONFIGURED', 'contract-registry');
  const inputLiteral = JSON.stringify(input);
  const previewLiteral = preview === undefined ? 'undefined' : JSON.stringify(preview);
  const allowedFromLiteral = JSON.stringify(contract.from);
  const source = `
    import { action } from ${JSON.stringify(actionPath)};
    import { SitePage } from ${JSON.stringify(sitePagePath)};
    import { detectState } from ${JSON.stringify(statePath)};
    const toError = (error) => {
      const message = error && typeof error.message === 'string' ? error.message : '';
      const code = error && typeof error.code === 'string' ? error.code
        : /strict mode violation/i.test(message) ? 'AMBIGUOUS_SELECTOR'
        : error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'INTERNAL';
      const step = error && typeof error.step === 'string' ? error.step : undefined;
      const context = error && error.context && typeof error.context === 'object' ? error.context : {};
      const allowed = ['page','component','operation','expected','actual','cause'];
      const details = Object.fromEntries(allowed.filter((key) => context[key] !== undefined).map((key) => [key, context[key]]));
      return {code,...(step?{step}:{}),...details};
    };
    export async function invoke(page) {
      try {
        const ready = await new SitePage(page).assertReady();
        if (!ready || typeof ready.accountKey !== 'string' || !ready.accountKey) return {ok:false,error:{code:'AUTH_REQUIRED'}};
        if (ready.onSite !== true && !['nav.home','nav.search','status','info'].includes(${JSON.stringify(action.id)})) {
          return {ok:false,accountKey:ready.accountKey,state:'unknown',error:{code:'UNKNOWN_STATE',step:'origin',expected:${JSON.stringify(config.allowedOrigins)},actual:page.url()}};
        }
        const beforeState = detectState(page);
        if (!${allowedFromLiteral}.includes(beforeState)) {
          return {ok:false,accountKey:ready.accountKey,state:beforeState,error:{code:'WRONG_STATE',step:'source-state',expected:${allowedFromLiteral},actual:beforeState}};
        }
        if (${JSON.stringify(contract.auth)} === 'account' && ['public','unknown'].includes(ready.accountKey)) {
          return {ok:false,accountKey:ready.accountKey,state:beforeState,error:{code:'AUTH_REQUIRED',step:'account-identity'}};
        }
        const input = ${inputLiteral};
        const preview = ${previewLiteral};
        const runPhase = async () => {
          if (${JSON.stringify(phase)} === 'run') {
            if (action.kind !== 'read') throw {code:'INTERNAL',step:'action-kind'};
            return await action.run(page, input);
          }
          if (${JSON.stringify(phase)} === 'prepare') {
            if (action.kind !== 'write') throw {code:'INTERNAL',step:'action-kind'};
            return await action.prepare(page, input);
          }
          if (action.kind !== 'write') throw {code:'INTERNAL',step:'action-kind'};
          return await action.execute(page, input, preview);
        };
        try {
          const value = await runPhase();
          return {ok:true,accountKey:ready.accountKey,state:detectState(page),value};
        } catch (error) {
          const payload = toError(error);
          return {ok:false,accountKey:ready.accountKey,state:detectState(page),error:payload};
        }
      } catch (error) {
        return {ok:false,state:detectState(page),error:toError(error)};
      }
    }
  `;
  const built = await build({stdin:{contents:source,resolveDir:project,sourcefile:'site-action-entry.ts',loader:'ts'},
    bundle:true,write:false,format:'iife',globalName:'__siteAction',platform:'node',target:'node22',logLevel:'silent'});
  const bundled = built.outputFiles[0]?.text;
  if (!bundled) throw new AutomationError('INTERNAL', 'bundle-action');
  if (/__require\(/.test(bundled)) throw new AutomationError('BUILD_ERROR', 'bundle-action');

  const dir = join(root, 'run-code');
  await mkdir(dir, {recursive:true,mode:0o700});
  const path = join(dir, `${randomUUID()}.js`);
  const wrapper = `async page => { ${bundled}\nreturn await __siteAction.invoke(page); }`;
  await writeFile(path, wrapper, {mode:0o600,flag:'wx'});
  const state = currentBrowserState();
  try {
    const {stdout} = await runCli(cliArgs(`-s=${config.browser.session}`,'--raw','run-code',`--filename=${path}`), config.actionBudgetMs);
    try { return assertBrowserPayload(JSON.parse(stdout.trim())); }
    catch (error) {
      if (error instanceof AutomationError) throw error;
      throw new AutomationError('CLI_PROTOCOL', 'run-code-output');
    }
  } finally {
    await unlink(path).catch(() => {});
    if (state) await refreshDrift(state);
  }
}
