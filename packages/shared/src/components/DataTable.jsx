import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cx, formatNumber } from "../utils/format.js";
import { Skeleton, EmptyState, ErrorState } from "./Feedback.jsx";

/**
 * Data table with sortable headers, skeleton loading, empty/error states and a
 * horizontally scrollable wrapper for small screens.
 *
 * columns: [{ key, header, render?(row), sortable?, sortValue?(row), align?, width?, className?, hideOnMobile? }]
 * Sorting is client-side unless `onSortChange` is provided (server-side).
 */
export function DataTable({
  columns,
  rows,
  rowKey = "id",
  loading = false,
  error,
  onRetry,
  empty = {},
  sort: controlledSort,
  onSortChange,
  defaultSort,
  onRowClick,
  rowClassName,
  compact,
  caption,
  skeletonRows = 6,
}) {
  const [localSort, setLocalSort] = useState(defaultSort || null);
  const sort = onSortChange ? controlledSort : localSort;

  const sortedRows = useMemo(() => {
    if (!rows || onSortChange || !sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const getter = col.sortValue || ((r) => r[col.key]);
    const factor = sort.dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = getter(a);
      const vb = getter(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true })) * factor;
    });
  }, [rows, sort, columns, onSortChange]);

  const toggleSort = (key) => {
    const next = sort?.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
    if (onSortChange) onSortChange(next);
    else setLocalSort(next);
  };

  const initial = loading && !rows;
  const refreshing = loading && Boolean(rows);

  return (
    <div className="table-wrap" style={refreshing ? { opacity: 0.6, transition: "opacity 180ms" } : undefined} aria-busy={loading || undefined}>
      <table className={cx("table", compact && "table-compact")}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const SortIcon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={cx(c.align && `align-${c.align}`, c.hideOnMobile && "hide-sm", c.headerClassName)}
                  style={c.width ? { width: c.width } : undefined}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : c.sortable ? "none" : undefined}
                >
                  {c.sortable ? (
                    <button type="button" className={cx("th-sort", active && "is-active")} onClick={() => toggleSort(c.key)}>
                      {c.header}
                      <SortIcon aria-hidden="true" />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {initial &&
            Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={`sk-${i}`}>
                {columns.map((c, j) => (
                  <td key={c.key} className={cx(c.hideOnMobile && "hide-sm")}>
                    <Skeleton height={14} width={j === 0 ? "70%" : `${45 + ((i * 7 + j * 13) % 40)}%`} />
                  </td>
                ))}
              </tr>
            ))}
          {!initial && error && (
            <tr>
              <td colSpan={columns.length}>
                <ErrorState error={error} onRetry={onRetry} compact />
              </td>
            </tr>
          )}
          {!initial && !error && sortedRows?.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: 0 }}>
                <EmptyState icon={empty.icon || Inbox} title={empty.title || "Nothing here yet"} description={empty.description} action={empty.action} compact />
              </td>
            </tr>
          )}
          {!initial &&
            !error &&
            sortedRows?.map((row, i) => (
              <tr
                key={typeof rowKey === "function" ? rowKey(row) : row[rowKey] ?? i}
                className={cx(onRowClick && "is-clickable", rowClassName?.(row))}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cx(c.align && `align-${c.align}`, c.hideOnMobile && "hide-sm", c.className)}>
                    {c.render ? c.render(row) : row[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function pageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2) [totalPages - 1, totalPages - 2, totalPages - 3].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…" + p);
    out.push(p);
  });
  return out;
}

export function Pagination({ pagination, onPageChange, label = "results" }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, pageSize, total, totalPages } = pagination;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination-info">
        Showing <strong>{formatNumber(from)}</strong>–<strong>{formatNumber(to)}</strong> of <strong>{formatNumber(total)}</strong> {label}
      </p>
      {totalPages > 1 && (
        <div className="pagination-pages">
          <button type="button" className="page-btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft aria-hidden="true" />
          </button>
          {pageList(page, totalPages).map((p) =>
            typeof p === "string" ? (
              <span key={p} className="page-ellipsis" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={cx("page-btn page-num", p === page && "is-current")}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
              >
                {p}
              </button>
            )
          )}
          <button type="button" className="page-btn" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
