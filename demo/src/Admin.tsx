import { useEffect, useMemo, useState } from "react";
import type { PageProps } from "./state/useDemoStore";
import {
  effectiveExperience,
  layerFor,
  NAVIGATION,
  REPORT_IDS,
  DOCUMENT_IDS,
  WORKSPACES,
  saveDraft,
  publishDraft,
  restoreVersion,
} from "./state/model.mjs";
import {
  analytics,
  deleteRecording,
  EVENT_LABELS,
  funnel,
  SAMPLE_EVENTS,
  SAMPLE_WINDOW,
  startRecording,
  stopRecording,
} from "./state/telemetry.mjs";
import { downloadJSON } from "./Workspace";
import "./admin.css";

const reportNames: Record<string, string> = {
  "finance-report": "Finance Performance",
  "sales-report": "Sales Performance",
  "credits-report": "Credits & Adjustments",
  "regional-report": "Regional Revenue",
  "product-report": "Product Mix",
};
const documentNames: Record<string, string> = {
  "revenue-definition": "Gross vs. net revenue",
  "close-note": "September close note",
  "credits-policy": "Credits policy",
  "refresh-lineage": "Refresh and lineage",
  "department-guide": "Working across departments",
};
const title = (value: string) => value[0].toUpperCase() + value.slice(1);
const settingNames: Record<string, string> = {
  brandName: "Workspace title",
  themeAccent: "Theme",
  themeDensity: "Density",
  navigation: "Navigation",
  layout: "Home layout",
  collectionResourceIds: "Featured reports",
  contextualDocumentIds: "Contextual guidance",
  savedViewDefault: "Report starting view",
  helpRoute: "Help destination",
  approvedActions: "Available actions",
  dataExplorerEnabled: "Data Explorer",
};

