"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, ExternalLink } from "lucide-react";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  flexRender,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  useTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/table-core";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { money, moneyShort, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StoreRow } from "@/lib/api";

/**
 * v9 puts the row models and fn registries inside `features`, and every typed
 * helper is parameterised by that object — which is why it is declared once,
 * at module scope, and reused for both the column helper and the table.
 */
const features = {
  rowSortingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  filterFns: { includesString: filterFn_includesString },
};

const helper = createColumnHelper<typeof features, StoreRow>();

// Which columns hold a number. TanStack v9 carries column `meta` through to the
// header and the cell, but reading one literal set here is shorter than
// threading a typed meta shape through both render paths.
const RIGHT = new Set(["matched", "catalogue", "avg", "median"]);
const right = (id: string) => RIGHT.has(id);

// `any` for TValue is TanStack's own documented escape hatch: a heterogeneous
// column array cannot be given one concrete cell type, and without it every
// accessor widens the array to an unusable union.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columns: ColumnDef<typeof features, StoreRow, any>[] = [
  helper.accessor("domain", {
    header: "Store",
    sortFn: "alphanumeric",
    cell: (context) => (
      <span className="flex items-center gap-2 font-semibold text-foreground">
        {context.getValue()}
        <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
      </span>
    ),
  }),
  helper.accessor("matched", {
    header: "In niche",
    sortFn: "basic",
    cell: (context) => (
      <span className="tabular font-medium">{num(context.getValue())}</span>
    ),
  }),
  helper.accessor("catalogue", {
    header: "Whole catalogue",
    sortFn: "basic",
    cell: (context) => (
      <span className="tabular text-muted-foreground">
        {num(context.getValue())}
      </span>
    ),
  }),
  helper.accessor((row) => row.min_price ?? 0, {
    id: "band",
    header: "Price band",
    sortFn: "basic",
    cell: (context) => {
      const row = context.row.original;
      if (row.min_price == null) {
        return <span className="text-muted-foreground">—</span>;
      }
      return (
        <span className="pill">
          {moneyShort(row.min_price)} – {moneyShort(row.max_price)}
        </span>
      );
    },
  }),
  helper.accessor((row) => row.avg_price ?? 0, {
    id: "avg",
    header: "Avg price in niche",
    sortFn: "basic",
    cell: (context) => (
      <span className="tabular font-medium">
        {money(context.row.original.avg_price)}
      </span>
    ),
  }),
  helper.accessor((row) => row.median_price ?? 0, {
    id: "median",
    header: "Store median",
    sortFn: "basic",
    cell: (context) => (
      <span className="tabular text-muted-foreground">
        {money(context.row.original.median_price)}
      </span>
    ),
  }),
];

/**
 * `compact` caps the visible rows on the niche overview, where the table is the
 * last of four sections rather than the whole screen. It clips the rendered
 * rows only — sorting and filtering still run over the full set.
 */
export function StoreTable({
  rows,
  compact = false,
}: {
  rows: StoreRow[] | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const data = useMemo(() => rows ?? [], [rows]);

  const table = useTable({
    data,
    columns,
    features,
    globalFilterFn: "includesString",
    state: { globalFilter: filter },
    onGlobalFilterChange: setFilter,
    initialState: { sorting: [{ id: "matched", desc: true }] },
  });

  if (!rows) {
    return (
      <div className="panel overflow-hidden">
        <div className="border-b border-[hsl(var(--grid))] px-5 py-3.5">
          <Skeleton className="h-9 w-72" />
        </div>
        {Array.from({ length: compact ? 8 : 12 }).map((_, index) => (
          <Skeleton key={index} className="mx-5 my-[18px] h-4" />
        ))}
      </div>
    );
  }

  const matched = table.getRowModel().rows;
  const visible = compact ? matched.slice(0, 10) : matched;

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[hsl(var(--grid))] px-5 py-3.5">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by domain…"
          className="h-9 max-w-xs bg-white text-[14px]"
        />
        <p className="text-[13px] tabular text-muted-foreground">
          {compact && matched.length > visible.length
            ? `Top ${num(visible.length)} of ${num(matched.length)} stores`
            : `${num(visible.length)} of ${num(rows.length)} stores`}
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="border-[hsl(var(--grid))] hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const Icon =
                    sorted === "asc"
                      ? ArrowUp
                      : sorted === "desc"
                        ? ArrowDown
                        : ChevronsUpDown;
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-11 whitespace-nowrap px-5",
                        right(header.column.id) && "text-right"
                      )}
                    >
                      <button
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:text-foreground",
                          right(header.column.id) && "ml-auto flex-row-reverse",
                          sorted && "text-foreground"
                        )}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        <Icon
                          className={cn(
                            "h-3 w-3",
                            sorted ? "opacity-100" : "opacity-30"
                          )}
                        />
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-40 text-center text-sm text-muted-foreground"
                >
                  No store matches that filter.
                </TableCell>
              </TableRow>
            )}
            {visible.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => router.push(`/stores/${row.original.id}`)}
                className="group cursor-pointer border-[hsl(var(--grid))] hover:bg-[hsl(var(--hover))]"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "h-[52px] whitespace-nowrap px-5 py-0 text-[14px]",
                      right(cell.column.id) && "text-right"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
