import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha256 } from "../../examples/sha256.mjs";
import {
  initialState,
  effectiveExperience,
  saveDraft,
  publishDraft,
  restoreVersion,
  toggleFavorite,
  saveItem,
  recordRecent,
  createCollection,
  renameCollection,
  migrateState,
  createPersistence,
  STORAGE_KEY,
  LEGACY_KEY,
  isSavedVisible,
  restoreSavedContext,
  isQueryRowLimit,
  QUERY_ROW_LIMIT_ERROR,
} from "../src/state/model.mjs";
import {
  recordEvent,
  startRecording,
  stopRecording,
  deleteRecording,
  analytics,
  SAMPLE_EVENTS,
  funnel,
} from "../src/state/telemetry.mjs";

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  const removed = [];
  return {
    values,
    removed,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => {
      removed.push(key);
      values.delete(key);
    },
  };
}
const draftTitle = (state, title = "Finance in focus", scope = "finance") =>
  saveDraft(state, scope, {
    ...state.configs.departments[scope],
    settings: {
      ...state.configs.departments[scope].settings,
      brandName: title,
    },
  });

test("browser SHA-256 preserves reference digest for empty, ASCII, Unicode and multiblock input", () => {
  for (const input of [
    "",
    "abc",
    "September revenue · 日本語 🧭",
    "a".repeat(100000),
  ])
    assert.equal(
      sha256(input),
      createHash("sha256").update(input).digest("hex"),
    );
});
test("workspace defaults produce distinct coherent experiences and organization locks", () => {
  const state = initialState();
  const finance = effectiveExperience(state, "finance");
  const sales = effectiveExperience(state, "sales");
  assert.equal(finance.status, "resolved");
  assert.equal(sales.status, "resolved");
  assert.notDeepEqual(
    finance.effective.collectionResourceIds,
    sales.effective.collectionResourceIds,
  );
  assert.equal(finance.provenance.helpRoute.lockedBy, "organization");
  assert.equal(finance.effective.themeDensity, "comfortable");
});
test("draft and preview leave active configuration untouched until publishing", () => {
  const original = initialState();
  const draft = draftTitle(original);
  assert.equal(
    effectiveExperience(draft, "finance").effective.brandName,
    "Finance workspace",
  );
  assert.equal(
    effectiveExperience(draft, "finance", {
      scope: "finance",
      layer: draft.configs.drafts.finance.layer,
    }).effective.brandName,
    "Finance in focus",
  );
  const published = publishDraft(draft, "finance", "2026-10-04T12:00:00.000Z");
  assert.equal(
    effectiveExperience(published, "finance").effective.brandName,
    "Finance in focus",
  );
  assert.equal(published.configs.drafts.finance, undefined);
  assert.equal(published.configs.history[0].scope, "finance");
  assert.equal(original.configs.history.length, 5);
});
test("restore is a new version with preserved history and changed effective attribution", () => {
  const state = publishDraft(draftTitle(initialState()), "finance");
  const restored = restoreVersion(state, "initial-finance");
  assert.equal(
    effectiveExperience(restored, "finance").effective.brandName,
    "Finance workspace",
  );
  assert.notEqual(restored.configs.departments.finance.version, "finance-v1");
  assert.equal(
    restored.configs.history.length,
    state.configs.history.length + 1,
  );
  assert.equal(restored.configs.history[0].restoredFrom, "initial-finance");
  assert.notEqual(
    effectiveExperience(restored).experience_config_version,
    effectiveExperience(state).experience_config_version,
  );
});
test("organization and team locks defeat personal overrides while retaining provenance", () => {
  let state = initialState();
  state.configs.departments.finance.settings.themeAccent = "teal";
  state.configs.departments.finance.locks = ["themeAccent"];
  state.configs.personal.settings = {
    themeAccent: "plum",
    helpRoute: "/reports",
  };
  const resolved = effectiveExperience(state);
  assert.equal(resolved.effective.themeAccent, "teal");
  assert.equal(resolved.provenance.themeAccent.lockedBy, "team");
  assert.equal(resolved.effective.helpRoute, "/knowledge/department-guide");
  assert.equal(resolved.conflicts.length, 2);
});
test("configuration rejects unsafe navigation, unknown keys and markup", () => {
  const state = initialState();
  for (const settings of [
    { brandName: "<script>x</script>" },
    { helpRoute: "https://example.com" },
    { navigation: [{ module: "admin", label: "Admin" }] },
    { permissions: ["all"] },
  ]) {
    assert.throws(
      () =>
        saveDraft(state, "finance", {
          version: "test-v1",
          settings,
          locks: [],
        }),
      /Invalid configuration/,
    );
  }
});
test("a preference cannot grant reports or modules absent from supplied synthetic access", () => {
  const state = initialState();
  const result = effectiveExperience(state, "finance", null, {
    moduleIds: ["home"],
    actionIds: [],
    reportIds: [],
    documentIds: [],
  });
  assert.deepEqual(result.effective.collectionResourceIds, []);
  assert.deepEqual(result.effective.approvedActions, []);
  assert.deepEqual(result.effective.navigation, [
    { module: "home", label: "Home" },
  ]);
});
test("publishing without a draft or with a stale draft fails usefully", () => {
  const state = initialState();
  assert.throws(() => publishDraft(state, "finance"), /Save a draft/);
  const draft = draftTitle(state);
  draft.configs.departments.finance.version = "concurrent-version";
  assert.throws(() => publishDraft(draft, "finance"), /older version/);
});
test("favorites, saved views and collections retain actual routes and parameters", () => {
  let state = toggleFavorite(initialState(), "finance-report");
  state = toggleFavorite(state, "finance-report");
  assert.deepEqual(state.favorites, []);
  state = saveItem(state, {
    id: "query-view",
    kind: "query",
    title: "Credits · East",
    route: "/data-explorer?template=credits-by-period&region=East",
    context: { period: "2026-09", region: "East" },
  });
  state = createCollection(state, "September close");
  const id = state.collections.at(-1).id;
  state = renameCollection(state, id, "September evidence");
  assert.equal(state.saved[0].context.region, "East");
  assert.equal(state.collections.at(-1).name, "September evidence");
  assert.throws(
    () => createCollection(state, "September evidence"),
    /already exists/,
  );
  assert.throws(
    () =>
      saveItem(state, {
        kind: "query",
        title: "Unsafe",
        route: "javascript:alert(1)",
      }),
    /local route/,
  );
});
test("unfinished or invalid query limits cannot be saved or restored into persistent UI state", () => {
  const state = initialState();
  const original = structuredClone(state);
  const item = {
    id: "query-view",
    kind: "query",
    title: "Credits",
    route: "/data-explorer?template=credits-by-period",
  };
  for (const input of ["", " ", "0", "-1", "1.5", "101", "not-a-number"]) {
    const limit = Number(input);
    assert.equal(isQueryRowLimit(limit), false, input);
    const invalid = {
      ...item,
      context: {
        query: {
          template: "credits-by-period",
          source: "Snowflake",
          scenario: "complete",
          limit,
        },
      },
    };
    assert.throws(() => saveItem(state, invalid), {
      message: QUERY_ROW_LIMIT_ERROR,
    });
    assert.throws(
      () => restoreSavedContext(state, invalid, ["credits-by-period"]),
      { message: QUERY_ROW_LIMIT_ERROR },
    );
    assert.deepEqual(state, original);
  }
  for (const query of [
    { source: "unrecognized" },
    { template: "unapproved" },
    { scenario: "unrecognized" },
    null,
  ]) {
    const invalid = { ...item, context: { query } };
    assert.throws(() => saveItem(state, invalid), /Saved query parameters/);
    assert.throws(
      () => restoreSavedContext(state, invalid, ["credits-by-period"]),
      /Saved query parameters/,
    );
  }
});

