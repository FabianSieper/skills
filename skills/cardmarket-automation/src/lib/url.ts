import { config } from '../../site.config.ts';

// Require-free URL helpers. The playwright-cli run-code browser runtime is a minimal
// vm context (no URL / require / process / Buffer globals), so we resolve and validate
// origins with plain string parsing instead of the WHATWG URL global.
export function originOf(value: string): string | null {
  const match = value.match(/^(https?:\/\/[^/?#]+)/i);
  return match?.[1] ?? null;
}

/**
 * Browser-safe URL breakdown. The run-code vm context lacks the WHATWG `URL`
 * global, so we parse scheme, userinfo, host and path with plain string/regex
 * work. Returns `null` when the value is not an absolute http(s) URL.
 */
export interface ParsedUrl {
  origin: string;
  username: string;
  password: string;
  pathname: string;
}

export function parseUrl(value: string): ParsedUrl | null {
  const match = value.match(/^(https?:\/\/)([^/?#]*)([^?#]*)/i);
  if (!match || match[1] === undefined || match[2] === undefined) return null;
  const scheme = match[1].toLowerCase();
  const authority = match[2];
  const rawPath = match[3] ?? '';
  let username = '';
  let password = '';
  let hostPort = authority;
  const atIdx = authority.lastIndexOf('@');
  if (atIdx >= 0) {
    const userinfo = authority.slice(0, atIdx);
    hostPort = authority.slice(atIdx + 1);
    const colonIdx = userinfo.indexOf(':');
    if (colonIdx >= 0) {
      username = userinfo.slice(0, colonIdx);
      password = userinfo.slice(colonIdx + 1);
    } else {
      username = userinfo;
    }
  }
  if (!hostPort) return null;
  return { origin: scheme + hostPort.toLowerCase(), username, password, pathname: rawPath || '/' };
}

export function isAllowedOrigin(value: string): boolean {
  const origin = originOf(value);
  return origin !== null && config.allowedOrigins.includes(origin);
}

export function resolveHref(href: string, base: string = config.baseURL): string {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  const root = base.replace(/\/+$/, '');
  return href.startsWith('/') ? root + href : root + '/' + href;
}
