import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { JSDOM } from "jsdom";

test("global search survives Inertia page replacements", async (t) => {
  const dom = new JSDOM('<div id="app"></div>', {
    url: "http://localhost/products",
    pretendToBeVisual: true,
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const originals = new Map(Object.keys(globals).map((key) => [
    key, Object.getOwnPropertyDescriptor(globalThis, key),
  ]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.scrollTo = () => {};

  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { App, router } = await import("@inertiajs/react");
  const { DataTableGlobalSearch } = await import("../src/data-table/data-table-global-search.tsx");
  const submitted: string[] = [];
  let searchParam = "search";
  let tableName = "products";
  let pathname = "/products";

  function onSearch(value: string) {
    submitted.push(value);
    const url = new URL(pathname, dom.window.location.origin);
    if (value) url.searchParams.set(searchParam, value);
    dom.window.document.dispatchEvent(new dom.window.CustomEvent("inertia:before", {
      detail: { visit: { url } },
      cancelable: true,
    }));
  }

  function Page({ value = "" }: { value?: string }) {
    return createElement("main", null,
      createElement(DataTableGlobalSearch, { tableName, searchParam, value, onSearch }),
      createElement("button", { type: "button" }, "Autre action"),
    );
  }

  const root = createRoot(dom.window.document.getElementById("app")!);
  const initialPage = {
    component: "Products",
    props: { errors: {}, value: "" },
    url: pathname,
    version: null,
    clearHistory: false,
    encryptHistory: false,
  };
  await act(async () => root.render(createElement(App, {
    initialPage,
    initialComponent: Page,
    resolveComponent: () => Page,
  })));

  function input(): HTMLInputElement {
    return dom.window.document.querySelector("input")!;
  }

  async function type(value: string) {
    await act(async () => {
      const field = input();
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!
        .set!.call(field, value);
      field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  }

  async function debounce() {
    await act(async () => { await delay(350); });
  }

  async function respond(value: string) {
    const url = new URL(pathname, dom.window.location.origin);
    if (value) url.searchParams.set(searchParam, value);
    await act(async () => {
      await new Promise<void>((resolve) => router.replace({
        url: url.pathname + url.search,
        props: { errors: {}, value },
        preserveState: false,
        preserveScroll: true,
        onSuccess: () => resolve(),
      }));
    });
  }

  try {
    await t.test("keeps focus and selection after each debounced search", async () => {
      await act(async () => input().focus());
      await type("widget");
      await debounce();
      assert.equal(submitted.at(-1), "widget");
      const oldInput = input();
      oldInput.setSelectionRange(2, 4, "backward");
      await respond("widget");
      assert.ok(input() !== oldInput, "Inertia must replace the actual DOM input");
      assert.ok(dom.window.document.activeElement === input(), "The search input must keep focus");
      assert.equal(input().value, "widget");
      assert.equal(input().selectionStart, 2);
      assert.equal(input().selectionEnd, 4);
      assert.equal(input().selectionDirection, "backward");

      await type("widgets");
      await debounce();
      await respond("widgets");
      assert.ok(dom.window.document.activeElement === input(), "The search input must keep focus");
      assert.equal(input().value, "widgets");
    });

    await t.test("keeps characters typed while the response is pending", async () => {
      await type("slow");
      await debounce();
      await type("slower");
      input().setSelectionRange(3, 3);
      await respond("slow");
      assert.equal(input().value, "slower");
      assert.ok(dom.window.document.activeElement === input(), "The search input must keep focus");
      assert.equal(input().selectionStart, 3);
      await debounce();
      assert.equal(submitted.at(-1), "slower");
      await respond("slower");
    });

    await t.test("clearing the search retains focus", async () => {
      await type("");
      await debounce();
      assert.equal(submitted.at(-1), "");
      await respond("");
      assert.equal(input().value, "");
      assert.ok(dom.window.document.activeElement === input(), "The search input must keep focus");
    });

    await t.test("does not steal focus when the user leaves the field", async () => {
      await type("blurred");
      await debounce();
      await act(async () => dom.window.document.querySelector("button")!.focus());
      await respond("blurred");
      assert.ok(dom.window.document.activeElement !== input(), "The search input must not steal focus");
    });

    await t.test("ignores pending search state after an unrelated navigation", async () => {
      await act(async () => input().focus());
      await type("discard");
      await debounce();
      dom.window.document.dispatchEvent(new dom.window.CustomEvent("inertia:before", {
        detail: { visit: { url: new URL("http://localhost/products?search=preset") } },
      }));
      await respond("preset");
      assert.equal(input().value, "preset");
      assert.ok(dom.window.document.activeElement !== input(), "The search input must not steal focus");
    });

    await t.test("supports custom query parameters and table names", async () => {
      pathname = "/invoices";
      tableName = "invoices";
      searchParam = "invoice_search";
      await respond("");
      await act(async () => input().focus());
      await type("invoice");
      await debounce();
      await respond("invoice");
      assert.equal(input().value, "invoice");
      assert.ok(dom.window.document.activeElement === input(), "The search input must keep focus");
    });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
