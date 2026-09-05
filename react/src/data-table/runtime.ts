const SSR_FALLBACK_ORIGIN = "http://laravel-data-table.invalid";

type BrowserStorage = "localStorage" | "sessionStorage";

function getBrowserStorage(storage: BrowserStorage): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window[storage];
  } catch {
    return null;
  }
}

export function readBrowserStorage(
  storage: BrowserStorage,
  key: string,
): string | null {
  try {
    return getBrowserStorage(storage)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeBrowserStorage(
  storage: BrowserStorage,
  key: string,
  value: string,
): void {
  try {
    getBrowserStorage(storage)?.setItem(key, value);
  } catch {
    // Storage can be unavailable or blocked by the browser.
  }
}

export function resolvePageUrl(url: string): URL {
  return new URL(url, SSR_FALLBACK_ORIGIN);
}

export function serializeResolvedUrl(url: URL, source: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(source)) return url.toString();
  if (source.startsWith("//")) {
    return `//${url.host}${url.pathname}${url.search}${url.hash}`;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
