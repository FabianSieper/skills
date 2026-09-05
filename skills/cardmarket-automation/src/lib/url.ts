import { config } from '../../site.config.ts';

// Require-free URL helpers. The playwright-cli run-code browser runtime is a minimal
// vm context (no URL / require / process / Buffer globals), so we resolve and validate
// origins with plain string parsing instead of the WHATWG URL global.
export function originOf(value: string): string | null {
  const match = value.match(/^(https?:\/\/[^/?#]+)/i);
  return match?.[1] ?? null;
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
