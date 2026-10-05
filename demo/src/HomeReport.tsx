import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Download,
  ExternalLink,
  Expand,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  Star,
  TrendingUp,
  X,
  Compass,
  Settings2,
  Route,
} from "lucide-react";
import {
  REPORTS,
  DOCUMENTS,
  canAccess,
  searchCatalog,
} from "./domain/catalog.mjs";
import {
  groupRecords,
  summarize,
  selectRecords,
  money,
  periodLabel,
  metricScope,
  REFRESHED_AT,
  VALID_UNTIL,
} from "./domain/data.mjs";
import {
  Button,
  Badge,
  PageHead,
  Empty,
  FiltersBar,
  BarChart,
  TrendChart,
  DataTable,
  Dialog,
  download,
  type Filters,
} from "./ui";
export type PageProps = {
  workspace: string;
  persona: string;
  filters: Filters;
  setFilters: (f: Filters) => void;
  navigate: (path: string) => void;
  save: (item: any) => boolean;
  favorite: (id: string) => void;
  favorites: string[];
  notify: (s: string) => void;
  emit: (name: string, params?: any, extra?: any) => void;
  experience?: any;
  recent?: any[];
};
export function ReportCard({ report, favorites, favorite, navigate }: any) {
  const totals: any = summarize();
  return (
    <article className="report-card">
      <div
        className={`report-preview ${report.source === "Looker" ? "teal-preview" : ""}`}
      >
        <div className="preview-heading">
          <span>
            {report.metric === "grossCents"
              ? "GROSS REVENUE"
              : report.metric === "creditsCents"
                ? "PERIOD CREDITS"
                : "NET REVENUE"}
          </span>
          <strong>{money(totals[report.metric], true)}</strong>
        </div>
        {report.metric === "creditsCents" ? (
          <BarChart
            compact
            rows={groupRecords({}, "creditReason")}
            metric={report.metric}
          />
        ) : (
          <TrendChart
            mini
            rows={groupRecords({ period: "All" }, "period")}
            metric={report.metric}
          />
        )}
      </div>
      <div className="report-card-body">
        <div className="spread">
          <Badge>{report.source}</Badge>
          <Button
            className={`icon-button ${favorites.includes(report.id) ? "is-favorite" : ""}`}
            aria-label={`${favorites.includes(report.id) ? "Unfavorite" : "Favorite"} ${report.title}`}
            onClick={() => favorite(report.id)}
          >
            <Star
              size={18}
              fill={favorites.includes(report.id) ? "currentColor" : "none"}
            />
          </Button>
        </div>
        <a
          className="card-title"
          href={`#/reports/${report.id}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/reports/${report.id}`);
          }}
        >
          {report.title}
          <ChevronRight size={18} />
        </a>
        <p>{report.description}</p>
        <div className="card-meta">
          {report.owner}
          <span>Sample · Sep 2026</span>
        </div>
      </div>
    </article>
  );
}
export function Home(props: PageProps) {
  const { workspace, navigate, experience = {}, persona } = props;
  const [query, setQuery] = useState("");
  const [guide, setGuide] = useState(() => {
    try {
      return sessionStorage.getItem("enterprise-iq:guide") !== "dismissed";
    } catch {
      return true;
    }
  });
  const visible = REPORTS.filter((r) => canAccess(r.id, persona));
  const featured = Array.isArray(experience.collectionResourceIds)
    ? visible.filter((r) => experience.collectionResourceIds.includes(r.id))
    : visible.filter(
        (r) => r.department === workspace || r.id === "sales-report",
      );
  return (
    <>
      <div className="home-intro">
        <p className="eyebrow">
          <span className="tiny-dot" />
          {workspace} workspace <span className="eyebrow-divider">/</span>{" "}
          September 2026 sample
        </p>
        <h1>
          Your reports, data, and
          <br className="desktop-break" /> business context—in one place.
        </h1>
        <p>
          Start with a question. Find the view that moves your work forward.
        </p>
        <form
          className="hero-search"
          onSubmit={(e) => {
            e.preventDefault();
            props.emit("search_submitted", { category: "all" });
            navigate(`/search?q=${encodeURIComponent(query)}`);
          }}
        >
          <Search size={22} />
          <input
            aria-label="Search reports, data, and knowledge"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports, data, and knowledge…"
          />
          <Button className="primary" type="submit">
            Search
            <ArrowRight size={16} />
          </Button>
        </form>
      </div>
      <section
        className={`home-featured ${experience.layout === "balanced" ? "balanced" : ""}`}
      >
        <div className="section-head">
          <div>
            <p className="eyebrow">A CLEARER VIEW</p>
            <h2>
              {experience.brandName && experience.brandName !== "Enterprise IQ"
                ? experience.brandName
                : `Featured for ${workspace}`}
            </h2>
          </div>
          <a href="#/reports">
            View all reports <ArrowRight size={16} />
          </a>
        </div>
        <div className="report-grid">
          {featured.length === 0 && (
            <Empty title="No featured reports selected">
              Open Reports to explore the permitted catalog, or choose featured
              resources in Experience Settings.
            </Empty>
          )}
          {featured.map((r) => (
            <ReportCard key={r.id} report={r} {...props} />
          ))}
        </div>
      </section>
      <section className="investigation-strip">
        <div className="investigation-icon">
          <TrendingUp size={26} />
        </div>
        <div>
          <p className="eyebrow">FOLLOW THE NUMBERS</p>
          <h2>Why do Finance and Sales show different revenue?</h2>
          <p>
            Trace September revenue from report to definition to supporting
            evidence.
          </p>
        </div>
        <Button
          className="primary"
          onClick={() => navigate("/reports/finance-report")}
        >
          Start investigation
          <ArrowRight size={17} />
        </Button>
      </section>
      <div className="home-bottom">
        <section className="panel quick-resources">
          <div className="section-head">
            <h2>Keep useful context close</h2>
            <BookOpen size={20} />
          </div>
          {DOCUMENTS.filter(
            (d) =>
              (
                experience.contextualDocumentIds ?? [
                  "revenue-definition",
                  "department-guide",
                ]
              ).includes(d.id) && canAccess(d.id, persona),
          ).map((d) => (
            <a href={`#/knowledge/${d.id}`} key={d.id}>
              <span>
                <strong>{d.title}</strong>
                <small>{d.source} sample · Business context</small>
              </span>
              <ChevronRight size={18} />
            </a>
          ))}
          <a href="#/my-workspace">
            <span>
              <strong>Your saved work</strong>
              <small>Views, investigations, and personal collections</small>
            </span>
            <ChevronRight size={18} />
          </a>
        </section>
        {guide && (
          <section className="panel demo-guide">
            <div className="section-head">
              <h2>
                <Compass size={20} />
                Explore the demo
              </h2>
              <Button
                className="icon-button"
                aria-label="Dismiss demo guide"
                onClick={() => {
                  setGuide(false);
                  try {
                    sessionStorage.setItem("enterprise-iq:guide", "dismissed");
                  } catch {}
                }}
              >
                <X size={17} />
              </Button>
            </div>
            <p>Three ways to see the workspace in action.</p>
            <a href="#/ask-iq">
              <span>01</span>Investigate a metric
              <ArrowRight size={16} />
            </a>
            <a href="#/settings">
              <span>02</span>Customize a workspace
              <Settings2 size={16} />
            </a>
            <a href="#/analytics">
              <span>03</span>Understand a user journey
              <Route size={16} />
            </a>
          </section>
        )}
      </div>
    </>
  );
}
export function Catalog(props: PageProps & { query?: string; all?: boolean }) {
  const initial = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const [text, setText] = useState(initial.get("q") ?? props.query ?? "");
  const [department, setDepartment] = useState(
    initial.get("department") ?? "All",
  );
  const [source, setSource] = useState(initial.get("source") ?? "All");
  const [advanced, setAdvanced] = useState(
    initial.has("department") || initial.has("source"),
  );
  const [mode, setMode] = useState(initial.get("view") ?? "grid");
  useEffect(() => {
    const q = new URLSearchParams();
    if (text) q.set("q", text);
    if (department !== "All") q.set("department", department);
    if (source !== "All") q.set("source", source);
    if (mode !== "grid") q.set("view", mode);
    history.replaceState(
      null,
      "",
      `${location.pathname}#/${props.all ? "search" : "reports"}${q.size ? "?" + q : ""}`,
    );
  }, [text, department, source, mode]);
  const results = searchCatalog(text, {
    persona: props.persona,
    department,
    source,
    kind: props.all ? "All" : "report",
  });
  useEffect(() => {
    if (props.query)
      props.emit("search_results_shown", {
        visible_count: results.length,
        coverage_complete: true,
      });
  }, []);
  const open = (r: any) =>
    props.navigate(
      r.kind === "report"
        ? `/reports/${r.id}`
        : r.kind === "document"
          ? `/knowledge/${r.id}`
          : `/data-explorer?template=${r.id}`,
    );
  return (
    <>
      <PageHead
        eyebrow="DISCOVER & EXPLORE"
        title={props.all ? "Search the workspace" : "Reports"}
        description="The right view, with the context to use it."
      />
      <div className="catalog-tools">
        <label className="search-input">
          <Search size={18} />
          <input
            aria-label="Search catalog"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                props.emit("search_submitted", {
                  category: props.all ? "all" : "reports",
                });
                props.emit("search_results_shown", {
                  visible_count: results.length,
                  coverage_complete: true,
                });
              }
            }}
            placeholder="Search by title, metric, or keyword"
          />
        </label>
        <Button
          onClick={() => {
            props.emit("search_submitted", {
              category: props.all ? "all" : "reports",
            });
            props.emit("search_results_shown", {
              visible_count: results.length,
              coverage_complete: true,
            });
          }}
        >
          Search
        </Button>
        <Button aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
          <SlidersHorizontal size={17} />
          Filters{department !== "All" || source !== "All" ? " · Active" : ""}
        </Button>
        <div className="segmented" aria-label="Catalog view">
          <Button
            aria-label="Grid view"
            aria-pressed={mode === "grid"}
            onClick={() => setMode("grid")}
          >
            <LayoutGrid size={17} />
          </Button>
          <Button
            aria-label="List view"
            aria-pressed={mode === "list"}
            onClick={() => setMode("list")}
          >
            <List size={17} />
          </Button>
        </div>
      </div>
      {advanced && (
        <div className="filter-bar">
          <label>
            Department
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {["All", "Finance", "Sales", "Operations"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {[
                "All",
                "Power BI",
                "Looker",
                "Snowflake",
                "Databricks",
                "Confluence",
                "SharePoint",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <Button
            onClick={() => {
              setText("");
              setSource("All");
              setDepartment("All");
            }}
          >
            Clear all
          </Button>
        </div>
      )}
      <p className="result-count">
        {results.length} {props.all ? "resources" : "reports"} · Sample refresh
        1 October 2026
      </p>
      {!results.length ? (
        <Empty title="No matching resources">
          Try “revenue”, choose another source, or clear your filters. Only
          resources permitted for the demo persona appear.
        </Empty>
      ) : (
        <div
          className={
            mode === "grid" ? "report-grid catalog-grid" : "resource-list"
          }
        >
          {results.map((r: any) =>
            r.kind === "report" && mode === "grid" ? (
              <ReportCard key={r.id} report={r} {...props} />
            ) : (
              <article className="resource-row" key={r.id}>
                <div>
                  <Badge>
                    {r.source} · {r.kind}
                  </Badge>
                  <button
                    className="text-button resource-title"
                    onClick={() => open(r)}
                  >
                    {r.title}
                    <ArrowRight size={16} />
                  </button>
                  <p>{r.description}</p>
                  <small>{r.owner}</small>
                </div>
                <Button
                  aria-label={`Favorite ${r.title}`}
                  onClick={() => props.favorite(r.id)}
                >
                  <Star
                    size={17}
                    fill={
                      props.favorites.includes(r.id) ? "currentColor" : "none"
                    }
                  />
                </Button>
              </article>
            ),
          )}
        </div>
      )}
    </>
  );
}
const tableColumns = [
  { key: "invoiceId", label: "Invoice" },
  { key: "region", label: "Region" },
  { key: "product", label: "Product" },
  { key: "grossCents", label: "Gross revenue", money: true },
  { key: "creditsCents", label: "Credits", money: true },
  { key: "netCents", label: "Net revenue", money: true },
];
export function ReportWorkspace(props: PageProps & { id: string }) {
  const { filters, setFilters, navigate, id, persona } = props;
  const currentPersona = useRef(persona);
  currentPersona.current = persona;
  const report = REPORTS.find((r) => r.id === id);
  const [tab, setTab] = useState(() => {
    const page = new URLSearchParams(location.hash.split("?")[1]).get("page");
    return page === "data"
      ? "Data table"
      : page === "details"
        ? report?.source === "Looker"
          ? "Channels & products"
          : "Credits detail"
        : page === "overview"
          ? "Overview"
          : props.experience?.savedViewDefault === "detail"
            ? "Data table"
            : "Overview";
  });
  const [focus, setFocus] = useState(false);
  const [context, setContext] = useState(false);
  const [native, setNative] = useState(false);
  if (!report || !canAccess(id, persona))
    return (
      <Empty title="Report unavailable">
        This link is unknown or unavailable for the selected demo persona.{" "}
        <a href="#/reports">Return to Reports</a>
      </Empty>
    );
  const total: any = summarize(filters);
  const records = selectRecords(filters);
  const groups = groupRecords(filters, report.dimension);
  const metric = report.metric;
  const heading =
    metric === "grossCents"
      ? "Gross revenue"
      : metric === "creditsCents"
        ? "Period credits"
        : "Net revenue";
  return (
    <div className={focus ? "report-focus" : ""}>
      <PageHead
        eyebrow={`${report.department.toUpperCase()} / REPORT WORKSPACE`}
        title={report.title}
        description={report.description}
        actions={
          <>
            <Button
              aria-pressed={props.favorites.includes(id)}
              onClick={() => props.favorite(id)}
            >
              <Star
                size={17}
                fill={props.favorites.includes(id) ? "currentColor" : "none"}
              />
              Favorite
            </Button>
            <Button
              onClick={() => {
                const saved = props.save({
                  id: `view-${Date.now()}`,
                  title: `${report.title} · ${periodLabel(filters.period)}`,
                  kind: "report",
                  route: `/reports/${id}?page=${tab === "Overview" ? "overview" : tab === "Data table" ? "data" : "details"}`,
                  filters,
                });
                if (saved) props.notify("Report view saved");
              }}
            >
              Save view
            </Button>
            <Button onClick={() => setFocus(!focus)}>
              <Expand size={17} />
              {focus ? "Exit focus" : "Focus view"}
            </Button>
          </>
        }
      />
      <div className="report-source">
        <Badge>{report.source} · Sample report</Badge>
        <span>{report.owner}</span>
        <span>Sample refresh · 1 Oct 2026</span>
      </div>
      <FiltersBar
        filters={filters}
        onChange={(f) => {
          setFilters(f);
          props.emit(
            "report_interaction",
            { interaction_kind: "filters_changed" },
            {
              source_system: report.source === "Looker" ? "looker" : "power-bi",
            },
          );
        }}
      />
      <div className="report-tabs">
        <div className="tabs" role="tablist" aria-label="Report pages">
          {[
            "Overview",
            report.source === "Looker"
              ? "Channels & products"
              : "Credits detail",
            "Data table",
          ].map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                history.replaceState(
                  null,
                  "",
                  `${location.pathname}#/reports/${id}?page=${t === "Overview" ? "overview" : t === "Data table" ? "data" : "details"}`,
                );
                props.emit(
                  "report_page_changed",
                  {},
                  {
                    source_system:
                      report.source === "Looker" ? "looker" : "power-bi",
                  },
                );
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <Button
          className="text-button"
          onClick={() => setContext(!context)}
          aria-expanded={context}
        >
          <BookOpen size={16} />
          Context & definitions
        </Button>
      </div>
      {context && (
        <div className="context-panel">
          <div>
            <strong>Understand this view</strong>
            <p>
              {periodLabel(filters.period)} · USD · US entity · Posted
              transactions
            </p>
          </div>
          <a href="#/knowledge/revenue-definition">
            Gross vs. net revenue
            <ArrowRight size={15} />
          </a>
          <a href="#/knowledge/refresh-lineage">
            Ownership & refresh
            <ArrowRight size={15} />
          </a>
          <Button
            className="icon-button"
            onClick={() => setContext(false)}
            aria-label="Close report context"
          >
            <X size={17} />
          </Button>
        </div>
      )}
      <div
        className={`report-canvas ${report.source === "Looker" ? "looker-canvas" : ""}`}
      >
        <div className="canvas-heading">
          <div>
            <p className="eyebrow">
              {periodLabel(filters.period)} ·{" "}
              {filters.region === "All"
                ? "ALL REGIONS"
                : filters.region.toUpperCase()}
            </p>
            <h2>{tab === "Overview" ? "Performance at a glance" : tab}</h2>
          </div>
          <span className="sample-pill">USD · Sample data</span>
        </div>
        <div className="metric-grid">
          <div className="metric primary-metric">
            <span>{heading}</span>
            <strong>{money(total[metric])}</strong>
            <small>
              {metric === "netCents"
                ? "Gross less posted credits"
                : metric === "grossCents"
                  ? "Before posted credits"
                  : "Posted in selected period"}
            </small>
          </div>
          <div className="metric">
            <span>
              {metric === "grossCents" ? "Net revenue" : "Gross revenue"}
            </span>
            <strong>
              {money(
                metric === "grossCents" ? total.netCents : total.grossCents,
              )}
            </strong>
            <small>Same period and filters</small>
          </div>
          <div className="metric">
            <span>Credit rate</span>
            <strong>
              {total.creditRate === null
                ? "Not available"
                : `${(total.creditRate * 100).toFixed(1)}%`}
            </strong>
            <small>{money(total.creditsCents)} in period credits</small>
          </div>
          <div className="metric">
            <span>Underlying records</span>
            <strong>{total.rowCount}</strong>
            <small>
              {filters.product === "All"
                ? "All product categories"
                : filters.product}
            </small>
          </div>
        </div>
        {tab === "Overview" ? (
          <div className="chart-grid">
            <section className="chart-panel">
              <div className="section-head">
                <h3>
                  {heading} by{" "}
                  {report.dimension === "creditReason"
                    ? "credit reason"
                    : report.dimension}
                </h3>
                <Badge>Selected month</Badge>
              </div>
              <BarChart
                rows={groups}
                metric={metric}
                onSelect={
                  report.dimension === "region" ||
                  report.dimension === "product"
                    ? (name) =>
                        setFilters({ ...filters, [report.dimension]: name })
                    : undefined
                }
              />
              <p className="chart-footnote">
                {["region", "product"].includes(report.dimension)
                  ? "Select a bar to filter this report."
                  : "All posted adjustment reasons in the selected scope."}
              </p>
            </section>
            <section className="chart-panel">
              <div className="section-head">
                <h3>Four-month trend</h3>
                <span className="legend">
                  <i />
                  {heading}
                </span>
              </div>
              <TrendChart
                rows={groupRecords({ ...filters, period: "All" }, "period")}
                metric={metric}
              />
              <details className="chart-data">
                <summary>View monthly values</summary>
                <DataTable
                  rows={groupRecords({ ...filters, period: "All" }, "period")}
                  columns={[
                    { key: "name", label: "Month" },
                    { key: metric, label: heading, money: true },
                  ]}
                />
              </details>
            </section>
          </div>
        ) : tab === "Data table" ? (
          <DataTable rows={records} columns={tableColumns} />
        ) : (
          <>
            <div className="chart-grid">
              <section className="chart-panel">
                <h3>
                  {report.source === "Looker"
                    ? "Gross revenue by channel"
                    : "Credits by reason"}
                </h3>
                <BarChart
                  rows={groupRecords(
                    filters,
                    report.source === "Looker" ? "channel" : "creditReason",
                  )}
                  metric={
                    report.source === "Looker" ? "grossCents" : "creditsCents"
                  }
                />
              </section>
              <section className="chart-panel">
                <h3>
                  {report.source === "Looker"
                    ? "Product contribution"
                    : "Follow the credit evidence"}
                </h3>
                {report.source === "Looker" ? (
                  <BarChart
                    rows={groupRecords(filters, "product")}
                    metric="grossCents"
                    onSelect={(product) => setFilters({ ...filters, product })}
                  />
                ) : (
                  <div className="credit-explanation">
                    <strong>
                      {money(total.grossCents)} − {money(total.creditsCents)}
                    </strong>
                    <p>
                      Gross revenue less posted period credits gives{" "}
                      <b>{money(total.netCents)}</b> net revenue.
                    </p>
                    <Button
                      className="primary"
                      onClick={() =>
                        navigate("/data-explorer?template=credits-by-period")
                      }
                    >
                      Inspect credits query
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                )}
              </section>
            </div>
            <DataTable
              rows={records}
              columns={[
                { key: "creditId", label: "Credit ID" },
                { key: "creditReason", label: "Reason" },
                { key: "product", label: "Product" },
                { key: "creditsCents", label: "Credit amount", money: true },
              ]}
            />
          </>
        )}
        <footer className="canvas-footer">
          <span>
            Original interactive simulation · {report.source} is a target
            adapter
          </span>
          <Button className="text-button" onClick={() => setNative(true)}>
            <ExternalLink size={15} />
            Native source
          </Button>
        </footer>
      </div>
      <div className="report-actions">
        <Button
          onClick={async () => {
            const { createQueryCsv, safeFilename } =
              await import("./domain/index.mjs");
            if (!canAccess(id, currentPersona.current)) {
              props.notify("Export unavailable for this persona");
              return;
            }
            const definitions: any = {
              grossCents: { id: "gross-revenue", version: "1" },
              creditsCents: { id: "period-credits", version: "1" },
              netCents: { id: "net-revenue", version: "2" },
            };
            const output = {
              status: "available",
              rows: records,
              columns: tableColumns.map((c) => ({
                name: c.key,
                ...(definitions[c.key]
                  ? {
                      definition: definitions[c.key],
                      unit: "currency-minor-unit",
                    }
                  : {}),
              })),
              coverage: "complete",
              truncated: false,
              contract: {
                ...metricScope(filters),
                definition: definitions[report.metric],
                freshness: {
                  refreshedAt: REFRESHED_AT,
                  validUntil: VALID_UNTIL,
                },
                provenance: {
                  platform: report.source,
                  fixtureId: report.id,
                  version: "synthetic-2026-10-01",
                },
              },
            };
            download(
              safeFilename(
                `${id}-${filters.period}-${filters.region}-${filters.product}`,
              ),
              createQueryCsv(output),
            );
            props.notify("Selected sample records exported");
          }}
        >
          <Download size={17} />
          Export selected data
        </Button>
        <Button onClick={() => window.print()}>Print report</Button>
        <a href="#/knowledge/revenue-definition">
          Read the metric definition
          <ArrowRight size={16} />
        </a>
        <a href="#/ask-iq">
          Explain with Ask IQ
          <ArrowRight size={16} />
        </a>
      </div>
      {native && (
        <Dialog
          title="About native source access"
          onClose={() => setNative(false)}
        >
          <p>
            This report runs entirely inside this reference demo. Opening a real{" "}
            {report.source} report requires a separately configured live adapter
            and source authorization.
          </p>
          <p>No enterprise tenant is connected.</p>
          <Button
            className="primary"
            onClick={() => {
              setNative(false);
              navigate("/sources");
            }}
          >
            View source directory
          </Button>
        </Dialog>
      )}
    </div>
  );
}
