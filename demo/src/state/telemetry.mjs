import {
  createTelemetryCollector,
  computeJourneyMetrics,
  EVENT_CONTRACT,
} from "../../../examples/journey-telemetry.mjs";
import { runJourneyReference } from "../../../examples/journey-fixtures.mjs";
import {
  effectiveExperience,
  WORKSPACES,
  REPORT_IDS,
  DOCUMENT_IDS,
} from "./model.mjs";

export const SAMPLE_WINDOW = {
  start: "2026-10-02T00:00:00.000Z",
  end: "2026-10-04T00:00:00.000Z",
};
export const EVENT_LABELS = {
  workspace_viewed: "Workspace viewed",
  search_submitted: "Search submitted",
  search_results_shown: "Search results shown",
  report_open_requested: "Report opened",
  report_initialized: "Report initialized",
  report_rendered: "Report rendered",
  report_interaction: "Report interaction",
  report_page_changed: "Report page changed",
  documentation_opened: "Document opened",
  definition_opened: "Definition viewed",
  query_submitted: "Query submitted",
  query_completed: "Query completed",
  query_results_viewed: "Results viewed",
  query_cancelled: "Query cancelled",
  query_failed: "Query failed",
  iq_question_submitted: "Guided question selected",
  iq_answer_presented: "Guided answer presented",
  iq_source_opened: "Answer source opened",
  resource_saved: "Item saved",
  native_source_opened: "Source handoff",
  experience_variant_exposed: "Experience viewed",
  experience_configuration_published: "Configuration published",
};

export function sampleEvents() {
  const events = [];
  for (const workspace of WORKSPACES)
    for (let variant = 1; variant <= 2; variant++) {
      const reference = runJourneyReference({
        experienceConfigVersion: `sample-v${variant}`,
      });
      for (const event of reference.events) {
        const offset = variant === 1 ? -86400000 : 0;
        events.push({
          ...event,
          event_id: `${workspace}-${variant}-${event.event_id}`,
          workspace_id: `synthetic-${workspace}`,
          subject_id: `${workspace}-${variant}-${event.subject_id}`,
          session_id: `${workspace}-${variant}-${event.session_id}`,
          journey_id: `${workspace}-${variant}-${event.journey_id}`,
          occurred_at: new Date(
            Date.parse(event.occurred_at) + offset,
          ).toISOString(),
          received_at: new Date(
            Date.parse(event.received_at) + offset,
          ).toISOString(),
        });
      }
    }
  return events;
}
export const SAMPLE_EVENTS = sampleEvents();

/** Closed vocabulary only. No search, question, SQL, rows, URLs or identity strings are accepted. */
export function recordEvent(
  state,
  name,
  details = {},
  now = new Date().toISOString(),
) {
  if (!state.telemetry.recording || !Object.hasOwn(EVENT_CONTRACT, name))
    return state;
  const workspace = WORKSPACES.includes(details.workspace)
    ? details.workspace
    : state.workspace;
  const source = [
    "enterprise-iq",
    "power-bi",
    "looker",
    "snowflake",
    "databricks",
    "confluence",
    "sharepoint",
  ].includes(details.source)
    ? details.source
    : "enterprise-iq";
  const allowedResources = [
    ...REPORT_IDS,
    ...DOCUMENT_IDS,
    "revenue-reconciliation",
    "credits-by-period",
    "sales-by-region",
    "dataset-freshness",
    "home",
    "catalog",
    "guided-answer",
    "configuration",
  ];
  const resource = allowedResources.includes(details.resourceId)
    ? details.resourceId
    : "home";
  const cleanToken = (value, fallback) =>
    typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value)
      ? value
      : fallback;
  const session = state.telemetry.sessionId;
  const context = {
    synthetic_trust: true,
    telemetry_enabled: true,
    tenant_id: "browser-local",
    workspace_id: `local-${workspace}`,
    subject_id: "local-visitor",
    session_id: session,
    journey_id: session,
    view_instance_id: cleanToken(
      details.viewId ?? details.view_instance_id,
      `view-${resource}`,
    ),
    resource_ref: resource,
    experience_config_version: effectiveExperience(state, workspace)
      .experience_config_version,
    source_system: source,
    action_origin: details.background ? "background" : "user",
    purpose: "employee",
  };
  for (const [field, key] of [
    ["query_id", "queryId"],
    ["search_id", "searchId"],
    ["question_id", "questionId"],
  ])
    if (details[key] ?? details[field])
      context[field] = cleanToken(
        details[key] ?? details[field],
        `${field}-local`,
      );
  const collector = createTelemetryCollector({ now: () => now });
  const raw = {
    schema_version: 1,
    event_id: cleanToken(
      details.eventId,
      `local-${state.telemetry.events.length + 1}-${Date.parse(now).toString(36)}`,
    ),
    occurred_at: now,
    event_name: name,
    params: details.params ?? {},
  };
  const channel = EVENT_CONTRACT[name].channel;
  if (channel === "embed") collector.sampleEmbed(raw, context);
  else collector[channel](raw, context);
  const events = collector.events({
    tenant_id: "browser-local",
    workspace_id: `local-${workspace}`,
  });
  if (
    !events.length ||
    state.telemetry.events.some(
      (event) => event.event_id === events[0].event_id,
    )
  )
    return state;
  return {
    ...state,
    telemetry: {
      ...state.telemetry,
      events: [...state.telemetry.events, ...events].slice(-1000),
      droppedEvents:
        (state.telemetry.droppedEvents ?? 0) +
        Math.max(0, state.telemetry.events.length + events.length - 1000),
    },
  };
}

