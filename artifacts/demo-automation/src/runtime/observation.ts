import type { Page, Locator } from "playwright";
import { AutomationError } from "./errors.ts";
import { allowedURL } from "./guards.ts";
export interface ObservationSite {
  detectState(): Promise<string>;
  regions(): Record<string, Locator>;
  visibleData(): Promise<Record<string, string>>;
}
export interface ObserveRequest {
  action:
    | "browser.status"
    | "browser.inspect"
    | "browser.inspectRegion"
    | "browser.screenshot";
  mode: "runtime" | "diagnostic";
  region?: string;
  screenshotPath?: string;
}

// Fixed read-only DOM projection; no caller-supplied JS or selectors.
export function summarize(
  root: Element,
  limits: { items: number; text: number },
) {
  const visible = (el: Element) => {
    const style = getComputedStyle(el);
    return (
      !el.closest('[hidden],[inert],[aria-hidden="true"]') &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      el.getClientRects().length > 0
    );
  };
  const text = (value: string | null) =>
    (value ?? "").replace(/\s+/g, " ").trim().slice(0, limits.text);
  const name = (el: Element) => {
    const labelled = el
      .getAttribute("aria-labelledby")
      ?.split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "")
      .join(" ");
    const labels =
      "labels" in el
        ? Array.from((el as HTMLInputElement).labels ?? [])
            .map((l) => l.textContent)
            .join(" ")
        : "";
    return text(
      el.getAttribute("aria-label") ||
        labelled ||
        labels ||
        (el.tagName === "INPUT" ? el.getAttribute("title") : el.textContent),
    );
  };
  const select = (selector: string) =>
    [
      ...(root.matches(selector) ? [root] : []),
      ...root.querySelectorAll(selector),
    ].filter(visible);
  const headings = select('h1,h2,h3,[role="heading"]');
  const dialogs = select('dialog[open],[role="dialog"],[role="alertdialog"]');
  const controls = select(
    'button,a[href],input:not([type="hidden"]):not([type="password"]),select,textarea,[role="button"],[role="link"]',
  );
  return {
    headings: headings.slice(0, limits.items).map(name),
    dialogs: dialogs
      .slice(0, limits.items)
      .map((el) => ({
        role: el.getAttribute("role") || "dialog",
        name: name(el),
      })),
    importantControls: controls.slice(0, limits.items).map((el) => ({
      role:
        el.getAttribute("role") ||
        (
          {
            BUTTON: "button",
            A: "link",
            SELECT: "combobox",
            TEXTAREA: "textbox",
            INPUT: "input",
          } as Record<string, string>
        )[el.tagName] ||
        "control",
      name: name(el),
      disabled:
        el.hasAttribute("disabled") ||
        el.getAttribute("aria-disabled") === "true",
    })),
    truncated: [headings, dialogs, controls].some(
      (items) => items.length > limits.items,
    ),
  };
}
function safeURL(raw: string): string {
  return raw.split(/[?#]/)[0]!.replace(/\/\/[^/]*@/, "//").slice(0, 1024);
}
export async function observe(
  page: Page,
  site: ObservationSite,
  request: ObserveRequest,
  origins: readonly string[],
): Promise<object> {
  try {
    const url = safeURL(page.url());
    let inScope = false;
    try { allowedURL(page.url(), origins); inScope = true; } catch { /* Status remains available outside the site. */ }
    const pageState = inScope
      ? await site.detectState().catch(() => "unknown")
      : "outside-site";
    const status = {
      url,
      title: (await page.title()).slice(0, 160),
      pageState,
    };
    let value: object = status;
    if (request.action !== "browser.status") {
      if (!inScope)
        throw new AutomationError("UNSUPPORTED_UI_STATE", "observation-origin");
      if (request.action === "browser.screenshot") {
        if (!request.screenshotPath)
          throw new AutomationError("NOT_CONFIGURED", "screenshot-path");
        // Viewport only; no scrolling/full-page capture or animations override.
        await page.screenshot({
          path: request.screenshotPath,
          fullPage: false,
          timeout: 15_000,
        });
        value = { ...status, screenshot: request.screenshotPath };
      } else {
        const regions = site.regions();
        const isRegion = request.action === "browser.inspectRegion";
        if (
          isRegion &&
          (!request.region || !Object.hasOwn(regions, request.region))
        )
          throw new AutomationError("UNKNOWN_REGION", "region");
        const root = isRegion
          ? regions[request.region!]!
          : page.locator("body");
        const count = await root.count();
        if (count !== 1)
          throw new AutomationError(
            count > 1 ? "AMBIGUOUS_SELECTOR" : "UI_DRIFT",
            isRegion ? request.region : "document",
          );
        if (!(await root.isVisible()))
          throw new AutomationError(
            "UI_DRIFT",
            isRegion ? request.region : "document",
          );
        const summary = await root.evaluate(summarize, {
          items: request.mode === "diagnostic" ? 16 : 8,
          text: 100,
        });
        value = isRegion
          ? { region: request.region, ...summary }
          : {
              ...status,
              ...summary,
              regions: Object.keys(regions).slice(0, 20),
              visibleData: Object.fromEntries(
                Object.entries(await site.visibleData())
                  .slice(0, 8)
                  .map(([k, v]) => [k.slice(0, 64), v.slice(0, 120)]),
              ),
            };
        if (request.mode === "diagnostic") {
          const snapshot = await root.ariaSnapshot({ timeout: 15_000 });
          value = {
            ...value,
            diagnostic: {
              locatorCount: count,
              visible: true,
              accessibility: snapshot.slice(0, 2400),
              truncated: snapshot.length > 2400,
            },
          };
        }
      }
    }
    return { ok: true, accountKey: "observation", state: pageState, value };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error instanceof AutomationError ? error.code : "UI_DRIFT",
        step: error instanceof AutomationError ? error.step : "observation",
      },
    };
  }
}
