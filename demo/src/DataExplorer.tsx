import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Code2,
  Download,
  History,
  Play,
  Save,
  Square,
  Table2,
  BarChart3,
} from "lucide-react";
import { QUERY_DEFINITIONS, canAccess } from "./domain/catalog.mjs";
import {
  createDemoQuerySession,
  sqlPreview,
  queryResultIsStale,
  createQueryCsv,
  safeFilename,
  queryParameters,
} from "./domain/queries.mjs";
import {
  Button,
  Badge,
  PageHead,
  FiltersBar,
  DataTable,
  BarChart,
  Empty,
  download,
} from "./ui";
import type { PageProps } from "./HomeReport";
import type { DemoStore } from "./state/useDemoStore";
import { isQueryRowLimit, QUERY_ROW_LIMIT_ERROR } from "./state/model.mjs";
export default function DataExplorer(
  props: PageProps & {
    store: DemoStore;
    initialTemplate?: string;
    initialSource?: string;
  },
) {
  const { filters, store } = props;
  const saved = store.state.ui.query ?? {};
  const [template, setTemplate] = useState(
    props.initialTemplate ?? saved.template ?? "revenue-reconciliation",
  );
  const [source, setSource] = useState(
    props.initialSource ?? saved.source ?? "Snowflake",
  );
  const [scenario, setScenario] = useState(saved.scenario ?? "complete");
  const [limit, setLimit] = useState(String(saved.limit ?? 100));
  const [result, setResult] = useState<any>(null);
  const [runParams, setRunParams] = useState<any>(null);
  const [runTemplate, setRunTemplate] = useState("");
  const [status, setStatus] = useState("idle");
  const [viewed, setViewed] = useState(false);
  const [sql, setSql] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chart, setChart] = useState(false);
  const [error, setError] = useState("");
  const [mountedAt] = useState(() => Date.now());
  const personaRef = useRef(props.persona);
  personaRef.current = props.persona;
  const session = useRef<any>(null);
  if (!session.current)
    session.current = (createDemoQuerySession as any)({
      getPersona: () => personaRef.current,
    });
  const execution = useRef("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (execution.current) session.current.cancel(execution.current);
    };
  }, []);
  useEffect(() => {
    if (props.initialTemplate) setTemplate(props.initialTemplate);
  }, [props.initialTemplate]);
  useEffect(() => {
    if (props.initialSource) setSource(props.initialSource);
  }, [props.initialSource]);
  const parameters = queryParameters({
    ...filters,
    source,
    scenario,
    limit: Number(limit),
  });
  const allowed = canAccess(template, props.persona);
  const stale =
    runParams &&
    (queryResultIsStale(runParams, parameters) || runTemplate !== template);
  const busy = status === "pending" || status === "running";
  const available = QUERY_DEFINITIONS.filter((q) =>
    canAccess(q.id, props.persona),
  );
  const run = async () => {
    setError("");
    setResult(null);
    setViewed(false);
    if (!allowed) {
      setError(
        "This approved query is unavailable for the selected demo persona.",
      );
      return;
    }
    if (!isQueryRowLimit(Number(limit))) {
      setError(QUERY_ROW_LIMIT_ERROR);
      return;
    }
    const requestId = `query-${crypto.randomUUID()}`;
    const submitted = session.current.submit({
      requestId,
      templateId: template,
      parameters,
    });
    if (submitted.status === "rejected") {
      setError(
        `Query could not start (${submitted.error.code}). Review the parameters and retry.`,
      );
      setStatus("failed");
      return;
    }
    execution.current = submitted.executionId;
    setStatus("pending");
    setRunParams(parameters);
    setRunTemplate(template);
    store.update((s) => ({
      ...s,
      ui: {
        ...s.ui,
        query: { template, source, scenario, limit: Number(limit) },
        lastQueryInterrupted: true,
      },
    }));
    props.emit(
      "query_submitted",
      {},
      { queryId: submitted.executionId, source_system: source.toLowerCase() },
    );
    let terminal: any = submitted;
    for (let i = 0; i < 3; i++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      if (!alive.current) return;
      terminal = session.current.poll(submitted.executionId);
      setStatus(terminal.status);
      if (!["pending", "running"].includes(terminal.status)) break;
    }
    if (terminal.status === "succeeded") {
      const page = session.current.page({
        executionId: submitted.executionId,
        pageSize: 100,
      });
      if (page.status === "rejected") {
        setError(
          "Current simulated authorization does not permit viewing these results.",
        );
        setStatus("failed");
        return;
      }
      setResult(page);
      props.emit(
        "query_completed",
        {
          outcome: page.coverage === "partial" ? "partial" : "success",
          row_count: page.rowCount,
          truncated: page.truncated,
        },
        { queryId: submitted.executionId, source_system: source.toLowerCase() },
      );
      store.update((s) => ({
        ...s,
        ui: {
          ...s.ui,
          lastQueryInterrupted: false,
          queryHistory: [
            {
              id: submitted.executionId,
              template,
              source,
              parameters,
              rows: page.rowCount,
              coverage: page.coverage,
              status: "succeeded",
              at: new Date().toISOString(),
            },
            ...(s.ui.queryHistory ?? []),
          ].slice(0, 12),
        },
      }));
    } else if (terminal.status !== "cancelled") {
      setError(
        "The sample adapter did not return a result. Select Complete under sample conditions and retry.",
      );
      props.emit(
        "query_failed",
        { reason: "source_failure" },
        { queryId: submitted.executionId, source_system: source.toLowerCase() },
      );
      store.update((s) => ({
        ...s,
        ui: { ...s.ui, lastQueryInterrupted: false },
      }));
    }
  };
  const cancel = () => {
    if (!execution.current) return;
    session.current.cancel(execution.current);
    setStatus("cancelled");
    setResult(null);
    props.emit(
      "query_cancelled",
      {},
      { queryId: execution.current, source_system: source.toLowerCase() },
    );
    store.update((s) => ({
      ...s,
      ui: { ...s.ui, lastQueryInterrupted: false },
    }));
  };
  const freshResult = () => {
    const page = session.current.page({
      executionId: execution.current,
      pageSize: 100,
    });
    return page.status === "rejected" ? null : page;
  };
  const canView = result && canAccess(runTemplate, props.persona);
  const data = canView ? freshResult() : null;
  const columns =
    data?.columns?.map((c: any) => ({
      key: c.name,
      label: c.label ?? c.name,
      money: c.unit === "currency-minor-unit",
    })) ?? [];
  const primaryAmount = data?.columns?.find(
    (c: any) => c.unit === "currency-minor-unit",
  )?.name;
  const chartRows =
    data && primaryAmount
      ? data.rows
          .map((r: any, i: number) => ({
            name: r.region ?? r.reason ?? String(i + 1),
            netCents: r[primaryAmount],
          }))
          .slice(0, 12)
      : [];
  return (
    <>
      <PageHead
        eyebrow="GOVERNED LOCAL QUERIES"
        title="Data Explorer"
        description="Go from a business question to the records behind it."
        actions={
          <Button
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-expanded={historyOpen}
          >
            <History size={17} />
            Execution history
          </Button>
        }
      />
      <div className="query-layout">
        <section className="panel query-editor">
          <div className="section-head">
            <h2>Build your query</h2>
            <Badge>Approved templates only</Badge>
          </div>
          <div className="query-selectors">
            <label>
              Source
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="Snowflake">Snowflake — sample adapter</option>
                <option value="Databricks">Databricks — sample adapter</option>
              </select>
            </label>
            <label>
              Query template
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                {!allowed && (
                  <option value={template}>Unavailable for this persona</option>
                )}
                {available.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="query-description">
            {allowed
              ? QUERY_DEFINITIONS.find((q) => q.id === template)?.description
              : "Choose a permitted template to continue."}
          </p>
          <FiltersBar filters={filters} onChange={props.setFilters} />
          <div className="query-tools">
            <Button
              className="text-button"
              aria-expanded={sql}
              onClick={() => setSql(!sql)}
            >
              <Code2 size={16} />
              {sql ? "Hide" : "Show"} SQL preview
            </Button>
            <Button
              className="text-button"
              aria-expanded={advanced}
              onClick={() => setAdvanced(!advanced)}
            >
              Sample conditions & limits
            </Button>
          </div>
          {sql && (
            <pre className="sql-preview" tabIndex={0} aria-label="SQL preview">
              {sqlPreview(template, parameters)}
            </pre>
          )}
          {advanced && (
            <div className="form-grid query-conditions">
              <label>
                Sample condition
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                >
                  <option value="complete">Complete source</option>
                  <option value="partial">Partial source</option>
                  <option value="empty">Empty result</option>
                  <option value="failed">Source failure</option>
                </select>
              </label>
              <label>
                Row limit
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  aria-describedby="query-error"
                />
              </label>
            </div>
          )}
          <div className="query-run-bar">
            <div className="toolbar">
              <Button
                className="primary"
                onClick={run}
                disabled={busy || !allowed}
              >
                <Play size={16} />
                {busy ? "Running query…" : "Run query"}
              </Button>
              <Button disabled={!busy} onClick={cancel}>
                <Square size={14} />
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!allowed) return;
                  if (!isQueryRowLimit(Number(limit))) {
                    setError(QUERY_ROW_LIMIT_ERROR);
                    return;
                  }
                  setError("");
                  const saved = props.save({
                    title: `${QUERY_DEFINITIONS.find((q) => q.id === template)?.title} · ${filters.period}`,
                    kind: "query",
                    route: `/data-explorer?template=${template}`,
                    context: {
                      filters,
                      query: {
                        template,
                        source,
                        scenario,
                        limit: Number(limit),
                      },
                    },
                  });
                  if (saved) props.notify("Query configuration saved");
                }}
                disabled={!allowed}
              >
                <Save size={16} />
                Save query
              </Button>
            </div>
            <span className="query-permission">
              Simulated permissions checked on run, view, and export
            </span>
          </div>
          {error && (
            <div id="query-error" className="notice error" role="alert">
              {error}
            </div>
          )}
        </section>
        {historyOpen && (
          <section className="panel query-history">
            <h2>Execution history</h2>
            <p>
              Browser-local runs. Returning to a configuration does not resume a
              warehouse session.
            </p>
            {!(store.state.ui.queryHistory ?? []).length ? (
              <p>No completed runs yet.</p>
            ) : (
              (store.state.ui.queryHistory ?? [])
                .filter((r: any) => canAccess(r.template, props.persona))
                .map((r: any) => (
                  <div className="history-row" key={r.id}>
                    <strong>
                      {
                        QUERY_DEFINITIONS.find((q) => q.id === r.template)
                          ?.title
                      }
                    </strong>
                    <small>
                      {r.source} · {r.parameters.period} · {r.rows} rows ·{" "}
                      {r.coverage}
                    </small>
                    <Button
                      onClick={() => {
                        setTemplate(r.template);
                        setSource(r.source);
                        setScenario(r.parameters.scenario);
                        setLimit(String(r.parameters.limit));
                        props.setFilters({
                          period: r.parameters.period,
                          entity: r.parameters.entity,
                          region: r.parameters.region,
                          product: r.parameters.product,
                        });
                        props.notify(
                          "Parameters restored. Run to compute fresh local results.",
                        );
                      }}
                    >
                      Restore parameters
                    </Button>
                  </div>
                ))
            )}
          </section>
        )}
      </div>
      {!result && status === "idle" && (
        <section className="query-start panel">
          <DatabaseIllustration />
          <h2>Your next answer starts with the evidence</h2>
          <p>
            Choose an approved query, adjust the scope, and run it against the
            shared sample records.
          </p>
          {store.state.ui.lastQueryInterrupted && (
            <div className="notice warning">
              A previous browser execution was interrupted. No warehouse job is
              running. Run again to compute a new local result.
            </div>
          )}
          {store.state.ui.queryHistory?.length > 0 && (
            <small>
              Prior results are not resumed after a reload. Your saved
              parameters and history remain available.
            </small>
          )}
        </section>
      )}
      {status === "cancelled" && (
        <div className="notice" role="status">
          Query cancelled. No result was retained. You can change the parameters
          and run again.
        </div>
      )}
      {busy && (
        <div className="notice" role="status">
          Executing the approved local template. You can cancel before
          completion.
        </div>
      )}
      {result && (
        <section className="panel query-results">
          <div className="section-head">
            <div>
              <p className="eyebrow">{runParams.source} SAMPLE ADAPTER</p>
              <h2>Query results</h2>
            </div>
            <Badge>
              {!data
                ? "Access changed"
                : data.coverage === "partial"
                  ? "Partial result"
                  : "Complete result"}
            </Badge>
          </div>
          {!canView || !data ? (
            <div className="notice warning">
              Results are unavailable for the current simulated permissions.
              Select a permitted template and run a new query.
            </div>
          ) : (
            <>
              {stale && (
                <div className="notice warning" role="status">
                  Parameters changed. These results still reflect{" "}
                  {runParams.period}, {runParams.region}, {runParams.product}.
                  Run again to update.
                </div>
              )}
              {data.coverage === "partial" && (
                <div className="notice warning">
                  Partial result ·{" "}
                  {data.truncated
                    ? "The row limit capped this output."
                    : "The sample source returned incomplete coverage."}{" "}
                  Missing records are not zero. Export preserves this limited
                  scope.
                </div>
              )}
              <div className="results-summary">
                <span>
                  <Check size={15} />
                  {data.rowCount} rows · {runParams.period} ·{" "}
                  {runParams.region === "All"
                    ? "All regions"
                    : runParams.region}
                </span>
                <div className="toolbar">
                  {viewed && primaryAmount && (
                    <Button
                      onClick={() => setChart(!chart)}
                      aria-pressed={chart}
                    >
                      <BarChart3 size={16} />
                      {chart ? "Show table" : "Show chart"}
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      const output = session.current.exportRows(
                        execution.current,
                      );
                      if (output.status === "rejected") {
                        props.notify(
                          "Export blocked by current simulated permissions",
                        );
                        return;
                      }
                      download(
                        safeFilename(
                          `${runTemplate}-${runParams.period}-${runParams.region}-${runParams.product}-${output.coverage}`,
                        ),
                        createQueryCsv(output),
                      );
                      props.notify(
                        `${output.rowCount} permitted ${output.coverage} sample rows exported`,
                      );
                    }}
                  >
                    <Download size={16} />
                    Export results
                  </Button>
                </div>
              </div>
              {!viewed ? (
                <div className="ready-result">
                  <Table2 size={28} />
                  <h3>
                    {data.rowCount === 0
                      ? "Query completed with no matching records"
                      : "Your sample results are ready"}
                  </h3>
                  <p>
                    Execution completion and opening the result are recorded as
                    separate actions.
                  </p>
                  <Button
                    className="primary"
                    onClick={() => {
                      if (!freshResult()) {
                        props.notify(
                          "Current simulated permissions do not allow viewing",
                        );
                        return;
                      }
                      setViewed(true);
                      props.emit(
                        "query_results_viewed",
                        { page_index: 0 },
                        {
                          queryId: execution.current,
                          source_system: runParams.source.toLowerCase(),
                        },
                      );
                    }}
                  >
                    View results
                    <ArrowRight size={16} />
                  </Button>
                </div>
              ) : (
                <>
                  {chart && (
                    <div className="query-chart">
                      <h3>
                        {
                          columns.find((c: any) => c.key === primaryAmount)
                            ?.label
                        }{" "}
                        · first {chartRows.length} result rows
                      </h3>
                      <BarChart rows={chartRows} />
                    </div>
                  )}
                  <DataTable
                    rows={data.rows}
                    columns={columns}
                    caption={`${QUERY_DEFINITIONS.find((q) => q.id === runTemplate)?.title} · ${runParams.source} sample · ${data.coverage} · monetary columns stored in USD cents`}
                    pageSize={8}
                  />
                </>
              )}
              <div className="related-actions">
                {canAccess("close-note", props.persona) && (
                  <a href="#/knowledge/close-note">
                    Read the close note
                    <ArrowRight size={15} />
                  </a>
                )}
                <a href="#/ask-iq">
                  Explain with Ask IQ
                  <ArrowRight size={15} />
                </a>
              </div>
            </>
          )}
        </section>
      )}
      <p className="query-boundary">
        No SQL is sent to a warehouse. The preview documents the selected
        template; arbitrary SQL is not accepted. Fixed sample evaluation: 3
        October 2026.
      </p>
    </>
  );
}
function DatabaseIllustration() {
  return (
    <div className="query-empty-icon">
      <Code2 size={25} />
    </div>
  );
}