test("valid query limit endpoints and a changed limit restore, persist, and reload without a recovery conflict", () => {
  for (const limit of [1, 3, 100]) {
    const storage = memoryStorage();
    const adapter = createPersistence(storage);
    let state = adapter.read();
    state = saveItem(state, {
      id: "query-view",
      kind: "query",
      title: "Credits",
      route: "/data-explorer?template=credits-by-period",
      context: {
        query: {
          template: "credits-by-period",
          source: "Snowflake",
          scenario: "complete",
          limit,
        },
      },
    });
    state = adapter.write(state, state.revision).state;
    state = restoreSavedContext(state, state.saved[0], ["credits-by-period"]);
    const restored = adapter.write(state, state.revision);
    assert.equal(restored.status, "persistent");
    assert.equal(restored.state.ui.query.limit, limit);
    assert.equal(
      adapter.write(restored.state, restored.state.revision).status,
      "persistent",
    );
    const reopened = createPersistence(storage);
    assert.equal(reopened.read().ui.query.limit, limit);
    assert.equal(reopened.status().status, "persistent");
  }
});

test("recent resources deduplicate by resource and have a bounded useful history", () => {
  let state = initialState();
  for (let i = 0; i < 20; i++)
    state = recordRecent(state, {
      id: `report-${i}`,
      title: `Report ${i}`,
      route: `/reports/report-${i}`,
    });
  assert.equal(state.recent.length, 12);
  state = recordRecent(state, {
    id: "report-18",
    title: "Report 18",
    route: "/reports/report-18",
  });
  assert.equal(state.recent[0].id, "report-18");
  assert.equal(state.recent.length, 12);
});
test("saved report and query reopening restores scope but rechecks current visibility", () => {
  const state = initialState();
  const query = {
    route: "/data-explorer?template=credits-by-period",
    context: {
      filters: {
        period: "2026-08",
        region: "East",
        product: "Services",
        entity: "US",
      },
      query: {
        template: "credits-by-period",
        source: "Databricks",
        scenario: "partial",
        limit: 10,
      },
    },
  };
  assert.equal(isSavedVisible(query, ["sales-by-region"]), false);
  assert.throws(() => restoreSavedContext(state, query, []), /unavailable/);
  const restored = restoreSavedContext(state, query, ["credits-by-period"]);
  assert.equal(restored.ui.filters.period, "2026-08");
  assert.equal(restored.ui.query.source, "Databricks");
  assert.equal(restored.ui.query.limit, 10);
  assert.equal(
    isSavedVisible({ route: "/reports/credits-report" }, ["finance-report"]),
    false,
  );
  assert.equal(
    restoreSavedContext(
      state,
      {
        route: "/ask-iq?question=reconcile",
        context: { period: "2026-08", region: "West" },
      },
      [],
    ).ui.filters.region,
    "West",
  );
});
test("current persistence survives reopening and is isolated from sibling application keys", () => {
  const storage = memoryStorage({
    "loom:state": "do not touch",
    "orbit:data": "preserve",
  });
  const persistence = createPersistence(storage);
  let state = persistence.read();
  state = saveItem(state, {
    kind: "investigation",
    title: "September bridge",
    route: "/ask-iq?period=2026-09",
  });
  assert.equal(persistence.write(state, 0).status, "persistent");
  assert.equal(createPersistence(storage).read().saved.length, 1);
  persistence.reset();
  assert.deepEqual(storage.removed, [STORAGE_KEY, LEGACY_KEY]);
  assert.equal(storage.values.get("loom:state"), "do not touch");
  assert.equal(storage.values.get("orbit:data"), "preserve");
});
test("schema upgrade preserves saved work and leaves original legacy storage intact", () => {
  const legacy = {
    ...initialState(),
    schemaVersion: 1,
    saved: [
      {
        id: "legacy-view",
        kind: "report",
        title: "My report",
        route: "/reports/finance-report",
        context: { region: "East" },
      },
    ],
  };
  delete legacy.configs;
  delete legacy.telemetry;
  const storage = memoryStorage({ [LEGACY_KEY]: JSON.stringify(legacy) });
  const adapter = createPersistence(storage);
  const migrated = adapter.read();
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.saved[0].context.region, "East");
  adapter.write(migrated, migrated.revision);
  assert.equal(storage.values.get(LEGACY_KEY), JSON.stringify(legacy));
});
test("corrupt and newer stored data are quarantined until explicit recovery choice", () => {
  for (const raw of [
    "{not json}",
    JSON.stringify({ ...initialState(), schemaVersion: 99 }),
  ]) {
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const adapter = createPersistence(storage);
    adapter.read();
    assert.equal(adapter.status().status, "recovery");
    assert.equal(adapter.write(initialState(), 0).status, "recovery");
    assert.equal(storage.values.get(STORAGE_KEY), raw);
    adapter.sessionOnly();
    assert.equal(adapter.write(initialState(), 0).status, "session");
    assert.equal(storage.values.get(STORAGE_KEY), raw);
  }
});
test("malformed nested persisted values enter recovery before a page can consume them", () => {
  const corruptions = [
    [
      "missing UI",
      (state) => {
        delete state.ui;
      },
    ],
    [
      "null UI",
      (state) => {
        state.ui = null;
      },
    ],
    [
      "array UI",
      (state) => {
        state.ui = [];
      },
    ],
    [
      "unknown persona",
      (state) => {
        state.persona = "unrecognized-role";
      },
    ],
    [
      "incomplete filters",
      (state) => {
        state.ui.filters = { period: "2026-09" };
      },
    ],
    [
      "invalid period",
      (state) => {
        state.ui.filters = {
          period: "bad-date",
          entity: "aster-us",
          region: "All",
          product: "All",
        };
      },
    ],
    [
      "invalid query parameters",
      (state) => {
        state.ui.query = { source: "unrecognized-source", limit: 0 };
      },
    ],
    [
      "malformed query history",
      (state) => {
        state.ui.queryHistory = [null];
      },
    ],
    [
      "unknown favorite",
      (state) => {
        state.favorites = ["unrecognized-resource"];
      },
    ],
    [
      "invalid collection",
      (state) => {
        state.collections = [{ id: "broken", name: 7 }];
      },
    ],
    [
      "invalid recent title",
      (state) => {
        state.recent = [
          { id: "finance-report", title: {}, route: "/reports/finance-report" },
        ];
      },
    ],
    [
      "malformed saved entry",
      (state) => {
        state.saved = [null];
      },
    ],
    [
      "malformed saved context",
      (state) => {
        state.saved = [
          {
            id: "saved-one",
            title: "Saved report",
            kind: "report",
            route: "/reports/finance-report",
            context: [],
          },
        ];
      },
    ],
    [
      "missing drafts",
      (state) => {
        delete state.configs.drafts;
      },
    ],
    [
      "malformed draft",
      (state) => {
        state.configs.drafts.finance = { layer: null };
      },
    ],
    [
      "malformed version",
      (state) => {
        state.configs.history.push(null);
      },
    ],
    [
      "invalid history layer",
      (state) => {
        state.configs.history[0].layer.settings.brandName =
          "<script>bad</script>";
      },
    ],
    [
      "invalid recording flag",
      (state) => {
        state.telemetry.recording = "true";
      },
    ],
    [
      "recording without a session",
      (state) => {
        state.telemetry.recording = true;
      },
    ],
    [
      "invalid retained event",
      (state) => {
        state.telemetry.events = [null];
      },
    ],
    [
      "invalid retained count",
      (state) => {
        state.telemetry.droppedEvents = -1;
      },
    ],
  ];
  for (const [name, corrupt] of corruptions) {
    const state = initialState();
    corrupt(state);
    const raw = JSON.stringify(state);
    const storage = memoryStorage({
      [STORAGE_KEY]: raw,
      "unrelated-app": "preserve",
    });
    const adapter = createPersistence(storage);
    const recovered = adapter.read();
    assert.equal(adapter.status().status, "recovery", name);
    assert.equal(adapter.status().recoveryRaw, raw, name);
    assert.deepEqual(recovered, initialState(), name);
    assert.equal(adapter.write(initialState(), 0).status, "recovery", name);
    assert.equal(storage.values.get(STORAGE_KEY), raw, name);
    assert.equal(storage.values.get("unrelated-app"), "preserve", name);
    adapter.sessionOnly();
    assert.equal(
      adapter.write({ ...recovered, favorites: ["sales-report"] }, 0).status,
      "session",
      name,
    );
    assert.equal(storage.values.get(STORAGE_KEY), raw, name);
  }
});

