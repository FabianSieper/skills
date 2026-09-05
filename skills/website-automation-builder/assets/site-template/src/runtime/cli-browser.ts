import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { config } from '../../site.config.ts';
import { AutomationError } from './errors.ts';
import type { Action, Preview } from './engine.ts';
import type { Input, Json } from './input.ts';

const execFileAsync = promisify(execFile);

type Phase = 'run' | 'prepare' | 'execute';
export interface BrowserResult { accountKey: string; value: Json }

function cliArgs(...args: string[]): string[] { return args; }

async function runCli(args: string[], timeoutMs = 20_000): Promise<{stdout:string;stderr:string}> {
  try {
    const result = await execFileAsync(config.browser.cliCommand, args, {
      timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024, env: process.env
    });
    return {stdout: result.stdout, stderr: result.stderr};
  } catch (raw) {
    const error = raw as NodeJS.ErrnoException & {stderr?: string};
    if (error.code === 'ENOENT') throw new AutomationError('ATTACH_FAILED', 'playwright-cli-not-found');
    throw new AutomationError('ATTACH_FAILED', 'playwright-cli');
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
  if (await sessionAttached()) return;
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
    const known = new Set(['AUTH_REQUIRED','HUMAN_REQUIRED','UI_DRIFT','AMBIGUOUS_SELECTOR','POSTCONDITION_FAILED','TIMEOUT','NOT_CONFIGURED']);
    const code = typeof error?.code === 'string' && known.has(error.code) ? error.code : 'INTERNAL';
    throw new AutomationError(code as 'AUTH_REQUIRED'|'HUMAN_REQUIRED'|'UI_DRIFT'|'AMBIGUOUS_SELECTOR'|'POSTCONDITION_FAILED'|'TIMEOUT'|'NOT_CONFIGURED',
      typeof error?.step === 'string' ? error.step : undefined);
  }
  if (object.ok !== true || typeof object.accountKey !== 'string' || !object.accountKey) throw new AutomationError('CLI_PROTOCOL');
  return {accountKey: object.accountKey, value: object.value as Json};
}

export async function invokeBrowser(
  project: string, root: string, action: Action, phase: Phase, input: Input, preview?: Preview
): Promise<BrowserResult> {
  if (!config.configured) throw new AutomationError('NOT_CONFIGURED');
  await ensureAttached();

  const actionPath = resolve(action.modulePath);
  const sitePagePath = resolve(project, 'src/pages/SitePage.ts');
  const inputLiteral = JSON.stringify(input);
  const previewLiteral = preview === undefined ? 'undefined' : JSON.stringify(preview);
  const source = `
    import { action } from ${JSON.stringify(actionPath)};
    import { SitePage } from ${JSON.stringify(sitePagePath)};
    export async function invoke(page) {
      try {
        const ready = await new SitePage(page).assertReady();
        if (!ready || typeof ready.accountKey !== 'string' || !ready.accountKey) return {ok:false,error:{code:'AUTH_REQUIRED'}};
        const input = ${inputLiteral};
        const preview = ${previewLiteral};
        let value;
        if (${JSON.stringify(phase)} === 'run') {
          if (action.kind !== 'read') return {ok:false,error:{code:'INTERNAL',step:'action-kind'}};
          value = await action.run(page, input);
        } else if (${JSON.stringify(phase)} === 'prepare') {
          if (action.kind !== 'write') return {ok:false,error:{code:'INTERNAL',step:'action-kind'}};
          value = await action.prepare(page, input);
        } else {
          if (action.kind !== 'write') return {ok:false,error:{code:'INTERNAL',step:'action-kind'}};
          value = await action.execute(page, input, preview);
        }
        return {ok:true,accountKey:ready.accountKey,value};
      } catch (error) {
        const message = error && typeof error.message === 'string' ? error.message : '';
        const code = error && typeof error.code === 'string' ? error.code
          : /strict mode violation/i.test(message) ? 'AMBIGUOUS_SELECTOR'
          : error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'INTERNAL';
        const step = error && typeof error.step === 'string' ? error.step : undefined;
        return {ok:false,error:{code,...(step?{step}:{})}};
      }
    }
  `;
  const built = await build({stdin:{contents:source,resolveDir:project,sourcefile:'site-action-entry.ts',loader:'ts'},
    bundle:true,write:false,format:'iife',globalName:'__siteAction',platform:'node',target:'node22',logLevel:'silent'});
  const bundled = built.outputFiles[0]?.text;
  if (!bundled) throw new AutomationError('INTERNAL', 'bundle-action');

  const dir = join(root, 'run-code');
  await mkdir(dir, {recursive:true,mode:0o700});
  const path = join(dir, `${randomUUID()}.js`);
  const wrapper = `async page => { ${bundled}\nreturn JSON.stringify(await __siteAction.invoke(page)); }`;
  await writeFile(path, wrapper, {mode:0o600,flag:'wx'});
  try {
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
