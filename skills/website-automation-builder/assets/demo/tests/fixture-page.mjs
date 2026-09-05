// Deterministic Page/Locator double for protocol tests. This is NOT a real browser.
import { writeFile } from "node:fs/promises";
export function initialState() {
  return {
    account: "fixture-account",
    version: 1,
    title: "Forest",
    query: "SKU-42",
    field: "",
    editTitle: "",
    dialog: false,
    mutations: 0,
    uiChanges: 0,
    scenario: "normal",
    attached: false,
    calls: [],
  };
}
class Element {
  constructor(tag, attributes = {}, text = "", children = []) {
    this.tagName = tag.toUpperCase();
    this.attributes = attributes;
    this.text = text;
    this.children = children;
    for (const child of children) child.parent = this;
  }
  get textContent() {
    return this.text + this.children.map((c) => c.textContent).join(" ");
  }
  getAttribute(key) {
    return this.attributes[key] ?? null;
  }
  hasAttribute(key) {
    return Object.hasOwn(this.attributes, key);
  }
  get labels() {
    return [];
  }
  get ownerDocument() {
    return { getElementById: () => null };
  }
  getClientRects() {
    return this.hidden() ? [] : [{}];
  }
  hidden() {
    return this.hasAttribute("hidden") || (this.parent?.hidden() ?? false);
  }
  closest() {
    return this.hidden() ? this : null;
  }
  all() {
    return this.children.flatMap((c) => [c, ...c.all()]);
  }
  matches(selector) {
    return selector.split(",").some((part) => {
      if (part === 'input:not([type="hidden"]):not([type="password"])')
        return this.tagName === "INPUT";
      const role = part.match(/^\[role="([^"]+)"\]$/);
      if (role) return this.getAttribute("role") === role[1];
      if (part === "dialog[open]")
        return this.tagName === "DIALOG" && this.hasAttribute("open");
      if (part === "a[href]")
        return this.tagName === "A" && this.hasAttribute("href");
      return this.tagName === part.toUpperCase();
    });
  }
  querySelectorAll(selector) {
    return this.all().filter((c) => c.matches(selector));
  }
}
function tree(state) {
  const el = (tag, attrs, text, children) =>
    new Element(tag, attrs, text, children);
  const button = (name) => el("button", {}, name);
  const filters = el("section", { "data-testid": "search-filters" }, "", [
    el("h2", {}, "Search filters"),
    el("input", { "aria-label": "Artikelnummer" }),
    ...(state.scenario === "missing" ? [] : [button("Suchen")]),
    ...(state.scenario === "ambiguous" ? [button("Suchen")] : []),
  ]);
  const item = el(
    "article",
    {
      "data-testid": "item-SKU-42",
      "data-sku": "SKU-42",
      "data-version": String(state.version),
    },
    "",
    [el("span", { "data-testid": "title" }, state.title), button("Bearbeiten")],
  );
  const result = el(
    "div",
    {
      "data-testid": "result-" + state.query,
      "data-empty": String(state.query !== "SKU-42"),
    },
    "",
    state.query === "SKU-42" ? [item] : [],
  );
  const inventory = el(
    "main",
    {
      "data-testid": "inventory",
      "data-account": state.account,
      "data-state": state.scenario === "unknown" ? "other" : "inventory",
    },
    "",
    [
      el("h1", {}, "Inventory fixture"),
      el("p", { "data-testid": "inventory-summary" }, "1 article"),
      filters,
      el("section", { "data-testid": "results" }, "", [
        el("h2", {}, "Results"),
        result,
      ]),
    ],
  );
  const dialog = el(
    "dialog",
    {
      "aria-label": "Artikel bearbeiten",
      ...(state.dialog ? { open: "" } : { hidden: "" }),
    },
    "",
    [el("input", { "aria-label": "Titel" }), button("Speichern")],
  );
  return el("body", {}, "", [inventory, dialog]);
}
function role(element) {
  return (
    element.getAttribute("role") ||
    { BUTTON: "button", INPUT: "textbox", DIALOG: "dialog" }[element.tagName]
  );
}
function name(element) {
  return element.getAttribute("aria-label") || element.textContent;
}
class Locator {
  constructor(page, query) {
    this.page = page;
    this.query = query;
  }
  nodes() {
    return this.query(tree(this.page.state));
  }
  descendant(predicate) {
    return new Locator(this.page, (root) =>
      this.query(root).flatMap((e) => e.all().filter(predicate)),
    );
  }
  getByTestId(id) {
    return this.descendant((e) => e.getAttribute("data-testid") === id);
  }
  getByRole(value, options) {
    return this.descendant(
      (e) => role(e) === value && (!options?.name || name(e) === options.name),
    );
  }
  getByLabel(value) {
    return this.descendant((e) => name(e) === value);
  }
  async count() {
    return this.nodes().length;
  }
  one() {
    const nodes = this.nodes();
    if (nodes.length !== 1)
      throw new Error(
        nodes.length ? "strict mode violation" : "missing locator",
      );
    return nodes[0];
  }
  async waitFor() {
    if (this.one().hidden()) throw new Error("not visible");
  }
  async isVisible() {
    return !this.one().hidden();
  }
  async getAttribute(key) {
    return this.one().getAttribute(key);
  }
  async textContent() {
    return this.one().textContent;
  }
  async fill(value) {
    const target = name(this.one());
    this.page.state.uiChanges++;
    if (target === "Artikelnummer") this.page.state.field = value;
    else if (target === "Titel") this.page.state.editTitle = value;
    else throw new Error("unknown fill");
  }
  async click() {
    const target = name(this.one());
    const state = this.page.state;
    state.uiChanges++;
    if (target === "Suchen") state.query = state.field;
    else if (target === "Bearbeiten") {
      state.dialog = true;
      state.editTitle = state.title;
    } else if (target === "Speichern") {
      state.mutations++;
      state.version++;
      state.title =
        state.scenario === "bad-postcondition"
          ? "wrong title"
          : state.editTitle;
      state.dialog = false;
      if (state.scenario === "lost-commit")
        throw new Error("response lost after commit");
    } else throw new Error("unknown click");
  }
  async evaluate(fn, argument) {
    const previous = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({
      visibility: "visible",
      display: "block",
    });
    try {
      // Playwright serializes evaluate callbacks into a separate page environment.
      const callback = new Function("return (" + fn.toString() + ")")();
      return callback(this.one(), argument);
    } finally {
      globalThis.getComputedStyle = previous;
    }
  }
  async ariaSnapshot() {
    return this.one()
      .all()
      .filter((e) => !e.hidden())
      .map((e) => `- ${role(e) || e.tagName}: ${name(e)}`)
      .join("\n");
  }
}
export function fixturePage(state) {
  const page = {
    state,
    url: () =>
      state.scenario === "outside" ? "https://other.invalid/" : "{{BASE_URL}}",
    title: async () => "Inventory fixture",
    setDefaultTimeout: () => {},
    locator: (selector) => {
      if (selector !== "body") throw new Error("No free selector in fixture");
      return new Locator(page, (root) => [root]);
    },
    getByTestId: (id) =>
      new Locator(page, (root) =>
        root.all().filter((e) => e.getAttribute("data-testid") === id),
      ),
    getByRole: (value, options) =>
      new Locator(page, (root) =>
        root
          .all()
          .filter(
            (e) =>
              role(e) === value && (!options?.name || name(e) === options.name),
          ),
      ),
    screenshot: async ({ path }) =>
      writeFile(
        path,
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5S8AAAAASUVORK5CYII=",
          "base64",
        ),
      ),
  };
  return page;
}