test("valid published history, pending drafts, saved context and query UI survive a persistence round trip", () => {
  let state = publishDraft(draftTitle(initialState()), "finance");
  state = draftTitle(state, "Next draft");
  state.persona = "restricted";
  state.ui = {
    filters: {
      period: "2026-08",
      entity: "aster-us",
      region: "West",
      product: "Services",
    },
    query: {
      template: "sales-by-region",
      source: "Databricks",
      scenario: "partial",
      limit: 10,
    },
    queryHistory: [
      {
        id: "execution-one",
        template: "sales-by-region",
        source: "Databricks",
        rows: 1,
        coverage: "partial",
        status: "succeeded",
        parameters: {
          period: "2026-08",
          entity: "aster-us",
          region: "West",
          product: "Services",
          source: "Databricks",
          scenario: "partial",
          limit: 10,
        },
      },
    ],
    lastQueryInterrupted: false,
  };
  state = saveItem(state, {
    id: "saved-query",
    title: "West sales",
    kind: "query",
    route: "/data-explorer?template=sales-by-region",
    context: { filters: state.ui.filters, query: state.ui.query },
  });
  const raw = JSON.stringify(state);
  const adapter = createPersistence(memoryStorage({ [STORAGE_KEY]: raw }));
  assert.deepEqual(adapter.read(), state);
  assert.equal(adapter.status().status, "persistent");
  assert.equal(adapter.status().recoveryRaw, null);
});

