import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  readBrowserStorage,
  resolvePageUrl,
  serializeResolvedUrl,
  writeBrowserStorage,
} from "../src/data-table/runtime.ts";

const BROWSER_GLOBAL_ACCESS =
  /\b(?:localStorage|sessionStorage|window|document|navigator|location|history|matchMedia|ResizeObserver|IntersectionObserver|MutationObserver|requestAnimationFrame|cancelAnimationFrame)\s*(?:\.|\[|\()/;

async function listSourceFiles(directory: URL): Promise<URL[]> {
  const files: URL[] = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) files.push(...(await listSourceFiles(url)));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(url);
  }

  return files;
}

test("render paths do not access browser-only globals directly", async () => {
  const runtimeUrl = new URL("../src/data-table/runtime.ts", import.meta.url);
  const sourceFiles = await listSourceFiles(new URL("../src/", import.meta.url));

  for (const sourceUrl of sourceFiles) {
    if (sourceUrl.href === runtimeUrl.href) continue;

    const source = await readFile(sourceUrl, "utf8");
    assert.doesNotMatch(source, BROWSER_GLOBAL_ACCESS);
    assert.doesNotMatch(source, /\binstanceof\s+(?:Element|HTMLElement)\b/);
  }
});

test("browser storage is a no-op during server rendering", () => {
  assert.equal(readBrowserStorage("localStorage", "key"), null);
  assert.doesNotThrow(() => {
    writeBrowserStorage("sessionStorage", "key", "value");
  });
});

test("browser storage errors are ignored", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const blockedWindow = Object.create(null, {
    localStorage: {
      get() {
        throw new Error("Storage is blocked");
      },
    },
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: blockedWindow,
  });

  try {
    assert.equal(readBrowserStorage("localStorage", "key"), null);
    assert.doesNotThrow(() => {
      writeBrowserStorage("localStorage", "key", "value");
    });
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
});

test("relative page URLs resolve without a browser origin", () => {
  const url = resolvePageUrl("/account/transfers?page=2");

  assert.equal(url.pathname, "/account/transfers");
  assert.equal(url.search, "?page=2");
});

test("resolved export URLs retain their original URL shape", () => {
  const relative = resolvePageUrl("/exports/transfers?format=csv");
  const absolute = resolvePageUrl("https://example.com/exports?format=xlsx");

  assert.equal(
    serializeResolvedUrl(relative, "/exports/transfers"),
    "/exports/transfers?format=csv",
  );
  assert.equal(
    serializeResolvedUrl(absolute, "https://example.com/exports"),
    "https://example.com/exports?format=xlsx",
  );
});
