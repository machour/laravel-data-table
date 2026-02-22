import { router } from "@inertiajs/react";
import { useCallback, useMemo } from "react";
import type { ActiveFilters, FilterValue } from "./types";

function parseFilterParam(raw: string): FilterValue {
    const match = raw.match(/^([a-z_]+):(.+)$/i);
    if (match) {
        return { operator: match[1], values: match[2].split(",") };
    }
    return { operator: "", values: raw.split(",") };
}

function navigate(params: Record<string, unknown>) {
    const url = new URL(window.location.href);
    const sp = new URLSearchParams(url.search);

    for (const [k, v] of Object.entries(params)) {
        if (v === null || v === undefined || v === "") sp.delete(k);
        else sp.set(k, String(v));
    }

    router.get(url.pathname + "?" + sp.toString(), {}, {
        preserveScroll: true,
    });
}

export function useFilters(serverFilters: Record<string, unknown>, filterParam = "filter") {
    const activeFilters = useMemo<ActiveFilters>(() => {
        const result: ActiveFilters = {};
        for (const [key, raw] of Object.entries(serverFilters)) {
            if (raw !== null && raw !== undefined && raw !== "") {
                result[key] = parseFilterParam(String(raw));
            }
        }
        return result;
    }, [serverFilters]);

    const setFilter = useCallback(
        (columnId: string, operator: string, values: string[]) => {
            if (values.length === 0) {
                navigate({ [`${filterParam}[${columnId}]`]: null, page: null });
                return;
            }
            navigate({
                [`${filterParam}[${columnId}]`]: `${operator}:${values.join(",")}`,
                page: null,
            });
        },
        [filterParam],
    );

    const clearFilter = useCallback((columnId: string) => {
        navigate({ [`${filterParam}[${columnId}]`]: null, page: null });
    }, [filterParam]);

    const clearAllFilters = useCallback(() => {
        const params: Record<string, unknown> = { page: null };
        const prefix = `${filterParam}[`;
        const url = new URL(window.location.href);
        for (const k of url.searchParams.keys()) {
            if (k.startsWith(prefix)) params[k] = null;
        }
        navigate(params);
    }, [filterParam]);

    return { activeFilters, setFilter, clearFilter, clearAllFilters };
}
