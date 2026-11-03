import { router, usePage } from "@inertiajs/react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { resolvePageUrl } from "./runtime";

interface PendingSearch {
  submitted: string;
  input: HTMLInputElement;
  focused: boolean;
}

// Only the active search survives its Inertia page replacement, never table state.
const pendingSearches = new Map<string, PendingSearch>();

export function DataTableGlobalSearch({
  tableName,
  searchParam,
  value,
  onSearch,
}: {
  tableName: string;
  searchParam: string;
  value: string;
  onSearch: (value: string) => void;
}) {
  const pathname = resolvePageUrl(usePage().url).pathname;
  const searchKey = JSON.stringify([pathname, tableName, searchParam]);
  const pending = pendingSearches.get(searchKey);
  const restored = useRef(pending?.submitted === value ? pending : undefined);
  const [draft, setDraft] = useState(() => restored.current?.input.value ?? value);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSubmitted = useRef(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const search = restored.current;
    const input = inputRef.current;
    restored.current = undefined;
    pendingSearches.delete(searchKey);

    if (!search?.focused || !input) return;

    input.focus({ preventScroll: true });
    input.setSelectionRange(
      search.input.selectionStart,
      search.input.selectionEnd,
      search.input.selectionDirection ?? undefined,
    );
  }, [searchKey]);

  useEffect(() => router.on("before", (event) => {
    const search = pendingSearches.get(searchKey);
    if (search?.input !== inputRef.current) return;

    const url = event.detail.visit.url;
    if (
      url.pathname !== pathname ||
      (url.searchParams.get(searchParam) ?? "") !== search.submitted
    ) {
      pendingSearches.delete(searchKey);
    }
  }), [pathname, searchKey, searchParam]);

  useEffect(() => {
    if (previousValue.current === value) return;
    previousValue.current = value;
    setDraft(value);
    lastSubmitted.current = value;
  }, [value]);

  useEffect(() => {
    const normalized = draft.trim();
    if (normalized === value || normalized === lastSubmitted.current) return;

    const timeout = setTimeout(() => {
      lastSubmitted.current = normalized;
      const input = inputRef.current;
      if (input) {
        pendingSearches.set(searchKey, {
          submitted: normalized,
          input,
          focused: input.ownerDocument.activeElement === input,
        });
      }
      onSearch(normalized);
    }, 300);

    return () => clearTimeout(timeout);
  }, [draft, onSearch, searchKey, value]);

  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const search = pendingSearches.get(searchKey);
          if (search?.input === inputRef.current) search.focused = false;
        }}
        onFocus={() => {
          const search = pendingSearches.get(searchKey);
          if (search?.input === inputRef.current) search.focused = true;
        }}
        placeholder="Rechercher..."
        aria-label="Recherche globale"
        className="h-7 pl-8"
      />
    </div>
  );
}