test("v1 missing optional UI receives defaults without rewriting its preserved saved work", () => {
  const legacy = { ...initialState(), schemaVersion: 1 };
  delete legacy.ui;
  const raw = JSON.stringify(legacy);
  const storage = memoryStorage({ [LEGACY_KEY]: raw });
  const adapter = createPersistence(storage);
  assert.deepEqual(adapter.read().ui, {});
  assert.equal(adapter.status().status, "persistent");
  assert.equal(storage.values.get(LEGACY_KEY), raw);
});

test("blocked reads and quota failures preserve usable session-only changes with visible status", () => {
  const blocked = createPersistence({
    getItem() {
      throw new Error("blocked");
    },
  });
  const state = blocked.read();
  assert.equal(blocked.status().status, "session");
  assert.equal(
    blocked.write({ ...state, favorites: ["finance-report"] }, 0).state
      .favorites[0],
    "finance-report",
  );
  const storage = memoryStorage();
  storage.setItem = () => {
    const error = new Error("full");
    error.name = "QuotaExceededError";
    throw error;
  };
  const full = createPersistence(storage);
  full.read();
  assert.equal(full.write(state, 0).status, "session");
  assert.match(full.status().message, /storage is full/);
});
test("two-tab edits detect a revision conflict before overwriting newer stored work", () => {
  const storage = memoryStorage();
  const a = createPersistence(storage),
    b = createPersistence(storage);
  const first = a.read(),
    second = b.read();
  assert.equal(
    a.write({ ...first, favorites: ["finance-report"] }, 0).status,
    "persistent",
  );
  const result = b.write({ ...second, favorites: ["sales-report"] }, 0);
  assert.equal(result.status, "conflict");
  assert.deepEqual(result.remote.favorites, ["finance-report"]);
  assert.equal(
    b.write({ ...second, favorites: ["sales-report"] }, 1, { overwrite: true })
      .state.revision,
    2,
  );
});
test("a reset in a second tab cannot silently be overwritten by the first tab", () => {
  const storage = memoryStorage();
  const adapter = createPersistence(storage);
  const saved = adapter.write(initialState(), 0).state;
  createPersistence(storage).reset();
  const result = adapter.write(
    { ...saved, favorites: ["finance-report"] },
    saved.revision,
  );
  assert.equal(result.status, "conflict");
  assert.deepEqual(result.remote.favorites, []);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});