export function ExperienceSettings({ store, workspace, navigate }: PageProps) {
  const [scope, setScope] = useState(workspace);
  const getInitial = (selected: string) =>
    structuredClone(
      store.state.configs.drafts[selected]?.layer ??
        layerFor(store.state, selected),
    );
  const [editor, setEditor] = useState<any>(() => getInitial(workspace));
  const [baseline, setBaseline] = useState(() => JSON.stringify(editor));
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(editor) !== baseline;
  const active = effectiveExperience(
    store.state,
    WORKSPACES.includes(scope) ? scope : workspace,
  );
  const projected = effectiveExperience(
    store.state,
    WORKSPACES.includes(scope) ? scope : workspace,
    { scope, layer: editor },
  );
  const effective =
    projected.status === "resolved" ? projected.effective : active.effective;
  const saved = store.state.configs.drafts[scope];
  const history = store.state.configs.history.filter(
    (item: any) => item.scope === scope,
  );
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    window.dispatchEvent(
      new CustomEvent("enterprise-iq-dirty", { detail: dirty }),
    );
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.dispatchEvent(
        new CustomEvent("enterprise-iq-dirty", { detail: false }),
      );
    };
  }, [dirty]);
  const set = (key: string, value: any) => {
    setEditor((current: any) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }));
    setPreview(false);
    setError("");
  };
  const locked = (key: string) =>
    scope !== "organization" &&
    (store.state.configs.organization.locks.includes(key) ||
      (scope === "personal" &&
        store.state.configs.departments[workspace].locks.includes(key)));
  const inherited = (key: string) => !Object.hasOwn(editor.settings, key);
  const hint = (key: string) => (
    <small className="setting-origin">
      {locked(key)
        ? `Locked by ${active.provenance[key]?.lockedBy ?? "organization"}`
        : inherited(key)
          ? `Inherited from ${active.provenance[key]?.source ?? "organization"}`
          : `${title(scope)} override`}
    </small>
  );
  const changeScope = (next: string) => {
    if (
      dirty &&
      !window.confirm(
        "Discard unsaved form changes? Saved drafts are retained.",
      )
    )
      return;
    const layer = getInitial(next);
    setScope(next);
    setEditor(layer);
    setBaseline(JSON.stringify(layer));
    setPreview(false);
    setError("");
    setMessage("");
  };
  const save = () => {
    try {
      if (store.update((state: any) => saveDraft(state, scope, editor))) {
        setBaseline(JSON.stringify(editor));
        setMessage("Draft saved. The published workspace has not changed.");
        setError("");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const publish = () => {
    try {
      if (store.update((state: any) => publishDraft(state, scope))) {
        const layer = { ...editor };
        setBaseline(JSON.stringify(layer));
        setPreview(false);
        setMessage(
          `${title(scope)} configuration published in this browser. Open the active workspace to see the change.`,
        );
        setError("");
        store.track("experience_configuration_published", {
          workspace: WORKSPACES.includes(scope) ? scope : workspace,
          resourceId: "configuration",
          background: true,
        });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const restore = (id: string) => {
    try {
      if (store.update((state: any) => restoreVersion(state, id))) {
        const old = history.find((item: any) => item.id === id);
        setEditor(structuredClone(old.layer));
        setBaseline(JSON.stringify(old.layer));
        setPreview(false);
        setMessage(
          "Earlier configuration restored as a new published version.",
        );
        setError("");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const reorder = (index: number, direction: number) => {
    const navigation = [...effective.navigation];
    [navigation[index], navigation[index + direction]] = [
      navigation[index + direction],
      navigation[index],
    ];
    set("navigation", navigation);
  };
  return (
    <div className="settings-page page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administration · Presentation preferences</p>
          <h1>Experience Settings</h1>
          <p className="muted">
            Shape each workspace. Preview the change, then publish it locally.
          </p>
        </div>
        <button className="button secondary" onClick={() => navigate("/home")}>
          View active experience
        </button>
      </header>
      <div className="notice compact">
        <strong>Preferences shape the interface.</strong> They do not grant
        source permissions. This demo’s persona selector is a simulation.
      </div>
      <section className="panel scope-bar">
        <label className="field">
          Configuration scope
          <select value={scope} onChange={(e) => changeScope(e.target.value)}>
            <option value="organization">Organization defaults</option>
            {WORKSPACES.map((item: string) => (
              <option key={item} value={item}>
                {title(item)} workspace
              </option>
            ))}
            <option value="personal">Personal preferences</option>
          </select>
        </label>
        <div>
          <span className="eyebrow">Currently published</span>
          <p>
            <strong>{layerFor(store.state, scope).version}</strong>{" "}
            <span className="badge">Active</span>
          </p>
        </div>
        <div>
          <span className="eyebrow">Draft</span>
          <p>
            {dirty
              ? "Unsaved form changes"
              : saved
                ? "Saved · awaiting publication"
                : "No saved draft"}
          </p>
        </div>
      </section>
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="settings-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Identity & appearance</h2>
            <p className="muted">
              Approved presets keep every experience readable.
            </p>
          </div>
          <div className="form-grid">
            <label className="field">
              Workspace title
              <input
                aria-label="Workspace title"
                value={editor.settings.brandName ?? effective.brandName}
                maxLength={80}
                disabled={locked("brandName")}
                onChange={(e) => set("brandName", e.target.value)}
              />
              {hint("brandName")}
            </label>
            <label className="field">
              Theme
              <select
                aria-label="Theme"
                value={effective.themeAccent}
                disabled={locked("themeAccent")}
                onChange={(e) => set("themeAccent", e.target.value)}
              >
                <option value="navy">Slate blue</option>
                <option value="teal">Teal</option>
                <option value="plum">Plum</option>
              </select>
              {hint("themeAccent")}
            </label>
            <label className="field">
              Density
              <select
                aria-label="Density"
                value={effective.themeDensity}
                disabled={locked("themeDensity")}
                onChange={(e) => set("themeDensity", e.target.value)}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
              {hint("themeDensity")}
            </label>
            <label className="field">
              Home layout
              <select
                aria-label="Home layout"
                value={effective.layout}
                disabled={locked("layout")}
                onChange={(e) => set("layout", e.target.value)}
              >
                <option value="report-first">Reports first</option>
                <option value="balanced">Balanced workspace</option>
              </select>
              {hint("layout")}
            </label>
            <label className="field">
              Report starting view
              <select
                aria-label="Report starting view"
                value={effective.savedViewDefault}
                disabled={locked("savedViewDefault")}
                onChange={(e) => set("savedViewDefault", e.target.value)}
              >
                <option value="source-default">Report default</option>
                <option value="summary">Overview</option>
                <option value="detail">Detailed results</option>
              </select>
              {hint("savedViewDefault")}
            </label>
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Featured reports</h2>
            <p className="muted">
              Choose the reports shown on this workspace’s Home.
            </p>
          </div>
          <div className="check-list">
            {REPORT_IDS.map((id: string) => (
              <label className="checkbox-row" key={id}>
                <input
                  type="checkbox"
                  checked={effective.collectionResourceIds.includes(id)}
                  disabled={locked("collectionResourceIds")}
                  onChange={(e) =>
                    set(
                      "collectionResourceIds",
                      e.target.checked
                        ? [...effective.collectionResourceIds, id]
                        : effective.collectionResourceIds.filter(
                            (entry: string) => entry !== id,
                          ),
                    )
                  }
                />
                <span>{reportNames[id]}</span>
              </label>
            ))}
          </div>
          {hint("collectionResourceIds")}
          <h3>Contextual guidance</h3>
          <div className="check-list">
            {DOCUMENT_IDS.map((id: string) => (
              <label className="checkbox-row" key={id}>
                <input
                  type="checkbox"
                  checked={effective.contextualDocumentIds.includes(id)}
                  disabled={locked("contextualDocumentIds")}
                  onChange={(e) =>
                    set(
                      "contextualDocumentIds",
                      e.target.checked
                        ? [...effective.contextualDocumentIds, id]
                        : effective.contextualDocumentIds.filter(
                            (entry: string) => entry !== id,
                          ),
                    )
                  }
                />
                <span>{documentNames[id]}</span>
              </label>
            ))}
          </div>
          {hint("contextualDocumentIds")}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Navigation</h2>
            <p className="muted">
              Move modules with the arrow buttons. Home stays available.
            </p>
          </div>
          <ol className="navigation-editor">
            {effective.navigation.map((item: any, index: number) => (
              <li key={item.module}>
                <span>{item.label}</span>
                <div className="toolbar">
                  <button
                    className="button secondary icon-button"
                    aria-label={`Move ${item.label} up`}
                    disabled={index === 0 || locked("navigation")}
                    onClick={() => reorder(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="button secondary icon-button"
                    aria-label={`Move ${item.label} down`}
                    disabled={
                      index === effective.navigation.length - 1 ||
                      locked("navigation")
                    }
                    onClick={() => reorder(index, 1)}
                  >
                    ↓
                  </button>
                  {item.module !== "home" && (
                    <button
                      className="button secondary"
                      disabled={locked("navigation")}
                      aria-label={`Hide ${item.label}`}
                      onClick={() =>
                        set(
                          "navigation",
                          effective.navigation.filter(
                            (entry: any) => entry.module !== item.module,
                          ),
                        )
                      }
                    >
                      Hide
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="toolbar">
            {NAVIGATION.filter(
              (item: any) =>
                !effective.navigation.some(
                  (entry: any) => entry.module === item.module,
                ),
            ).map((item: any) => (
              <button
                key={item.module}
                className="button secondary"
                disabled={locked("navigation")}
                onClick={() =>
                  set("navigation", [...effective.navigation, item])
                }
              >
                Add {item.label}
              </button>
            ))}
          </div>
          {hint("navigation")}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Inheritance & locks</h2>
            <p className="muted">
              Organization → workspace → personal. An earlier lock wins.
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Effective source</th>
                  <th>Lock</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(settingNames).map(([key, label]) => (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td>
                      {projected.provenance?.[key]?.source ??
                        active.provenance[key]?.source}
                    </td>
                    <td>
                      {scope !== "personal" &&
                      Object.hasOwn(editor.settings, key) ? (
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            aria-label={`Lock ${label}`}
                            checked={editor.locks?.includes(key) ?? false}
                            disabled={locked(key)}
                            onChange={(e) => {
                              setEditor((current: any) => ({
                                ...current,
                                locks: e.target.checked
                                  ? [...(current.locks ?? []), key]
                                  : (current.locks ?? []).filter(
                                      (item: string) => item !== key,
                                    ),
                              }));
                              setPreview(false);
                            }}
                          />
                          <span>{locked(key) ? "Inherited lock" : "Lock"}</span>
                        </label>
                      ) : active.provenance[key]?.lockedBy ? (
                        `Locked by ${active.provenance[key].lockedBy}`
                      ) : (
                        "Unlocked"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {projected.conflicts?.length > 0 && (
            <p className="notice">
              {projected.conflicts.length} override(s) are blocked by earlier
              locks and will retain their inherited values.
            </p>
          )}
          <button
            className="button secondary"
            disabled={scope === "organization"}
            onClick={() => {
              setEditor((current: any) => ({
                ...current,
                settings: {},
                ...(scope === "personal" ? {} : { locks: [] }),
              }));
              setPreview(false);
            }}
          >
            Use inherited defaults
          </button>
        </section>
      </div>
      <section className="panel draft-actions">
        <div>
          <strong>
            {preview
              ? "Previewing the saved draft"
              : "Ready to review your changes?"}
          </strong>
          <p className="muted">
            Saving a draft does not change the active workspace. Publish applies
            it in this browser.
          </p>
        </div>
        <div className="toolbar">
          <button className="button secondary" onClick={save}>
            Save draft
          </button>
          <button
            className="button secondary"
            disabled={!saved || dirty}
            onClick={() => setPreview(!preview)}
          >
            {preview ? "Close preview" : "Preview draft"}
          </button>
          <button
            className="button primary"
            disabled={!saved || dirty}
            onClick={publish}
          >
            Publish to demo
          </button>
        </div>
        {dirty && (
          <small>Save your changes to enable preview and publish.</small>
        )}
      </section>
      {preview && (
        <section
          className={`panel experience-preview theme-${effective.themeAccent}`}
          aria-label="Draft experience preview"
        >
          <span className="badge">Draft preview · not published</span>
          <div className="preview-navigation">
            {effective.navigation.map((item: any) => (
              <span key={item.module}>{item.label}</span>
            ))}
          </div>
          <h2>{effective.brandName}</h2>
          <p>Your reports, data, and business context—in one place.</p>
          <p className="muted">
            {effective.layout === "report-first"
              ? "Reports first"
              : "Balanced workspace"}{" "}
            · {effective.themeDensity} spacing ·{" "}
            {effective.savedViewDefault === "detail"
              ? "Detailed results"
              : "Overview"}{" "}
            report view
          </p>
          <div className="preview-reports">
            {effective.collectionResourceIds.length ? (
              effective.collectionResourceIds.map((id: string) => (
                <div className="card" key={id}>
                  <span className="eyebrow">Featured report</span>
                  <h3>{reportNames[id]}</h3>
                  <div className="preview-mini-chart" aria-hidden="true">
                    {[45, 70, 55, 85, 65].map((height, index) => (
                      <span key={index} style={{ height }} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p>
                No featured reports selected. The report catalog remains
                available.
              </p>
            )}
          </div>
          <p className="muted">
            Guidance:{" "}
            {effective.contextualDocumentIds
              .map((id: string) => documentNames[id])
              .join(" · ") || "No contextual documents selected"}
          </p>
        </section>
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>Version history</h2>
          <p className="muted">
            Restoring creates a new published version and preserves this
            history.
          </p>
        </div>
        <div className="version-list">
          {history.map((item: any) => (
            <article className="version-row" key={item.id}>
              <div>
                <strong>{item.layer.version}</strong>{" "}
                {item.layer.version ===
                  layerFor(store.state, scope).version && (
                  <span className="badge">Active</span>
                )}
                <p className="muted">
                  {item.label} · {new Date(item.publishedAt).toLocaleString()}{" "}
                  {item.restoredFrom ? `· from ${item.restoredFrom}` : ""}
                </p>
              </div>
              <button
                className="button secondary"
                disabled={
                  item.layer.version === layerFor(store.state, scope).version
                }
                aria-label={`Restore ${item.layer.version}`}
                onClick={() => restore(item.id)}
              >
                Restore
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const value = (metric: any, key: string) =>
  metric?.status === "observed" &&
  metric[key] !== null &&
  metric[key] !== undefined
    ? metric[key]
    : "—";
const pct = (numerator: any, denominator: any) =>
  typeof numerator === "number" && denominator > 0
    ? `${Math.round((numerator / denominator) * 100)}%`
    : "Not observed";
const eventLabel = (name: string) =>
  (EVENT_LABELS as Record<string, string>)[name] ?? name.replaceAll("_", " ");

export function UsageAnalytics({ store, workspace, navigate }: PageProps) {
  const [dataset, setDataset] = useState("sample");
  const [tab, setTab] = useState("overview");
  const [department, setDepartment] = useState(workspace);
  const [source, setSource] = useState("");
  const [version, setVersion] = useState("");
  const [day, setDay] = useState("all");
  const [first, setFirst] = useState("report_open_requested");
  const [last, setLast] = useState("query_results_viewed");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const local = dataset === "local";
  const input = local ? store.state.telemetry.events : SAMPLE_EVENTS;
  const versions = [
    ...new Set(
      input
        .filter((item: any) => item.workspace_id.endsWith(`-${department}`))
        .map((item: any) => item.experience_config_version),
    ),
  ] as string[];
  const dates = local
    ? { start: "2000-01-01T00:00:00.000Z", end: "2100-01-01T00:00:00.000Z" }
    : day === "all"
      ? SAMPLE_WINDOW
      : {
          start: `${day}T00:00:00.000Z`,
          end: new Date(
            Date.parse(`${day}T00:00:00.000Z`) + 86400000,
          ).toISOString(),
        };
  const result = useMemo(
    () =>
      analytics(input, {
        workspace: department,
        local,
        source,
        version,
        ...dates,
      }),
    [input, department, local, source, version, dates.start, dates.end],
  );
  const metrics = result.metrics;
  // Funnel steps are actual normalized events in chronological order.
  const [middle, setMiddle] = useState("query_submitted");
  const configuredFunnel = funnel(result.paths, [first, middle, last]);
  const comparisons = versions.map((item) => ({
    version: item,
    result: analytics(input, {
      workspace: department,
      local,
      source,
      version: item,
      ...dates,
    }),
  }));
  const changeDataset = (next: string) => {
    setDataset(next);
    setVersion("");
    setSource("");
    setDay("all");
  };
  const start = () => {
    if (store.update((state: any) => startRecording(state))) {
      setMessage(
        "Recording started. Open a report or begin the guided investigation.",
      );
      setDataset("local");
    }
  };
  return (
    <div className="analytics-page page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administration · Journey evidence</p>
          <h1>Usage Analytics</h1>
          <p className="muted">
            Understand the path across reports, queries, and business context.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() =>
            downloadJSON(
              {
                dataset: local ? "browser-local" : "synthetic-sample",
                observation: result.observation,
                coverage: {
                  ...result.coverage,
                  earlier_events_not_retained: local
                    ? (store.state.telemetry.droppedEvents ?? 0)
                    : 0,
                },
                events: result.events,
              },
              `enterprise-iq-${local ? "local" : "sample"}-journey-events.json`,
            )
          }
        >
          Export events
        </button>
      </header>
      <div className="dataset-switch tabs" aria-label="Journey dataset">
        <button
          className={!local ? "active" : ""}
          aria-pressed={!local}
          onClick={() => changeDataset("sample")}
        >
          Sample journeys
        </button>
        <button
          className={local ? "active" : ""}
          aria-pressed={local}
          onClick={() => changeDataset("local")}
        >
          This browser session{" "}
          {store.state.telemetry.recording && (
            <span className="record-dot" aria-label="Recording" />
          )}
        </button>
      </div>
      <section className="notice">
        <strong>
          {local
            ? "Your optional local recording"
            : "Synthetic activity · October 2–3, 2026"}
        </strong>
        <p>
          {local
            ? "Records interactions in this browser only. Nothing is sent to an analytics service. This recording is never combined with sample journeys. Keeps up to the latest 1,000 events."
            : "Fictional journeys across Finance, Sales, and Operations. Metrics are calculated from recorded events; incomplete observations remain visible."}
        </p>
        {local && store.state.telemetry.droppedEvents > 0 && (
          <p role="status">
            <strong>Incomplete recording:</strong>{" "}
            {store.state.telemetry.droppedEvents} earlier event(s) are outside
            the retention limit. Metrics and paths describe the retained
            observations only; omitted events are not zero activity.
          </p>
        )}
        {local && (
          <div className="toolbar">
            {!store.state.telemetry.recording ? (
              <button className="button primary" onClick={start}>
                {store.state.telemetry.events.length
                  ? "Start a new recording"
                  : "Start recording"}
              </button>
            ) : (
              <button
                className="button primary"
                onClick={() => {
                  store.update(stopRecording);
                  setMessage(
                    "Recording stopped. Your existing events remain available.",
                  );
                }}
              >
                Stop recording
              </button>
            )}
            <button
              className="button secondary"
              disabled={
                !store.state.telemetry.events.length &&
                !store.state.telemetry.recording
              }
              onClick={() => {
                store.update(deleteRecording);
                setMessage(
                  "This browser’s recording was deleted. Sample journeys are unchanged.",
                );
              }}
            >
              Delete recording
            </button>
            {store.state.telemetry.recording && (
              <button
                className="button secondary"
                onClick={() => navigate("/reports/finance-report")}
              >
                Begin investigation
              </button>
            )}
          </div>
        )}
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="toolbar analytics-filters">
        <label className="field">
          Department
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setVersion("");
            }}
          >
            {WORKSPACES.map((item: string) => (
              <option key={item} value={item}>
                {title(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All observed sources</option>
            {[
              "enterprise-iq",
              "power-bi",
              "looker",
              "snowflake",
              "databricks",
              "confluence",
              "sharepoint",
            ].map((item) => (
              <option key={item} value={item}>
                {title(item.replaceAll("-", " "))}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Experience version
          <select value={version} onChange={(e) => setVersion(e.target.value)}>
            <option value="">All versions</option>
            {versions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {!local && (
          <label className="field">
            Sample date
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="all">October 2–3, 2026</option>
              <option value="2026-10-02">October 2, 2026</option>
              <option value="2026-10-03">October 3, 2026</option>
            </select>
          </label>
        )}
        <button
          className="button secondary"
          onClick={() => {
            setSource("");
            setVersion("");
            setDay("all");
          }}
        >
          Clear filters
        </button>
      </div>
      <div className="tabs" aria-label="Analytics views">
        {[
          ["overview", "Overview"],
          ["journeys", "Journeys"],
          ["friction", "Friction"],
          ["changes", "Experience changes"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {result.status === "suppressed" && (
        <div className="notice">
          {local
            ? "No recorded events match this scope yet. Start recording and visit a report."
            : "This filter has fewer than three synthetic subjects. Aggregate outcome metrics are withheld; missing data is not zero."}
        </div>
      )}
      {tab === "overview" && (
        <>
          <div className="metric-grid">
            <article className="metric card">
              <span>Observed events</span>
              <strong>{result.events.length}</strong>
              <small>After scope and version filters</small>
            </article>
            <article className="metric card">
              <span>Report views rendered</span>
              <strong>
                {value(metrics?.report_outcomes, "rendered_views")}
                <small>
                  {" "}
                  / {value(metrics?.report_outcomes, "denominator")}
                </small>
              </strong>
              <small>First successful render per view</small>
            </article>
            <article className="metric card">
              <span>Queries completed</span>
              <strong>
                {value(metrics?.query_outcomes, "completed")}
                <small>
                  {" "}
                  / {value(metrics?.query_outcomes, "denominator")}
                </small>
              </strong>
              <small>Completion is separate from viewing</small>
            </article>
            <article className="metric card">
              <span>Results viewed</span>
              <strong>
                {value(metrics?.query_outcomes, "results_viewed")}
              </strong>
              <small>
                {pct(
                  value(metrics?.query_outcomes, "results_viewed"),
                  value(metrics?.query_outcomes, "completed"),
                )}{" "}
                of completed queries
              </small>
            </article>
          </div>
          <div className="settings-grid">
            <section className="panel">
              <h2>Observed activity</h2>
              <p className="muted">
                Event counts by UTC date. No estimate of enterprise adoption.
              </p>
              <div
                className="bar-chart"
                role="img"
                aria-label={
                  result.daily
                    .map((item: any) => `${item.date}: ${item.count} events`)
                    .join(", ") || "No observed events"
                }
              >
                {result.daily.map((item: any) => (
                  <div className="horizontal-bar" key={item.date}>
                    <span>{item.date}</span>
                    <div>
                      <span
                        style={{
                          width: `${(item.count / Math.max(...result.daily.map((entry: any) => entry.count))) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <h2>Where observations end</h2>
              <ul className="friction-list">
                <li>
                  <strong>
                    {value(metrics?.report_outcomes, "partial_views")}
                  </strong>
                  <span>Report views with partial rendering</span>
                </li>
                <li>
                  <strong>
                    {value(metrics?.query_outcomes, "missing_terminal")}
                  </strong>
                  <span>Queries without an observed terminal event</span>
                </li>
                <li>
                  <strong>
                    {metrics?.query_outcomes?.status === "observed"
                      ? metrics.query_outcomes.completed -
                        metrics.query_outcomes.results_viewed
                      : "—"}
                  </strong>
                  <span>Completed queries without observed result viewing</span>
                </li>
              </ul>
              <button
                className="text-button"
                onClick={() => setTab("friction")}
              >
                Inspect friction →
              </button>
            </section>
          </div>
          <section className="panel">
            <h2>Coverage & definitions</h2>
            <p>
              {local
                ? "One local browser visitor; descriptive path only."
                : "Minimum aggregate cohort: three fictional subjects."}{" "}
              {result.coverage?.unique_subjects ?? 0} subjects in this scope.
              Query submission, source completion, and viewing results are
              separate events.
            </p>
            <p className="muted">
              Preview and test events are excluded. Repeated renders do not
              count as new initial report views. Missing outcomes and source
              handoffs do not establish failure. Return use is not estimated
              from this sample.
            </p>
          </section>
        </>
      )}
      {tab === "journeys" && (
        <>
          <section className="panel">
            <h2>Build a journey funnel</h2>
            <p className="muted">
              Count journeys with these events in order, within the selected
              observation window and configuration version.
            </p>
            <div className="toolbar">
              {[
                [first, setFirst, "First step"],
                [middle, setMiddle, "Second step"],
                [last, setLast, "Final step"],
              ].map(([selected, setter, label]: any) => (
                <label key={label} className="field">
                  {label}
                  <select
                    value={selected}
                    onChange={(e) => setter(e.target.value)}
                  >
                    {[
                      "workspace_viewed",
                      "report_open_requested",
                      "definition_opened",
                      "documentation_opened",
                      "query_submitted",
                      "query_completed",
                      "query_results_viewed",
                      "iq_answer_presented",
                      "resource_saved",
                    ].map((item) => (
                      <option key={item} value={item}>
                        {eventLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="funnel">
              {configuredFunnel.map((item: any, index: number) => (
                <div className="funnel-step" key={`${item.step}-${index}`}>
                  <span className="eyebrow">Step {index + 1}</span>
                  <strong>
                    {result.status === "observed" ? item.count : "—"}
                  </strong>
                  <span>{eventLabel(item.step)}</span>
                  <small>
                    {index === 0
                      ? "Eligible observed journeys"
                      : pct(item.count, configuredFunnel[0].count)}
                  </small>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>Connected event paths</h2>
            <p className="muted">
              Each path stays within one workspace and experience version.
              Public synthetic identifiers carry no real identities.
            </p>
            <div className="journey-list">
              {result.paths.map((path: any[], index: number) => (
                <article className="journey-row" key={path[0].event_id}>
                  <button
                    className="journey-toggle"
                    aria-expanded={expanded === path[0].event_id}
                    onClick={() =>
                      setExpanded(
                        expanded === path[0].event_id ? null : path[0].event_id,
                      )
                    }
                  >
                    <span>
                      <strong>
                        {local
                          ? "Local journey"
                          : `Sample journey ${index + 1}`}
                      </strong>
                      <small>
                        {path[0].experience_config_version} · {path.length}{" "}
                        events
                      </small>
                    </span>
                    <span>
                      {expanded === path[0].event_id
                        ? "Collapse −"
                        : "Explore +"}
                    </span>
                  </button>
                  <div className="journey-summary">
                    {path
                      .filter((item) =>
                        [
                          "report_open_requested",
                          "documentation_opened",
                          "definition_opened",
                          "query_submitted",
                          "query_results_viewed",
                          "iq_answer_presented",
                          "resource_saved",
                        ].includes(item.event_name),
                      )
                      .map((item: any, i: number) => (
                        <span key={item.event_id}>
                          {i > 0 && " → "}
                          {eventLabel(item.event_name)}
                        </span>
                      ))}
                  </div>
                  {expanded === path[0].event_id && (
                    <ol className="event-timeline">
                      {path.map((event) => (
                        <li key={event.event_id}>
                          <time>{event.occurred_at.slice(11, 19)} UTC</time>
                          <strong>{eventLabel(event.event_name)}</strong>
                          <span className="muted">
                            {event.source_system} · {event.outcome}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </article>
              ))}
            </div>
            {!result.paths.length && (
              <p className="empty-state">
                No paths match the selected filters.
              </p>
            )}
          </section>
        </>
      )}
      {tab === "friction" && (
        <section className="panel">
          <h2>Observed friction, with its limits</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Observed</th>
                  <th>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Zero-result searches</th>
                  <td>
                    {value(metrics?.zero_result_searches, "numerator")} /{" "}
                    {value(metrics?.zero_result_searches, "denominator")}
                  </td>
                  <td>
                    Only searches with complete result coverage form the
                    denominator.
                  </td>
                </tr>
                <tr>
                  <th>Incomplete search observations</th>
                  <td>
                    {value(
                      metrics?.zero_result_searches,
                      "missing_or_incomplete_results",
                    )}
                  </td>
                  <td>Excluded from the zero-result rate.</td>
                </tr>
                <tr>
                  <th>Partial reports</th>
                  <td>{value(metrics?.report_outcomes, "partial_views")}</td>
                  <td>A completed dashboard event can contain failed tiles.</td>
                </tr>
                <tr>
                  <th>Missing query outcome</th>
                  <td>{value(metrics?.query_outcomes, "missing_terminal")}</td>
                  <td>
                    No source completion, cancellation, or failure was observed.
                  </td>
                </tr>
                <tr>
                  <th>Query failures / cancellations</th>
                  <td>
                    {value(metrics?.query_outcomes, "failed")} /{" "}
                    {value(metrics?.query_outcomes, "cancelled")}
                  </td>
                  <td>These have explicit terminal events.</td>
                </tr>
                <tr>
                  <th>Search to report</th>
                  <td>
                    {typeof value(metrics?.search_to_report_ms, "mean_ms") ===
                    "number"
                      ? `${value(metrics?.search_to_report_ms, "mean_ms") / 1000}s`
                      : "Not estimated"}
                  </td>
                  <td>
                    Matched successful first render; sufficient cohort required.
                  </td>
                </tr>
                <tr>
                  <th>Documentation to report</th>
                  <td>
                    {value(metrics?.documentation_to_report, "numerator")} /{" "}
                    {value(metrics?.documentation_to_report, "denominator")}
                  </td>
                  <td>Documentation paths followed by a report opening.</td>
                </tr>
                <tr>
                  <th>Guided answer source follow-through</th>
                  <td>
                    {value(metrics?.iq_source_follow_through, "numerator")} /{" "}
                    {value(metrics?.iq_source_follow_through, "denominator")}
                  </td>
                  <td>
                    An answer was followed by an explicit citation opening.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "changes" && (
        <section className="panel">
          <h2>Experience version comparison</h2>
          <p className="muted">
            Events retain the effective configuration version at the moment of
            interaction. These descriptive samples do not establish causality or
            improved productivity. Date and source filters also apply here.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Events</th>
                  <th>Rendered / opened</th>
                  <th>Completed / submitted</th>
                  <th>Results viewed</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((item) => (
                  <tr key={item.version}>
                    <th>{item.version}</th>
                    <td>{item.result.events.length}</td>
                    <td>
                      {value(
                        item.result.metrics?.report_outcomes,
                        "rendered_views",
                      )}{" "}
                      /{" "}
                      {value(
                        item.result.metrics?.report_outcomes,
                        "denominator",
                      )}
                    </td>
                    <td>
                      {value(item.result.metrics?.query_outcomes, "completed")}{" "}
                      /{" "}
                      {value(
                        item.result.metrics?.query_outcomes,
                        "denominator",
                      )}
                    </td>
                    <td>
                      {value(
                        item.result.metrics?.query_outcomes,
                        "results_viewed",
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!versions.length && (
            <p>
              No versions observed yet. Record an interaction, publish a
              workspace change, then continue your investigation.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

const sources = [
  {
    name: "Power BI",
    kind: "Interactive reports",
    code: "power-bi",
    description:
      "Finance Performance, Credits & Adjustments, and Product Mix, with local filters, report pages, chart selection, and sample data export.",
    boundary:
      "An intended production adapter would use an authorized embedded report session. This React report does not run the Power BI SDK.",
    route: "/reports/finance-report",
    action: "Open Finance report",
    docs: "https://learn.microsoft.com/en-us/power-bi/developer/embedded/embed-sample-for-your-organization",
  },
  {
    name: "Looker",
    kind: "Interactive dashboards",
    code: "looker",
    description:
      "Sales and regional views, with locally computed tiles and breakdowns.",
    boundary:
      "An intended live adapter would require an authorized embed session and documented event mapping. Completion alone does not prove every tile succeeded.",
    route: "/reports/sales-report",
    action: "Open Sales report",
    docs: "https://docs.cloud.google.com/looker/docs/embedded-javascript-events",
  },
  {
    name: "Snowflake",
    kind: "Governed queries",
    code: "snowflake",
    description:
      "Approved reconciliation and credits templates executed against synthetic records.",
    boundary:
      "Production would require server-side statement policy and authorization. A SQL API does not itself make arbitrary queries read-only.",
    route: "/data-explorer?source=snowflake",
    action: "Explore sample queries",
    docs: "https://docs.snowflake.com/en/developer-guide/sql-api/intro",
  },
  {
    name: "Databricks",
    kind: "Governed queries",
    code: "databricks",
    description:
      "The same governed query contract through a second local source adapter.",
    boundary:
      "Production would require statement execution, cancellation, paging, and fresh permission checks. No warehouse is contacted.",
    route: "/data-explorer?source=databricks",
    action: "Try Databricks adapter",
    docs: "https://docs.databricks.com/aws/en/dev-tools/sql-execution-tutorial",
  },
  {
    name: "Confluence",
    kind: "Business definitions",
    code: "confluence",
    description:
      "Revenue definitions, refresh documentation, and department guidance with in-workspace reading.",
    boundary:
      "A future content adapter must retrieve approved pages and recheck current access before reuse in answers.",
    route: "/knowledge/revenue-definition",
    action: "Read revenue definitions",
    docs: "https://developer.atlassian.com/cloud/confluence/rest/v2/intro/",
  },
  {
    name: "SharePoint",
    kind: "Business documentation",
    code: "sharepoint",
    description:
      "The sample close note and credits policy connect metrics to business context.",
    boundary:
      "A future Microsoft Graph adapter must preserve identity, content scope, versions, and permissions. No tenant is connected.",
    route: "/knowledge/close-note",
    action: "Read close note",
    docs: "https://learn.microsoft.com/en-us/graph/api/sitepage-get?view=graph-rest-1.0",
  },
];
export function SourceDirectory({ navigate }: PageProps) {
  return (
    <div className="sources-page page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administration · Adapter boundaries</p>
          <h1>Source Directory</h1>
          <p className="muted">
            Six sample adapters. One workspace for the task at hand.
          </p>
        </div>
      </header>
      <div className="notice">
        All source data and permissions are public synthetic fixtures. There are
        no enterprise connections, credentials, live embeds, or external model
        calls.
      </div>
      <div className="source-grid">
        {sources.map((source) => (
          <article className="card source-card" key={source.code}>
            <div className="toolbar">
              <span className={`source-badge ${source.code}`}>
                {source.name}
              </span>
              <span className="badge">Sample adapter</span>
            </div>
            <h2>{source.kind}</h2>
            <p>{source.description}</p>
            <details>
              <summary>Intended production boundary</summary>
              <p className="muted">{source.boundary}</p>
              <a href={source.docs} target="_blank" rel="noreferrer">
                Official platform documentation ↗
              </a>
            </details>
            <button
              className="button secondary"
              onClick={() => navigate(source.route)}
            >
              {source.action}
            </button>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>A shared experience, explicit boundaries</h2>
        <p>
          Viewing does not automatically authorize export or answer context. A
          host cannot observe every interaction inside a cross-origin iframe.
          The event stream records our sample adapters’ behavior and is not
          evidence of live vendor SDK operation.
        </p>
        <p className="muted">
          A local persona is a product demonstration, not enterprise
          authentication or an isolation boundary. A production implementation
          needs source authorization, revocation handling, audited server-side
          execution, and tenant validation.
        </p>
      </section>
    </div>
  );
}

export default ExperienceSettings;
