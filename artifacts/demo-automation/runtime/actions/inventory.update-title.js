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
  async function clickUnique(locator, step, timeout = 15e3) {
    await (await uniqueVisible(locator, step, timeout)).click({ timeout });
  }
  async function fillUnique(locator, value, step, timeout = 15e3) {
    await (await uniqueVisible(locator, step, timeout)).fill(value, { timeout });
  }
  function allowedURL(url, allowedOrigins) {
    const origin = url.match(/^(https?:\/\/[^/?#]+)(?:[/?#]|$)/)?.[1];
    if (!origin || /[\u0000-\u0020\u007f\\]/.test(url) || origin.includes("@") || !allowedOrigins.includes(origin))
      throw new AutomationError("UI_DRIFT", "navigation-origin");
    return url;
  }

  // src/pages/InventoryPage.ts
  var InventoryPage = class {
    page;
    root;
    constructor(page) {
      this.page = page;
      this.root = page.getByTestId("inventory");
    }
    async search(sku) {
      await uniqueVisible(this.root, "inventory-root");
      await fillUnique(
        this.root.getByRole("textbox", { name: "Artikelnummer", exact: true }),
        sku,
        "sku-field"
      );
      await clickUnique(
        this.root.getByRole("button", { name: "Suchen", exact: true }),
        "search-submit"
      );
      const result = this.root.getByTestId("result-" + sku);
      await uniqueVisible(result, "query-result");
      if (await result.getAttribute("data-empty") === "true") return null;
      const item = result.getByTestId("item-" + sku);
      await uniqueVisible(item, "exact-sku");
      if (await item.getAttribute("data-sku") !== sku)
        throw new AutomationError("POSTCONDITION_FAILED");
      const title = await uniqueVisible(item.getByTestId("title"), "item-title");
      const text = (await title.textContent())?.trim();
      if (!text) throw new AutomationError("POSTCONDITION_FAILED");
      return { sku, title: text };
    }
    async item(sku) {
      const item = this.root.getByTestId("item-" + sku);
      await uniqueVisible(item, "exact-sku");
      if (await item.getAttribute("data-sku") !== sku)
        throw new AutomationError("POSTCONDITION_FAILED", "sku");
      return item;
    }
    async previewTitle(sku, title) {
      const item = await this.item(sku);
      const version = await item.getAttribute("data-version");
      if (!version) throw new AutomationError("POSTCONDITION_FAILED", "version");
      return { target: { sku }, version, changes: { title } };
    }
    async updateTitle(sku, title, preview) {
      const item = await this.item(sku);
      const account = await this.root.getAttribute("data-account");
      if (!account) throw new AutomationError("AUTH_REQUIRED");
      await clickUnique(
        item.getByRole("button", { name: "Bearbeiten", exact: true }),
        "edit"
      );
      const dialog = this.page.getByRole("dialog", {
        name: "Artikel bearbeiten",
        exact: true
      });
      await fillUnique(
        dialog.getByLabel("Titel", { exact: true }),
        title,
        "title"
      );
      if (await this.root.getAttribute("data-account") !== account || await item.getAttribute("data-version") !== preview.version || preview.target.sku !== sku)
        throw new AutomationError("PLAN_CHANGED", "commit-identity");
      await clickUnique(
        dialog.getByRole("button", { name: "Speichern", exact: true }),
        "save"
      );
      const changed = await this.item(sku);
      const version = await changed.getAttribute("data-version");
      const actual = (await (await uniqueVisible(changed.getByTestId("title"), "saved-title")).textContent())?.trim();
      if (version === preview.version || actual !== title)
        throw new AutomationError("POSTCONDITION_FAILED", "saved-title");
      return { sku, title: actual };
    }
  };

  // src/actions/inventory.update-title.ts
  var action = {
    id: "inventory.update-title",
    kind: "write",
    next: ["inventory.find"],
    description: "Update one item title after an exact preview.",
    preconditions: ["Authenticated inventory page is reachable."],
    postcondition: "The exact SKU shows the requested title and a new version.",
    parameters: {
      sku: {
        type: "string",
        description: "Exact SKU",
        required: true,
        min: 1,
        max: 64
      },
      title: {
        type: "string",
        description: "New title",
        required: true,
        min: 1,
        max: 120
      }
    },
    example: { sku: "SKU-42", title: "Replacement title" },
    outputDescription: "Object containing the exact SKU and saved title.",
    prepare: (page, input) => new InventoryPage(page).previewTitle(
      input.sku,
      input.title
    ),
    execute: (page, input, preview) => new InventoryPage(page).updateTitle(
      input.sku,
      input.title,
      preview
    ),
    validateOutput(value) {
      const row = value;
      if (!value || typeof value !== "object" || typeof row.sku !== "string" || typeof row.title !== "string" || !row.title.trim())
        throw new AutomationError("POSTCONDITION_FAILED", "output");
      return { sku: row.sku, title: row.title };
    }
  };

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

  // src/runtime/browser-entry.ts
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])])
    );
  }
  function sameValue(left, right) {
    return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
  }
  function checkOrigin(page, allowedOrigins) {
    allowedURL(page.url(), allowedOrigins);
  }
  function errorPayload(error) {
    const value = error;
    const message = error instanceof Error ? error.message : "";
    const code = typeof value?.code === "string" ? value.code : /strict mode violation/i.test(message) ? "AMBIGUOUS_SELECTOR" : error instanceof Error && error.name === "TimeoutError" ? "TIMEOUT" : "INTERNAL";
    return {
      code,
      ...typeof value?.step === "string" ? { step: value.step } : {},
      ...typeof value?.hint === "string" ? { hint: value.hint } : {}
    };
  }
  async function invokeAction(page, action2, SitePage2, options) {
    try {
      checkOrigin(page, options.allowedOrigins);
      const ready = await new SitePage2(page).assertReady();
      if (!ready?.accountKey)
        return { ok: false, error: { code: "AUTH_REQUIRED" } };
      if (options.guard && ready.accountKey !== options.guard.accountKey)
        return { ok: false, error: { code: "PLAN_CHANGED", step: "account" } };
      let value;
      if (options.phase === "run" && action2.kind === "read") {
        value = await action2.run(page, options.input);
      } else if (options.phase === "prepare" && action2.kind === "write") {
        value = await action2.prepare(page, options.input);
      } else if (options.phase === "execute" && action2.kind === "write" && options.guard?.preview) {
        const current = await action2.prepare(page, options.input);
        if (!sameValue(current, options.guard.preview))
          return { ok: false, error: { code: "PLAN_CHANGED", step: "preview" } };
        if (options.guard.expiresAt !== void 0 && Date.now() >= options.guard.expiresAt)
          return { ok: false, error: { code: "PLAN_EXPIRED" } };
        value = await action2.execute(page, options.input, options.guard.preview);
      } else {
        return { ok: false, error: { code: "INTERNAL", step: "action-kind" } };
      }
      checkOrigin(page, options.allowedOrigins);
      if ((await new SitePage2(page).assertReady()).accountKey !== ready.accountKey)
        return { ok: false, error: { code: "PLAN_CHANGED", step: "account" } };
      if (options.phase !== "prepare") value = action2.validateOutput(value);
      const state = await new SitePage2(page).detectState?.() ?? "unknown";
      return { ok: true, accountKey: ready.accountKey, value, state };
    } catch (error) {
      return { ok: false, error: errorPayload(error) };
    }
  }

  // <stdin>
  async function invoke(page, request) {
    page.setDefaultTimeout(15e3);
    const result = await invokeAction(page, action, SitePage, { ...request, allowedOrigins: ["http://127.0.0.1:4173"] });
    const json = JSON.stringify(result);
    return encodeURIComponent(json).replace(/%[0-9A-F]{2}/g, "x").length <= 16384 ? json : JSON.stringify({ ok: false, error: { code: "POSTCONDITION_FAILED", step: "output-size" } });
  }
  return __toCommonJS(stdin_exports);
})();

return await __siteAction.invoke(page, request);
}