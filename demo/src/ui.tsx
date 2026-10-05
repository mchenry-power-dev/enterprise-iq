import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import {
  money,
  PERIODS,
  REGIONS,
  PRODUCTS,
  periodLabel,
} from "./domain/data.mjs";
export type Filters = {
  period: string;
  entity: string;
  region: string;
  product: string;
};
export const defaultFilters: Filters = {
  period: "2026-09",
  entity: "aster-us",
  region: "All",
  product: "All",
};
export function Button({
  children,
  className = "",
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`button ${className}`}
      {...props}
      onClick={(event) => {
        event.currentTarget.focus();
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Search size={28} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function PageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="lede">{description}</p>}
      </div>
      {actions && <div className="toolbar">{actions}</div>}
    </div>
  );
}
export function FiltersBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  return (
    <div className="filter-bar">
      <label>
        Reporting period
        <select
          value={filters.period}
          onChange={(e) => onChange({ ...filters, period: e.target.value })}
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {periodLabel(p)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Region
        <select
          value={filters.region}
          onChange={(e) => onChange({ ...filters, region: e.target.value })}
        >
          <option>All</option>
          {REGIONS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Product
        <select
          value={filters.product}
          onChange={(e) => onChange({ ...filters, product: e.target.value })}
        >
          <option>All</option>
          {PRODUCTS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <div className="filter-context">
        Aster Manufacturing US
        <br />
        <span>USD · Posted transactions</span>
      </div>
      <Button onClick={() => onChange(defaultFilters)}>Reset filters</Button>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <Button aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function download(
  filename: string,
  content: string,
  type = "text/csv;charset=utf-8",
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export type Column = { key: string; label: string; money?: boolean };
export function DataTable({
  rows,
  columns,
  caption = "Underlying sample data",
  pageSize = 8,
}: {
  rows: any[];
  columns: Column[];
  caption?: string;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState({ key: "", desc: false });
  useEffect(() => setPage(0), [rows]);
  const sorted = [...rows].sort((a, b) => {
    let v =
      typeof a[sort.key] === "number"
        ? a[sort.key] - b[sort.key]
        : String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""));
    return sort.desc ? -v : v;
  });
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  return (
    <>
      <div className="table-wrap">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    sort.key === c.key
                      ? sort.desc
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    onClick={() =>
                      setSort({
                        key: c.key,
                        desc: sort.key === c.key && !sort.desc,
                      })
                    }
                  >
                    {c.label}
                    <ArrowUpDown size={13} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted
              .slice(page * pageSize, (page + 1) * pageSize)
              .map((r, i) => (
                <tr key={r.id ?? i}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      {r[c.key] === null || r[c.key] === undefined
                        ? "Not available"
                        : c.money
                          ? money(r[c.key])
                          : String(r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <Empty title="No matching records">
            Try a different reporting period or clear your filters.
          </Empty>
        )}
      </div>
      <div className="pagination">
        <span>
          {rows.length} rows · Page {Math.min(page + 1, pages)} of {pages}
        </span>
        <div className="toolbar">
          <Button
            aria-label="Previous page"
            disabled={!page}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            aria-label="Next page"
            disabled={page + 1 >= pages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </>
  );
}
export function BarChart({
  rows,
  metric = "netCents",
  onSelect,
  compact = false,
}: {
  rows: any[];
  metric?: string;
  onSelect?: (name: string) => void;
  compact?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r[metric]));
  return (
    <div
      className={`bar-chart ${compact ? "compact" : ""}`}
      role="group"
      aria-label={`${metric === "grossCents" ? "Gross" : metric === "creditsCents" ? "Credits" : "Net"} revenue chart`}
    >
      {rows.map((r, i) => (
        <button
          key={r.name}
          className="bar-row"
          disabled={!onSelect}
          onClick={() => onSelect?.(r.name)}
          title={`${r.name}: ${money(r[metric])}`}
        >
          <span className="bar-name">{r.name}</span>
          <span className="bar-track">
            <span
              className={`bar-fill tone-${i % 4}`}
              style={{ width: `${Math.max(1, (r[metric] / max) * 100)}%` }}
            />
          </span>
          <strong>{money(r[metric], compact)}</strong>
        </button>
      ))}
    </div>
  );
}
export function TrendChart({
  rows,
  metric = "netCents",
  mini = false,
}: {
  rows: any[];
  metric?: string;
  mini?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r[metric]));
  const coords = rows.map(
    (r, i) => `${30 + i * 140},${155 - (r[metric] / max) * 115}`,
  );
  return (
    <div className={`trend-chart ${mini ? "mini" : ""}`}>
      <svg
        viewBox="0 0 480 190"
        role="img"
        aria-label={`Monthly ${metric === "grossCents" ? "gross" : "net"} revenue: ${rows.map((r) => `${r.name} ${money(r[metric])}`).join(", ")}`}
      >
        <defs>
          <linearGradient
            id={`fade-${metric}-${mini}`}
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="currentColor" stopOpacity=".16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 95, 155].map((y) => (
          <line
            key={y}
            x1="30"
            y1={y}
            x2="450"
            y2={y}
            stroke="#e5eaf0"
            strokeDasharray="4 5"
          />
        ))}
        <polygon
          points={`30,155 ${coords.join(" ")} 450,155`}
          fill={`url(#fade-${metric}-${mini})`}
        />
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {rows.map((r, i) => (
          <g key={r.name}>
            <circle
              cx={30 + i * 140}
              cy={155 - (r[metric] / max) * 115}
              r="4"
              fill="white"
              stroke="currentColor"
              strokeWidth="2"
            >
              <title>
                {r.name}: {money(r[metric])}
              </title>
            </circle>
            <text
              x={30 + i * 140}
              y="182"
              textAnchor="middle"
              fill="#58677b"
              fontSize="12"
            >
              {r.name.slice(5) === "06"
                ? "Jun"
                : r.name.slice(5) === "07"
                  ? "Jul"
                  : r.name.slice(5) === "08"
                    ? "Aug"
                    : "Sep"}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
