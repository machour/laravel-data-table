import { router, usePage } from "@inertiajs/react";
import { useCallback, useMemo } from "react";
import { resolvePageUrl } from "../data-table/runtime";
import type { ActiveFilters, FilterValue } from "./types";

function parseFilterParam(raw: string): FilterValue {
    const match = raw.match(/^([a-z_]+):(.+)$/i);
    if (match) {
        return { operator: match[1], values: match[2].split(",") };
    }
    return { operator: "", values: raw.split(",") };
}

function navigate(pageUrl: string, params: Record<string, unknown>) {
    const url = resolvePageUrl(pageUrl);
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
    const pageUrl = usePage().url;
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
                navigate(pageUrl, {
                    [`${filterParam}[${columnId}]`]: null,
                    page: null,
                });
                return;
            }
            navigate(pageUrl, {
                [`${filterParam}[${columnId}]`]: `${operator}:${values.join(",")}`,
                page: null,
            });
        },
        [filterParam, pageUrl],
    );

    const clearFilter = useCallback((columnId: string) => {
        navigate(pageUrl, {
            [`${filterParam}[${columnId}]`]: null,
            page: null,
        });
    }, [filterParam, pageUrl]);

    const clearAllFilters = useCallback(() => {
        const params: Record<string, unknown> = { page: null };
        const prefix = `${filterParam}[`;
        const url = resolvePageUrl(pageUrl);
        for (const k of url.searchParams.keys()) {
            if (k.startsWith(prefix)) params[k] = null;
        }
        navigate(pageUrl, params);
    }, [filterParam, pageUrl]);

    return { activeFilters, setFilter, clearFilter, clearAllFilters };
}
