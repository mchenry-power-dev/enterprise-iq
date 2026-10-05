import { makeExperienceFixture } from "../../../examples/experience-fixtures.mjs";
import { resolveExperience } from "../../../examples/experience-configuration.mjs";
import { PERIODS, REGIONS, PRODUCTS } from "../domain/data.mjs";

export const STORAGE_KEY = "enterprise-iq:demo:v2";
export const LEGACY_KEY = "enterprise-iq:demo:v1";
export const QUERY_ROW_LIMIT_ERROR =
  "Row limit must be a whole number from 1 to 100.";
export const isQueryRowLimit = (value) =>
  Number.isInteger(value) && value >= 1 && value <= 100;
export const WORKSPACES = ["finance", "sales", "operations"];
export const REPORT_IDS = [
  "finance-report",
  "sales-report",
  "credits-report",
  "regional-report",
  "product-report",
];
export const DOCUMENT_IDS = [
  "revenue-definition",
  "close-note",
  "credits-policy",
  "refresh-lineage",
  "department-guide",
];
export const NAVIGATION =
  makeExperienceFixture().organization.settings.navigation;
const clone = (value) => structuredClone(value);
const label = (value) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= 80 &&
  !/[<>\u0000-\u001f]/.test(value);
export const safeLocalRoute = (route) =>
  typeof route === "string" &&
  /^\/(?:[a-z0-9-]+\/?)*(?:\?[a-zA-Z0-9%&=_.-]*)?$/.test(route);

export function initialState() {
  const fixture = makeExperienceFixture();
  const organization = clone(fixture.organization);
  organization.settings = {
    ...organization.settings,
    brandName: "Your analytics workspace",
    helpRoute: "/knowledge/department-guide",
    approvedActions: [
      "expand",
      "save",
      "export",
      "chart",
      "ask-iq",
      "native-open",
    ],
    layout: "balanced",
    themeDensity: "comfortable",
  };
  organization.locks = ["helpRoute", "approvedActions"];
  const departments = Object.fromEntries(
    WORKSPACES.map((workspace) => [
      workspace,
      {
        version: `${workspace}-v1`,
        locks: [],
        settings: {
          brandName: `${workspace[0].toUpperCase()}${workspace.slice(1)} workspace`,
          themeAccent: workspace === "sales" ? "teal" : "navy",
          navigation: clone(NAVIGATION),
          landingPage: "home",
          collectionResourceIds:
            workspace === "sales"
              ? ["sales-report", "regional-report", "product-report"]
              : ["finance-report", "credits-report", "sales-report"],
          contextualDocumentIds:
            workspace === "sales"
              ? ["revenue-definition", "department-guide"]
              : ["revenue-definition", "close-note"],
          defaultReport:
            workspace === "sales" ? "sales-report" : "finance-report",
          layout: workspace === "finance" ? "report-first" : "balanced",
          savedViewDefault: "summary",
        },
      },
    ]),
  );
  const configs = {
    organization,
    departments,
    personal: { version: "personal-v1", settings: {} },
    drafts: {},
    sequence: 1,
    history: [],
  };
  for (const scope of ["organization", ...WORKSPACES, "personal"])
    configs.history.push({
      id: `initial-${scope}`,
      scope,
      label: "Sample defaults",
      publishedAt: "2026-10-01T12:00:00.000Z",
      layer: clone(
        scope === "organization"
          ? organization
          : scope === "personal"
            ? configs.personal
            : departments[scope],
      ),
    });
  return {
    schemaVersion: 2,
    revision: 0,
    workspace: "finance",
    persona: "analyst",
    favorites: [],
    saved: [],
    collections: [{ id: "month-end", name: "Month-end review" }],
    recent: [],
    configs,
    telemetry: {
      recording: false,
      droppedEvents: 0,
      sessionId: null,
      startedAt: null,
      events: [],
    },
    ui: {},
  };
}

export function layerFor(state, scope) {
  if (scope === "organization") return state.configs.organization;
  if (scope === "personal") return state.configs.personal;
  if (WORKSPACES.includes(scope)) return state.configs.departments[scope];
  throw new Error("Choose an available configuration scope.");
}

