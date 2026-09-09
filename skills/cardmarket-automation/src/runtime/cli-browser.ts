import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
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

export type TabInfo = {index: number; url: string; title: string};
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
export function chooseWorkTab(tabs: TabInfo[]): TabInfo | undefined {
  return tabs.find(t => t.url.startsWith(config.baseURL))
    ?? tabs.find(t => t.url !== '' && !t.url.startsWith('chrome-extension:'))
    ?? tabs[0];
}
async function selectWorkTab(): Promise<void> {
  const {stdout} = await runCli(cliArgs('-s=' + config.browser.session, 'tab-list', '--raw'), 15_000);
  const workTab = chooseWorkTab(parseTabList(stdout));
  if (!workTab) throw new AutomationError('BROWSER_REQUIRED', 'no-controllable-tab');
  await runCli(cliArgs('-s=' + config.browser.session, 'tab-select', String(workTab.index)), 10_000);
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

export async function ensureAttached(): Promise<void> {
  // Retry a few times to handle transient list failures (WebSocket drops,
  // timing) before concluding the session is gone. Re-attaching is one-shot:
  // it opens a new Welcome tab and a second relay that cannot share tabs.
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (await sessionAttached()) return;
    } catch {
      // Transient list failure; retry.
    }
    if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 500));
  }
  const attach = config.browser.attach;
  const target = attach.mode === 'extension' ? `--extension=${attach.target}` : `--cdp=${attach.target}`;
  try {
    await runCli(cliArgs('attach', target, `--session=${config.browser.session}`), 30_000);
  } catch {
    throw new AutomationError('BROWSER_REQUIRED', 'attach-open-browser');
  }
  if (!await sessionAttached()) throw new AutomationError('ATTACH_FAILED', 'session-not-visible');
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

export async function invokeBrowser(
  project: string, root: string, action: Action, phase: Phase, input: Input, preview?: Preview
): Promise<BrowserResult> {
  if (!config.configured) throw new AutomationError('NOT_CONFIGURED');
  await ensureAttached();

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
  try {
    await selectWorkTab();
    const {stdout} = await runCli(cliArgs(`-s=${config.browser.session}`,'--raw','run-code',`--filename=${path}`), config.actionBudgetMs);
    try { return assertBrowserPayload(JSON.parse(stdout.trim())); }
    catch (error) {
      if (error instanceof AutomationError) throw error;
      throw new AutomationError('CLI_PROTOCOL', 'run-code-output');
    }
  } finally {
    await unlink(path).catch(() => {});
  }
}
