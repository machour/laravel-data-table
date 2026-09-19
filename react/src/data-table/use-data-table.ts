import { router, usePage } from "@inertiajs/react";
import {
    type ColumnDef,
    type ColumnFiltersState,
    type ColumnOrderState,
    type ColumnVisibilityState,
  type ExpandedState,
    type RowSelectionState,
    type RowData,
    type SortingState,
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  readBrowserStorage,
  resolvePageUrl,
  writeBrowserStorage,
} from "./runtime";
import type { DataTableColumnDef, DataTableResponse } from "./types";

const STORAGE_PREFIX = "dt-columns-";
const ORDER_STORAGE_PREFIX = "dt-column-order-";
const EXPANDED_STORAGE_PREFIX = "dt-expanded-";

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
});

export type DataTableFeatures = typeof dataTableFeatures;

function loadExpanded(tableName: string): ExpandedState {
  const stored = readBrowserStorage(
    "sessionStorage",
    EXPANDED_STORAGE_PREFIX + tableName,
  );
  if (stored) {
    try {
      return JSON.parse(stored) as ExpandedState;
    } catch {
      // fall through
    }
  }

  return {};
}

function saveExpanded(tableName: string, expanded: ExpandedState) {
  writeBrowserStorage(
    "sessionStorage",
    EXPANDED_STORAGE_PREFIX + tableName,
    JSON.stringify(expanded),
  );
}

function defaultVisibility(columns: DataTableColumnDef[]): ColumnVisibilityState {
    const visibility: ColumnVisibilityState = {};
    for (const col of columns) {
        visibility[col.id] = col.visible;
    }
    return visibility;
}

function loadVisibility(
  tableName: string,
  columns: DataTableColumnDef[],
): ColumnVisibilityState {
    const stored = readBrowserStorage(
      "localStorage",
      STORAGE_PREFIX + tableName,
    );
    if (stored) {
        try {
            return JSON.parse(stored) as ColumnVisibilityState;
        } catch {
            // fall through
        }
    }
    return defaultVisibility(columns);
}

function saveVisibility(tableName: string, visibility: ColumnVisibilityState) {
    writeBrowserStorage(
      "localStorage",
      STORAGE_PREFIX + tableName,
      JSON.stringify(visibility),
    );
}

function loadColumnOrder(
  tableName: string,
  columns: DataTableColumnDef[],
): ColumnOrderState {
    const stored = readBrowserStorage(
      "localStorage",
      ORDER_STORAGE_PREFIX + tableName,
    );
    if (stored) {
        try {
            return JSON.parse(stored) as ColumnOrderState;
        } catch {
            // fall through
        }
    }
    return columns.map((col) => col.id);
}

function saveColumnOrder(tableName: string, order: ColumnOrderState) {
    writeBrowserStorage(
      "localStorage",
      ORDER_STORAGE_PREFIX + tableName,
      JSON.stringify(order),
    );
}

interface UseDataTableOptions<TData extends RowData> {
    tableData: DataTableResponse<TData>;
    tableName: string;
    columnDefs: ColumnDef<DataTableFeatures, TData>[];
  expansionKey?: string;
  expansionEnabled?: boolean;
}