/** @param {*} state @param {string} workspace @param {*} draft @param {*} access @returns {*} */
export function effectiveExperience(
  state,
  workspace = state.workspace,
  draft = null,
  access = null,
) {
  const organization =
    draft?.scope === "organization" ? draft.layer : state.configs.organization;
  const team =
    draft?.scope === workspace
      ? draft.layer
      : state.configs.departments[workspace];
  const individual =
    draft?.scope === "personal" ? draft.layer : state.configs.personal;
  return resolveExperience({
    organization,
    team,
    individual,
    access: access ?? {
      moduleIds: NAVIGATION.map((item) => item.module),
      actionIds: ["expand", "save", "export", "chart", "ask-iq", "native-open"],
      reportIds: REPORT_IDS,
      documentIds: DOCUMENT_IDS,
    },
  });
}

function validateLayerFor(state, scope, layer) {
  const workspaces = WORKSPACES.includes(scope) ? [scope] : WORKSPACES;
  for (const workspace of workspaces) {
    const result = effectiveExperience(state, workspace, { scope, layer });
    if (result.status !== "resolved")
      throw new Error(
        `Invalid configuration: ${result.errors.map((item) => item.path.split(".").at(-1)).join(", ")}.`,
      );
  }
}

export function saveDraft(state, scope, layer, now = new Date().toISOString()) {
  layerFor(state, scope);
  validateLayerFor(state, scope, layer);
  const next = clone(state);
  next.configs.drafts[scope] = {
    layer: clone(layer),
    savedAt: now,
    baseVersion: layerFor(state, scope).version,
  };
  return next;
}

export function publishDraft(
  state,
  scope,
  now = new Date().toISOString(),
  restoredFrom = null,
) {
  const draft = state.configs.drafts[scope];
  if (!draft) throw new Error("Save a draft before publishing.");
  if (draft.baseVersion !== layerFor(state, scope).version)
    throw new Error(
      "This draft is based on an older version. Review and save it again.",
    );
  validateLayerFor(state, scope, draft.layer);
  const next = clone(state);
  const sequence = ++next.configs.sequence;
  const layer = { ...clone(draft.layer), version: `${scope}-v${sequence}` };
  if (scope === "organization") next.configs.organization = layer;
  else if (scope === "personal") next.configs.personal = layer;
  else next.configs.departments[scope] = layer;
  next.configs.history.unshift({
    id: `${scope}-v${sequence}`,
    scope,
    label: restoredFrom ? "Restored version" : "Published configuration",
    publishedAt: now,
    layer: clone(layer),
    restoredFrom,
  });
  delete next.configs.drafts[scope];
  return next;
}

export function restoreVersion(
  state,
  versionId,
  now = new Date().toISOString(),
) {
  const version = state.configs.history.find((item) => item.id === versionId);
  if (!version) throw new Error("That configuration version is unavailable.");
  return publishDraft(
    saveDraft(state, version.scope, version.layer, now),
    version.scope,
    now,
    version.id,
  );
}

export function toggleFavorite(state, resourceId) {
  if (
    ![
      ...REPORT_IDS,
      ...DOCUMENT_IDS,
      "revenue-reconciliation",
      "credits-by-period",
      "sales-by-region",
      "dataset-freshness",
    ].includes(resourceId)
  )
    throw new Error("Only catalog resources can be favorited.");
  return {
    ...state,
    favorites: state.favorites.includes(resourceId)
      ? state.favorites.filter((id) => id !== resourceId)
      : [...state.favorites, resourceId],
  };
}

