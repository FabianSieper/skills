async (page, request) => {
var __siteAction = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <stdin>
  var stdin_exports = {};
  __export(stdin_exports, {
    invoke: () => invoke
  });

  // src/runtime/errors.ts
  var messages = {
    UNSUPPORTED_UI_STATE: "Observe the current state; use a known recovery action or return to Builder/Repair mode.",
    UNKNOWN_REGION: "Use a registered region ID; diagnostic inspect can explain an unknown page.",
    BUILD_REQUIRED: "Precompiled runtime is missing, stale or damaged. Rebuild in Builder mode.",
    INVALID_INPUT: "Invalid input. Read the action contract; check required fields, types and limits.",
    UNKNOWN_ACTION: "Unknown or unsupported action. Use list/describe; do not improvise.",
    AUTH_REQUIRED: "The already-open browser is not authenticated as the required account. Let the user log in there, then retry.",
    HUMAN_REQUIRED: "Manual user interaction is required in the already-open browser. Do not bypass this state.",
    BROWSER_REQUIRED: "The configured browser must already be open. Do not launch a replacement browser.",
    ATTACH_FAILED: "Could not attach playwright-cli to the configured open browser/session. Check the browser, extension/CDP setup and session.",
    CLI_PROTOCOL: "playwright-cli returned an unexpected result. Stop instead of guessing or falling back to raw browser commands.",
    UI_DRIFT: "The observed UI no longer matches the documented flow. Stop and repair the POM.",
    AMBIGUOUS_SELECTOR: "The target locator matches more than one element. Stop; do not pick the first.",
    POSTCONDITION_FAILED: "The action result or expected business state could not be verified.",
    PLAN_CHANGED: "Account, target, state, input or implementation changed. Review a new plan.",
    PLAN_EXPIRED: "The plan expired. Create and review a new plan.",
    APPROVAL_REQUIRED: "The exact stored plan and its approval hash are required.",
    PLAN_USED: "This plan has already been attempted. Check the business state before doing anything else.",
    UNKNOWN_COMMIT: "A write may have happened. Do not retry; verify the business state with a read action.",
    BUSY: "This project already has a runtime lock. Check the running process; do not blindly remove it.",
    TIMEOUT: "The bounded operation timed out. Inspect the state; do not blindly retry writes.",
    INTERNAL: "The operation failed. Inspect local diagnostics without exposing secrets.",
    NOT_CONFIGURED: "Website implementation and verification are not complete."
  };
  var AutomationError = class extends Error {
    code;
    step;
    hint;
    constructor(code, step, hint) {
      super(messages[code]);
      this.name = "AutomationError";
      this.code = code;
      this.step = step;
      this.hint = hint;
    }
  };

  // src/runtime/guards.ts
  async function uniqueVisible(locator, step, timeout = 15e3) {
    try {
      await locator.waitFor({ state: "visible", timeout });
    } catch {
      const count2 = await locator.count().catch(() => 0);
      throw new AutomationError(
        count2 > 1 ? "AMBIGUOUS_SELECTOR" : "UI_DRIFT",
        step
      );
    }
    const count = await locator.count();
    if (count !== 1)
      throw new AutomationError(
        count > 1 ? "AMBIGUOUS_SELECTOR" : "UI_DRIFT",
        step
      );
    return locator;
  }
  function allowedURL(url, allowedOrigins) {
    const origin = url.match(/^(https?:\/\/[^/?#]+)(?:[/?#]|$)/)?.[1];
    if (!origin || /[\u0000-\u0020\u007f\\]/.test(url) || origin.includes("@") || !allowedOrigins.includes(origin))
      throw new AutomationError("UI_DRIFT", "navigation-origin");
    return url;
  }

  // src/components/InventorySummary.ts
  var InventorySummary = class {
    page;
    constructor(page) {
      this.page = page;
    }
    async read() {
      const summary = this.page.getByTestId("inventory-summary");
      return await summary.count() === 1 && await summary.isVisible() ? {
        inventory: (await summary.textContent() ?? "").trim().slice(0, 100)
      } : {};
    }
  };

  // src/pages/SitePage.ts
  var SitePage = class {
    page;
    constructor(page) {
      this.page = page;
    }
    async detectState() {
      const root = this.page.getByTestId("inventory");
      if (await root.count() !== 1 || !await root.isVisible())
        return "unknown";
      return await root.getAttribute("data-state") === "inventory" ? "inventory" : "unknown";
    }
    async assertReady() {
      if (await this.detectState() !== "inventory")
        throw new AutomationError("UNSUPPORTED_UI_STATE", "inventory-state");
      const root = await uniqueVisible(
        this.page.getByTestId("inventory"),
        "inventory-root"
      );
      const accountKey = await root.getAttribute("data-account");
      if (!accountKey) throw new AutomationError("AUTH_REQUIRED");
      return { accountKey };
    }
    regions() {
      return {
        "search-filters": this.page.getByTestId("search-filters"),
        "inventory-results": this.page.getByTestId("results")
      };
    }
    async visibleData() {
      return new InventorySummary(this.page).read();
    }
  };

  // src/runtime/observation.ts
  function summarize(root, limits) {
    const visible = (el) => {
      const style = getComputedStyle(el);
      return !el.closest('[hidden],[inert],[aria-hidden="true"]') && style.visibility !== "hidden" && style.display !== "none" && el.getClientRects().length > 0;
    };
    const text = (value) => (value ?? "").replace(/\s+/g, " ").trim().slice(0, limits.text);
    const name = (el) => {
      const labelled = el.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "").join(" ");
      const labels = "labels" in el ? Array.from(el.labels ?? []).map((l) => l.textContent).join(" ") : "";
      return text(
        el.getAttribute("aria-label") || labelled || labels || (el.tagName === "INPUT" ? el.getAttribute("title") : el.textContent)
      );
    };
    const select = (selector) => [
      ...root.matches(selector) ? [root] : [],
      ...root.querySelectorAll(selector)
    ].filter(visible);
    const headings = select('h1,h2,h3,[role="heading"]');
    const dialogs = select('dialog[open],[role="dialog"],[role="alertdialog"]');
    const controls = select(
      'button,a[href],input:not([type="hidden"]):not([type="password"]),select,textarea,[role="button"],[role="link"]'
    );
    return {
      headings: headings.slice(0, limits.items).map(name),
      dialogs: dialogs.slice(0, limits.items).map((el) => ({
        role: el.getAttribute("role") || "dialog",
        name: name(el)
      })),
      importantControls: controls.slice(0, limits.items).map((el) => ({
        role: el.getAttribute("role") || {
          BUTTON: "button",
          A: "link",
          SELECT: "combobox",
          TEXTAREA: "textbox",
          INPUT: "input"
        }[el.tagName] || "control",
        name: name(el),
        disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true"
      })),
      truncated: [headings, dialogs, controls].some(
        (items) => items.length > limits.items
      )
    };
  }
  function safeURL(raw) {
    return raw.split(/[?#]/)[0].replace(/\/\/[^/]*@/, "//").slice(0, 1024);
  }
  async function observe(page, site, request, origins) {
    try {
      const url = safeURL(page.url());
      let inScope = false;
      try {
        allowedURL(page.url(), origins);
        inScope = true;
      } catch {
      }
      const pageState = inScope ? await site.detectState().catch(() => "unknown") : "outside-site";
      const status = {
        url,
        title: (await page.title()).slice(0, 160),
        pageState
      };
      let value = status;
      if (request.action !== "browser.status") {
        if (!inScope)
          throw new AutomationError("UNSUPPORTED_UI_STATE", "observation-origin");
        if (request.action === "browser.screenshot") {
          if (!request.screenshotPath)
            throw new AutomationError("NOT_CONFIGURED", "screenshot-path");
          await page.screenshot({
            path: request.screenshotPath,
            fullPage: false,
            timeout: 15e3
          });
          value = { ...status, screenshot: request.screenshotPath };
        } else {
          const regions = site.regions();
          const isRegion = request.action === "browser.inspectRegion";
          if (isRegion && (!request.region || !Object.hasOwn(regions, request.region)))
            throw new AutomationError("UNKNOWN_REGION", "region");
          const root = isRegion ? regions[request.region] : page.locator("body");
          const count = await root.count();
          if (count !== 1)
            throw new AutomationError(
              count > 1 ? "AMBIGUOUS_SELECTOR" : "UI_DRIFT",
              isRegion ? request.region : "document"
            );
          if (!await root.isVisible())
            throw new AutomationError(
              "UI_DRIFT",
              isRegion ? request.region : "document"
            );
          const summary = await root.evaluate(summarize, {
            items: request.mode === "diagnostic" ? 16 : 8,
            text: 100
          });
          value = isRegion ? { region: request.region, ...summary } : {
            ...status,
            ...summary,
            regions: Object.keys(regions).slice(0, 20),
            visibleData: Object.fromEntries(
              Object.entries(await site.visibleData()).slice(0, 8).map(([k, v]) => [k.slice(0, 64), v.slice(0, 120)])
            )
          };
          if (request.mode === "diagnostic") {
            const snapshot = await root.ariaSnapshot({ timeout: 15e3 });
            value = {
              ...value,
              diagnostic: {
                locatorCount: count,
                visible: true,
                accessibility: snapshot.slice(0, 2400),
                truncated: snapshot.length > 2400
              }
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
          step: error instanceof AutomationError ? error.step : "observation"
        }
      };
    }
  }

  // <stdin>
  async function invoke(page, request) {
    page.setDefaultTimeout(15e3);
    const result = await observe(page, new SitePage(page), request, ["http://127.0.0.1:4173"]);
    const json = JSON.stringify(result);
    return encodeURIComponent(json).replace(/%[0-9A-F]{2}/g, "x").length <= 16384 ? json : JSON.stringify({ ok: false, error: { code: "POSTCONDITION_FAILED", step: "output-size" } });
  }
  return __toCommonJS(stdin_exports);
})();

return await __siteAction.invoke(page, request);
}