export function useDataTable<TData extends RowData>({
  tableData,
  tableName,
  columnDefs,
  expansionKey,
  expansionEnabled = false,
}: UseDataTableOptions<TData>) {
    const { meta } = tableData;
  const pageUrl = usePage().url;
  const columnsRef = useRef(tableData.columns);
  const columnDefsRef = useRef(columnDefs);
  columnsRef.current = tableData.columns;
  columnDefsRef.current = columnDefs;

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(
    () => defaultVisibility(tableData.columns),
    );

    const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() =>
    withSystemColumns(
        tableData.columns.map((column) => column.id),
      columnDefs,
    ),
    );

    const [sorting, setSorting] = useState<SortingState>(() =>
        meta.sorts.map((s) => ({ id: s.id, desc: s.direction === "desc" })),
    );

    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [hydratedTableName, setHydratedTableName] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setColumnVisibility(loadVisibility(tableName, columnsRef.current));
    setColumnOrder(
      withSystemColumns(
        loadColumnOrder(tableName, columnsRef.current),
        columnDefsRef.current,
      ),
    );
    setExpanded(loadExpanded(tableName));
    setHydratedTableName(tableName);
  }, [tableName]);

  const handleExpandedChange = useCallback(
    (updater: ExpandedState | ((current: ExpandedState) => ExpandedState)) => {
      setExpanded((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        saveExpanded(tableName, next);

        return next;
      });
    },
    [tableName],
  );

  const navigate = useCallback(
    (params: Record<string, unknown>, replace = false) => {
      const currentUrl = resolvePageUrl(pageUrl);
      const searchParams = new URLSearchParams(currentUrl.search);

      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined || value === "") {
          searchParams.delete(key);
        } else {
          searchParams.set(key, String(value));
        }
      }

      router.get(
        currentUrl.pathname + "?" + searchParams.toString(),
        {},
        { preserveScroll: true, replace },
      );
    },
    [pageUrl],
  );

    const handleSort = useCallback(
        (columnId: string, multi: boolean) => {
            const currentSorts = meta.sorts;

            if (multi) {
                const newSorts = [...currentSorts];
                const idx = newSorts.findIndex((s) => s.id === columnId);
                if (idx === -1) {
                    newSorts.push({ id: columnId, direction: "asc" });
                } else if (newSorts[idx].direction === "asc") {
                    newSorts[idx] = { ...newSorts[idx], direction: "desc" };
                } else {
                    newSorts.splice(idx, 1);
                }
                const param = newSorts
                    .map((s) => (s.direction === "desc" ? `-${s.id}` : s.id))
                    .join(",");
                navigate({ sort: param || null, page: null });
            } else {
                const existing = currentSorts.find((s) => s.id === columnId);
                let newSort: string | null;
                if (existing?.direction === "asc") {
                    newSort = "-" + columnId;
                } else if (existing?.direction === "desc") {
                    newSort = null;
                } else {
                    newSort = columnId;
                }
                navigate({ sort: newSort, page: null });
            }
        },
        [meta.sorts, navigate],
    );

    const handlePageChange = useCallback(
        (page: number) => {
            navigate({ page: page > 1 ? page : null });
        },
        [navigate],
    );

    const handlePerPageChange = useCallback(
        (perPage: number) => {
            navigate({ per_page: perPage, page: null });
        },
        [navigate],
    );

    const handleApplyQuickView = useCallback(
        (params: Record<string, unknown>) => {
            const currentUrl = resolvePageUrl(pageUrl);
            const searchParams = new URLSearchParams();

            for (const [key, value] of Object.entries(params)) {
                if (value !== null && value !== undefined && value !== "") {
                    searchParams.set(key, String(value));
                }
            }

            const perPage = currentUrl.searchParams.get("per_page");
            if (perPage) {
                searchParams.set("per_page", perPage);
            }

            router.get(
                currentUrl.pathname + "?" + searchParams.toString(),
                {},
                { preserveScroll: true },
            );
        },
        [pageUrl],
    );

    const applyColumns = useCallback(
        (columnIds: string[]) => {
            const newVisibility: ColumnVisibilityState = {};
            for (const col of tableData.columns) {
                newVisibility[col.id] = columnIds.includes(col.id);
            }
            setColumnVisibility(newVisibility);
      setColumnOrder(withSystemColumns(columnIds, columnDefs));
        },
    [columnDefs, tableData.columns],
    );

    const table = useTable({
        features: dataTableFeatures,
        data: tableData.data,
        columns: columnDefs,
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        pageCount: meta.lastPage,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onColumnOrderChange: setColumnOrder,
        onRowSelectionChange: setRowSelection,
    onExpandedChange: handleExpandedChange,
        enableRowSelection: true,
    getRowCanExpand: () => expansionEnabled,
    getRowId: expansionKey
      ? (row) =>
          String((row as unknown as Record<string, unknown>)[expansionKey])
      : undefined,
    manualExpanding: true,
        initialState: {
            columnPinning: {
        start: ["_expand", "_select"].filter((id) =>
          columnDefs.some((column) => column.id === id),
        ),
                end: columnDefs.some((c) => c.id === "_actions") ? ["_actions"] : [],
            },
        },
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            columnOrder,
            rowSelection,
      expanded,
            pagination: {
                pageIndex: meta.currentPage - 1,
                pageSize: meta.perPage,
            },
        },
    });

    useEffect(() => {
      if (hydratedTableName !== tableName) return;
        saveVisibility(tableName, columnVisibility);
    }, [hydratedTableName, tableName, columnVisibility]);

    useEffect(() => {
      if (hydratedTableName !== tableName) return;
        saveColumnOrder(tableName, columnOrder);
    }, [hydratedTableName, tableName, columnOrder]);

  const handleApplyCustomSearch = useCallback((search: string) => {
    const currentUrl = resolvePageUrl(pageUrl);
    router.get(currentUrl.pathname + search, {}, { preserveScroll: true });
  }, [pageUrl]);

  const handleGlobalSearch = useCallback(
    (search: string) => {
      navigate(
        {
          [meta.globalSearchParam ?? "search"]: search.trim() || null,
          page: null,
        },
        true,
      );
    },
    [meta.globalSearchParam, navigate],
  );

    return {
        table,
        meta,
        columnVisibility,
        columnOrder,
        setColumnOrder,
        rowSelection,
    expanded,
        setRowSelection,
        applyColumns,
        handleSort,
        handlePageChange,
        handlePerPageChange,
        handleApplyQuickView,
        handleApplyCustomSearch,
        handleGlobalSearch,
    };
}

function withSystemColumns<TData extends RowData>(
  order: ColumnOrderState,
  columnDefs: ColumnDef<DataTableFeatures, TData>[],
): ColumnOrderState {
  const available = new Set(
    columnDefs
      .map((column) => String(column.id ?? ""))
      .filter((id) => id.startsWith("_")),
  );
  const dataColumns = order.filter((id) => !id.startsWith("_"));
  const leading = ["_expand", "_select"].filter((id) => available.has(id));
  const trailing = ["_actions"].filter((id) => available.has(id));

  return [...leading, ...dataColumns, ...trailing];
}