export function saveItem(state, item, now = new Date().toISOString()) {
  if (
    !label(item.title) ||
    !["report", "query", "investigation", "documentation"].includes(
      item.kind,
    ) ||
    !safeLocalRoute(item.route)
  )
    throw new Error(
      "A saved item needs a title, supported type, and local route.",
    );
  assertSavedQuery(item.context ?? {});
  const next = clone(state);
  const id =
    item.id ??
    `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const saved = {
    id,
    title: item.title.trim(),
    kind: item.kind,
    route: item.route,
    context: clone(item.context ?? {}),
    savedAt: now,
    collectionId: item.collectionId ?? null,
  };
  const index = next.saved.findIndex((entry) => entry.id === id);
  if (index < 0) next.saved.unshift(saved);
  else next.saved[index] = saved;
  return next;
}

export function recordRecent(state, resource, now = new Date().toISOString()) {
  if (
    !resource?.id ||
    !label(resource.title) ||
    !safeLocalRoute(resource.route)
  )
    return state;
  return {
    ...state,
    recent: [
      {
        id: resource.id,
        title: resource.title,
        route: resource.route,
        viewedAt: now,
      },
      ...state.recent.filter((item) => item.id !== resource.id),
    ].slice(0, 12),
  };
}

export function isSavedVisible(item, permittedIds) {
  if (!safeLocalRoute(item?.route)) return false;
  const [path, query = ""] = item.route.split("?");
  const [, module, id] = path.split("/");
  if (module === "reports" || module === "knowledge")
    return permittedIds.includes(id);
  if (module === "data-explorer")
    return permittedIds.includes(
      new URLSearchParams(query).get("template") ??
        item.context?.query?.template ??
        "revenue-reconciliation",
    );
  return module === "ask-iq";
}

/** Restore parameters only; opening a saved query still requires a fresh local run. */
export function restoreSavedContext(state, item, permittedIds) {
  if (!isSavedVisible(item, permittedIds))
    throw new Error(
      "This saved resource is unavailable for the current demo persona.",
    );
  assertSavedQuery(item.context ?? {});
  const source = item.context?.filters ?? item.context ?? {};
  const filters = Object.fromEntries(
    ["period", "region", "product", "entity"]
      .filter((key) => typeof source[key] === "string")
      .map((key) => [key, source[key]]),
  );
  return {
    ...state,
    ui: {
      ...state.ui,
      ...(Object.keys(filters).length
        ? { filters: { ...state.ui.filters, ...filters } }
        : {}),
      ...(item.context?.query ? { query: clone(item.context.query) } : {}),
    },
  };
}

export function createCollection(state, name) {
  if (!label(name))
    throw new Error("Use a name from 1 to 80 characters, without markup.");
  if (
    state.collections.some(
      (item) =>
        item.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
    )
  )
    throw new Error("A collection with this name already exists.");
  return {
    ...state,
    collections: [
      ...state.collections,
      { id: `collection-${Date.now().toString(36)}`, name: name.trim() },
    ],
  };
}

export function renameCollection(state, id, name) {
  if (!label(name))
    throw new Error("Use a name from 1 to 80 characters, without markup.");
  if (
    state.collections.some(
      (item) =>
        item.id !== id &&
        item.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
    )
  )
    throw new Error("A collection with this name already exists.");
  return {
    ...state,
    collections: state.collections.map((item) =>
      item.id === id ? { ...item, name: name.trim() } : item,
    ),
  };
}

const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const identifier = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
const timestamp = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const optional = (value, check) => value === undefined || check(value);
const queryIds = [
  "revenue-reconciliation",
  "credits-by-period",
  "sales-by-region",
  "dataset-freshness",
];
const querySources = ["Snowflake", "Databricks"];
const validFilters = (value) =>
  object(value) &&
  PERIODS.includes(value.period) &&
  value.entity === "aster-us" &&
  ["All", ...REGIONS].includes(value.region) &&
  ["All", ...PRODUCTS].includes(value.product);
const validQuery = (value) =>
  object(value) &&
  optional(value.template, (id) => queryIds.includes(id)) &&
  optional(value.source, (source) => querySources.includes(source)) &&
  optional(value.scenario, (scenario) =>
    ["complete", "partial", "failed", "empty"].includes(scenario),
  ) &&
  optional(value.limit, isQueryRowLimit);

function assertSavedQuery(context) {
  if (!object(context))
    throw new Error("Saved context is unavailable. Save this view again.");
  if (!Object.hasOwn(context, "query")) return;
  const query = context.query;
  if (
    object(query) &&
    Object.hasOwn(query, "limit") &&
    !isQueryRowLimit(query.limit)
  )
    throw new Error(QUERY_ROW_LIMIT_ERROR);
  if (!validQuery(query))
    throw new Error(
      "Saved query parameters are unavailable. Choose an approved template and source.",
    );
}

/** Validate the nested shapes actually consumed by pages before rendering them. */
function validPersistedContent(state) {
  const resources = [...REPORT_IDS, ...DOCUMENT_IDS, ...queryIds];
  if (
    !["analyst", "restricted", "admin"].includes(state.persona) ||
    !object(state.ui) ||
    !state.favorites.every((id) => resources.includes(id)) ||
    !state.collections.every(
      (item) => object(item) && identifier(item.id) && label(item.name),
    ) ||
    !state.recent.every(
      (item) =>
        object(item) &&
        identifier(item.id) &&
        label(item.title) &&
        safeLocalRoute(item.route),
    ) ||
    !state.saved.every(
      (item) =>
        object(item) &&
        identifier(item.id) &&
        ["report", "query", "investigation", "documentation"].includes(
          item.kind,
        ) &&
        optional(item.context, object) &&
        optional(item.collectionId, (id) => id === null || identifier(id)),
    ) ||
    !optional(state.ui.filters, validFilters) ||
    !optional(state.ui.query, validQuery) ||
    !optional(
      state.ui.lastQueryInterrupted,
      (value) => typeof value === "boolean",
    ) ||
    !optional(
      state.ui.queryHistory,
      (history) =>
        Array.isArray(history) &&
        history.every(
          (item) =>
            object(item) &&
            identifier(item.id) &&
            queryIds.includes(item.template) &&
            querySources.includes(item.source) &&
            validFilters(item.parameters) &&
            validQuery(item.parameters) &&
            Number.isInteger(item.rows) &&
            item.rows >= 0 &&
            item.rows <= 100 &&
            ["complete", "partial"].includes(item.coverage) &&
            item.status === "succeeded",
        ),
    )
  )
    return false;
  const telemetry = state.telemetry;
  return (
    typeof telemetry.recording === "boolean" &&
    (telemetry.sessionId === null || identifier(telemetry.sessionId)) &&
    (telemetry.startedAt === null || timestamp(telemetry.startedAt)) &&
    (!telemetry.recording ||
      (identifier(telemetry.sessionId) && timestamp(telemetry.startedAt))) &&
    optional(
      telemetry.droppedEvents,
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) &&
    telemetry.events.every(
      (event) =>
        object(event) &&
        timestamp(event.occurred_at) &&
        [
          "event_id",
          "event_name",
          "tenant_id",
          "workspace_id",
          "subject_id",
          "session_id",
          "journey_id",
          "experience_config_version",
        ].every((key) => identifier(event[key])),
    )
  );
}

/** A migration never replaces unreadable/newer data; callers offer a recovery choice. */
export function migrateState(value) {
  if (!object(value) || ![1, 2].includes(value.schemaVersion))
    throw new Error(
      "This saved data uses an unsupported format. Your stored copy has been preserved.",
    );
  const defaults = initialState();
  const next =
    value.schemaVersion === 1
      ? {
          ...defaults,
          ...clone(value),
          schemaVersion: 2,
          configs: value.configs ?? defaults.configs,
          telemetry: value.telemetry ?? defaults.telemetry,
        }
      : clone(value);
  if (
    !Number.isSafeInteger(next.revision) ||
    next.revision < 0 ||
    !WORKSPACES.includes(next.workspace) ||
    !Array.isArray(next.favorites) ||
    !Array.isArray(next.saved) ||
    !Array.isArray(next.collections) ||
    !Array.isArray(next.recent) ||
    !object(next.configs?.organization) ||
    !object(next.configs?.departments) ||
    !object(next.configs?.personal) ||
    !object(next.configs?.drafts) ||
    !Number.isSafeInteger(next.configs?.sequence) ||
    next.configs.sequence < 1 ||
    !Array.isArray(next.configs.history) ||
    !object(next.telemetry) ||
    !Array.isArray(next.telemetry.events) ||
    !validPersistedContent(next)
  )
    throw new Error(
      "Saved data could not be read. Your stored copy has been preserved.",
    );
  if (
    next.saved.some((item) => !safeLocalRoute(item.route) || !label(item.title))
  )
    throw new Error(
      "Saved data contains an unsupported route or title. Your stored copy has been preserved.",
    );
  for (const workspace of WORKSPACES)
    if (effectiveExperience(next, workspace).status !== "resolved")
      throw new Error(
        "Saved configuration is invalid. Your stored copy has been preserved.",
      );
  const scopes = ["organization", ...WORKSPACES, "personal"];
  for (const [scope, draft] of Object.entries(next.configs.drafts)) {
    if (
      !scopes.includes(scope) ||
      !object(draft) ||
      !identifier(draft.baseVersion) ||
      !timestamp(draft.savedAt)
    )
      throw new Error(
        "Saved draft data is invalid. Your stored copy has been preserved.",
      );
    validateLayerFor(next, scope, draft.layer);
  }
  for (const version of next.configs.history) {
    if (
      !object(version) ||
      !scopes.includes(version.scope) ||
      !identifier(version.id) ||
      !label(version.label) ||
      !timestamp(version.publishedAt)
    )
      throw new Error(
        "Saved version history is invalid. Your stored copy has been preserved.",
      );
    validateLayerFor(next, version.scope, version.layer);
  }
  next.telemetry.droppedEvents ??= 0;
  return next;
}

/** Restricts all reads/removals to this application's two explicit keys. */
export function createPersistence(storage) {
  let status = "persistent";
  let message = "";
  let recoveryRaw = null;
  const fallback = (error) => {
    status = "session";
    message = `Session-only changes: browser storage is unavailable${error?.name === "QuotaExceededError" ? " (storage is full)" : ""}. Keep this tab open or export a backup.`;
  };
  return {
    status: () => ({ status, message, recoveryRaw }),
    read() {
      if (!storage) {
        fallback();
        return initialState();
      }
      try {
        const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_KEY);
        if (!raw) return initialState();
        try {
          return migrateState(JSON.parse(raw));
        } catch (error) {
          recoveryRaw = raw;
          status = "recovery";
          message = error.message;
          return initialState();
        }
      } catch (error) {
        fallback(error);
        return initialState();
      }
    },
    write(state, expectedRevision, { overwrite = false } = {}) {
      if (status === "recovery") return { status: "recovery", message };
      const next = {
        ...state,
        schemaVersion: 2,
        revision: expectedRevision + 1,
      };
      if (status === "session") return { status: "session", state: next };
      try {
        const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_KEY);
        if (!raw && expectedRevision > 0 && !overwrite)
          return {
            status: "conflict",
            remote: initialState(),
            message:
              "Enterprise IQ data was reset in another tab. Choose which version to keep.",
          };
        if (raw && !overwrite) {
          let remote;
          try {
            remote = migrateState(JSON.parse(raw));
          } catch {
            return {
              status: "conflict",
              message:
                "Saved data changed in another tab. Review before replacing it.",
            };
          }
          if (remote.revision !== expectedRevision)
            return { status: "conflict", remote };
        }
        storage.setItem(STORAGE_KEY, JSON.stringify(next));
        return { status: "persistent", state: next };
      } catch (error) {
        fallback(error);
        return { status: "session", state: next };
      }
    },
    sessionOnly() {
      status = "session";
      message =
        "Session-only mode. The unreadable stored copy remains untouched.";
    },
    reset() {
      try {
        storage?.removeItem(STORAGE_KEY);
        storage?.removeItem(LEGACY_KEY);
        status = storage ? "persistent" : "session";
        message = "";
        recoveryRaw = null;
      } catch (error) {
        fallback(error);
      }
      return initialState();
    },
  };
}