test("telemetry is off by default and stopping does not affect other state operations", () => {
  const state = initialState();
  assert.equal(recordEvent(state, "report_open_requested"), state);
  const stopped = stopRecording(startRecording(state));
  assert.equal(recordEvent(stopped, "report_open_requested"), stopped);
  assert.deepEqual(toggleFavorite(stopped, "finance-report").favorites, [
    "finance-report",
  ]);
});
test("local recording reuses reference sanitization and drops raw strings, SQL, rows and URLs", () => {
  let state = startRecording(initialState(), "2026-10-04T12:00:00.000Z");
  state = recordEvent(
    state,
    "search_submitted",
    {
      resourceId: "https://private.example",
      searchId: "search-1",
      params: {
        category: "all",
        raw_search: "private phrase",
        sql: "SELECT private",
        rows: [1],
        url: "https://private.example",
      },
    },
    "2026-10-04T12:01:00.000Z",
  );
  assert.equal(state.telemetry.events.length, 1);
  assert.deepEqual(state.telemetry.events[0].parameters, { category: "all" });
  assert.equal(state.telemetry.events[0].resource_ref, "home");
  assert.ok(!JSON.stringify(state.telemetry.events).includes("private"));
  assert.equal(recordEvent(state, "unknown", {}), state);
});
test("deduplication and attribution preserve one event and configuration at interaction time", () => {
  let state = startRecording(initialState(), "2026-10-04T12:00:00.000Z");
  const before = effectiveExperience(state).experience_config_version;
  state = recordEvent(
    state,
    "report_open_requested",
    { eventId: "one", resourceId: "finance-report" },
    "2026-10-04T12:00:01.000Z",
  );
  state = recordEvent(
    state,
    "report_open_requested",
    { eventId: "one", resourceId: "finance-report" },
    "2026-10-04T12:00:01.000Z",
  );
  assert.equal(state.telemetry.events.length, 1);
  state = publishDraft(draftTitle(state), "finance");
  state = recordEvent(
    state,
    "report_open_requested",
    { eventId: "two", resourceId: "finance-report" },
    "2026-10-04T12:00:02.000Z",
  );
  assert.equal(state.telemetry.events[0].experience_config_version, before);
  assert.notEqual(state.telemetry.events[1].experience_config_version, before);
});
test("sample chart events retain actual outcomes without pretending to be vendor messages", () => {
  let state = startRecording(initialState(), "2026-10-04T12:00:00.000Z");
  state = recordEvent(
    state,
    "report_interaction",
    {
      source: "power-bi",
      resourceId: "finance-report",
      params: {
        interaction_kind: "filters_changed",
        raw_filter: "must not persist",
      },
    },
    "2026-10-04T12:00:01.000Z",
  );
  state = recordEvent(
    state,
    "report_rendered",
    {
      source: "looker",
      resourceId: "sales-report",
      params: { outcome: "partial", tile_count: 3, failed_tile_count: 1 },
    },
    "2026-10-04T12:00:02.000Z",
  );
  assert.equal(
    state.telemetry.events[0].parameters.interaction_kind,
    "filters_changed",
  );
  assert.equal(state.telemetry.events[0].outcome, "unknown");
  assert.equal(state.telemetry.events[1].outcome, "partial");
  assert.ok(
    !JSON.stringify(state.telemetry.events).includes("must not persist"),
  );
});
test("local funnels split reused sessions after an inactivity gap", () => {
  let state = startRecording(initialState(), "2026-10-04T12:00:00.000Z");
  state = recordEvent(
    state,
    "report_open_requested",
    {},
    "2026-10-04T12:00:00.000Z",
  );
  state = recordEvent(
    state,
    "query_submitted",
    { queryId: "query-1" },
    "2026-10-04T13:00:00.000Z",
  );
  const result = analytics(state.telemetry.events, {
    local: true,
    start: "2026-10-04T00:00:00.000Z",
    end: "2026-10-05T00:00:00.000Z",
  });
  assert.equal(result.paths.length, 2);
  assert.equal(
    funnel(result.paths, ["report_open_requested", "query_submitted"])[1].count,
    0,
  );
});
test("seed filters, incomplete observations and local recording remain distinct", () => {
  const sample = analytics(SAMPLE_EVENTS);
  assert.equal(sample.status, "observed");
  assert.equal(sample.metrics.query_outcomes.denominator, 6);
  assert.equal(sample.metrics.query_outcomes.completed, 4);
  assert.equal(sample.metrics.query_outcomes.results_viewed, 2);
  assert.equal(sample.metrics.query_outcomes.missing_terminal, 2);
  const version = analytics(SAMPLE_EVENTS, { version: "sample-v1" });
  assert.equal(version.metrics.query_outcomes.denominator, 3);
  const absent = analytics(SAMPLE_EVENTS, { source: "databricks" });
  assert.equal(absent.status, "suppressed");
  assert.equal(absent.metrics, null);
  assert.equal(analytics(SAMPLE_EVENTS, { local: true }).events.length, 0);
  assert.equal(
    deleteRecording(startRecording(initialState())).telemetry.events.length,
    0,
  );
});
test("ordered funnel calculates paths rather than independent event counts", () => {
  const paths = [
    [{ event_name: "report" }, { event_name: "query" }, { event_name: "view" }],
    [{ event_name: "query" }, { event_name: "report" }],
    [{ event_name: "report" }],
  ];
  assert.deepEqual(
    funnel(paths, ["report", "query", "view"]).map((item) => item.count),
    [3, 1, 1],
  );
});
test("bounded local retention records lost coverage and resets it only for a new or deleted recording", () => {
  let state = startRecording(initialState(), "2026-10-04T12:00:00.000Z");
  state = recordEvent(
    state,
    "report_open_requested",
    { eventId: "seed" },
    "2026-10-04T12:00:01.000Z",
  );
  state.telemetry.events = Array.from({ length: 1000 }, (_, index) => ({
    ...state.telemetry.events[0],
    event_id: `event-${index}`,
  }));
  state = recordEvent(
    state,
    "report_open_requested",
    { eventId: "next" },
    "2026-10-04T12:00:02.000Z",
  );
  assert.equal(state.telemetry.events.length, 1000);
  assert.equal(state.telemetry.events[0].event_id, "event-1");
  assert.equal(state.telemetry.droppedEvents, 1);
  assert.equal(stopRecording(state).telemetry.droppedEvents, 1);
  assert.equal(migrateState(state).telemetry.droppedEvents, 1);
  assert.equal(startRecording(state).telemetry.droppedEvents, 0);
  assert.equal(deleteRecording(state).telemetry.droppedEvents, 0);
});