export function startRecording(state, now = new Date().toISOString()) {
  return {
    ...state,
    telemetry: {
      recording: true,
      droppedEvents: 0,
      startedAt: now,
      sessionId: `session-${Date.parse(now).toString(36)}`,
      events: [],
    },
  };
}
export const stopRecording = (state) => ({
  ...state,
  telemetry: { ...state.telemetry, recording: false },
});
export const deleteRecording = (state) => ({
  ...state,
  telemetry: {
    recording: false,
    startedAt: null,
    sessionId: null,
    events: [],
    droppedEvents: 0,
  },
});

export function analytics(
  events,
  {
    workspace = "finance",
    local = false,
    source = "",
    version = "",
    start = SAMPLE_WINDOW.start,
    end = SAMPLE_WINDOW.end,
  } = {},
) {
  const tenant_id = local ? "browser-local" : "synthetic-tenant";
  const workspace_id = `${local ? "local" : "synthetic"}-${workspace}`;
  const filtered = events.filter(
    (event) =>
      event.tenant_id === tenant_id &&
      event.workspace_id === workspace_id &&
      (!source || event.source_system === source) &&
      (!version || event.experience_config_version === version) &&
      event.occurred_at >= start &&
      event.occurred_at < end,
  );
  const result = computeJourneyMetrics(filtered, {
    tenant_id,
    workspace_id,
    start,
    end,
    minimumSubjects: local ? 1 : 3,
    ...(version ? { experienceConfigVersion: version } : {}),
    ...(source ? { sourceSystem: source } : {}),
  });
  const paths = new Map();
  const sessions = new Map();
  for (const event of [...filtered].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at),
  )) {
    const session = `${event.subject_id}-${event.session_id}`;
    const previous = sessions.get(session);
    const segment =
      previous && Date.parse(event.occurred_at) - previous.at <= 1800000
        ? previous.segment
        : (previous?.segment ?? -1) + 1;
    sessions.set(session, { segment, at: Date.parse(event.occurred_at) });
    const id = `${event.journey_id}-${event.experience_config_version}-${segment}`;
    if (!paths.has(id)) paths.set(id, []);
    paths.get(id).push(event);
  }
  const daily = new Map();
  for (const event of filtered) {
    const day = event.occurred_at.slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + 1);
  }
  return {
    ...result,
    events: filtered,
    paths: [...paths.values()],
    daily: [...daily].sort().map(([date, count]) => ({ date, count })),
  };
}

export function funnel(paths, steps) {
  return steps.map((step, index) => ({
    step,
    count: paths.filter((path) => {
      let position = -1;
      for (const name of steps.slice(0, index + 1)) {
        position = path.findIndex(
          (event, i) => i > position && event.event_name === name,
        );
        if (position < 0) return false;
      }
      return true;
    }).length,
  }));
}
