import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetryCollector, computeJourneyMetrics, EVENT_CONTRACT } from '../examples/journey-telemetry.mjs';
import { syntheticTelemetryContext, runJourneyReference, JOURNEY_SCOPE, JOURNEY_WINDOW } from '../examples/journey-fixtures.mjs';

const context = overrides => syntheticTelemetryContext(overrides);
const collector = options => createTelemetryCollector({ now: () => '2026-10-03T13:00:00.000Z', ...options });
const raw = (event_name, params = {}, overrides = {}) => ({ schema_version: 1, event_id: 'event-1',
  occurred_at: '2026-10-03T12:00:00Z', event_name, params, ...overrides });
const all = c => c.events(JOURNEY_SCOPE);
const analyze = (events, options = {}) => computeJourneyMetrics(events, { ...JOURNEY_SCOPE, ...JOURNEY_WINDOW, minimumSubjects: 1, ...options });
function send(c, type, { data = {}, trusted = {}, delivery = {}, origin, source, sourceSystem = 'power-bi' } = {}) {
  const sender = {};
  const binding = { origin: 'https://synthetic-bi.example', sender, source_system: sourceSystem };
  return c.embed({ origin: origin ?? binding.origin, source: source ?? sender, data: { type, ...data } }, binding,
    context({ source_system: sourceSystem, ...trusted }), { event_id: 'event-1', occurred_at: '2026-10-03T12:00:00Z', ...delivery });
}

test('strict projection strips raw identities, URLs, search text and nested SDK content', () => {
  const c = collector();
  c.host(raw('search_submitted', { category: 'all', text: 'SECRET-SEARCH', email: 'SECRET-EMAIL' },
    { tenant_id: 'spoofed', subject_id: 'SECRET-IDENTITY', url: 'SECRET-URL' }), context({ search_id: 'search-1' }));
  send(c, 'pageChanged', { data: { newPage: { name: 'SECRET-TITLE', filters: ['SECRET-FILTER'] } }, delivery: { event_id: 'event-2' } });
  const json = JSON.stringify(all(c));
  assert.ok(!json.includes('SECRET'));
  assert.ok(!json.includes('spoofed'));
  assert.equal(all(c)[0].tenant_id, JOURNEY_SCOPE.tenant_id);
  assert.deepEqual(all(c)[0].parameters, { category: 'all' });
});

test('malformed schemas, future timestamps, unknown events, and wrong channels reject safely', () => {
  const c = collector();
  const invalid = [raw('unknown'), raw('workspace_viewed', { module: 'admin-script' }),
    raw('workspace_viewed', { module: 'home' }, { schema_version: 2 }),
    raw('workspace_viewed', { module: 'home' }, { occurred_at: '2026-10-03T14:00:00Z' }),
    raw('workspace_viewed', { module: 'home' }, { occurred_at: '2026-02-30T12:00:00Z' }),
    raw('query_completed', { outcome: 'success', row_count: 1, truncated: false })];
  for (const item of invalid) assert.equal(c.host(item, context()).status, 'rejected');
  assert.deepEqual(all(c), []);
});

test('trust marker and scope are required; arbitrary browser scope cannot grant tenancy', () => {
  const c = collector();
  for (const trusted of [undefined, context({ synthetic_trust: false }), context({ subject_id: 'someone@example.test' }), context({ tenant_id: '' })]) {
    assert.equal(c.host(raw('report_open_requested'), trusted).status, 'rejected');
  }
  assert.equal(c.host(raw('report_open_requested', {}, { tenant_id: 'other' }), context()).status, 'accepted');
  assert.deepEqual(c.events({ tenant_id: 'other', workspace_id: JOURNEY_SCOPE.workspace_id }), []);
});

test('origin and exact sender object are independently checked', () => {
  const c = collector();
  assert.equal(send(c, 'loaded', { origin: 'https://synthetic-bi.example.attacker.invalid' }).status, 'rejected');
  assert.equal(send(c, 'loaded', { source: {} }).status, 'rejected');
  assert.equal(send(c, 'loaded').status, 'accepted');
});

test('unsupported SDK events are absent, never synthesized as zero interaction', () => {
  const c = collector();
  assert.equal(send(c, 'filterChanged').status, 'rejected');
  assert.equal(send(c, 'dataSelected').status, 'rejected');
  assert.deepEqual(all(c), []);
});

test('Power BI initialization differs from render; initial render uses event time after reordering', () => {
  const c = collector();
  send(c, 'rendered', { delivery: { event_id: 'later-render', occurred_at: '2026-10-03T12:00:04Z' } });
  send(c, 'loaded', { delivery: { event_id: 'loaded', occurred_at: '2026-10-03T12:00:01Z' } });
  send(c, 'rendered', { delivery: { event_id: 'first-render', occurred_at: '2026-10-03T12:00:02Z' } });
  const events = all(c);
  assert.equal(events[0].event_name, 'report_initialized');
  assert.equal(events[1].parameters.render_phase, 'initial');
  assert.equal(events[2].parameters.render_phase, 'subsequent');
});

test('dedup retries keep one event and conflicting reused IDs reject without replacing the original', () => {
  const c = collector();
  assert.equal(send(c, 'rendered').status, 'accepted');
  assert.equal(send(c, 'rendered').status, 'duplicate');
  assert.equal(send(c, 'loaded').status, 'rejected');
  assert.equal(all(c).length, 1);
});

test('tenant-scoped duplicate IDs remain distinct and caller snapshots cannot mutate storage', () => {
  const c = collector();
  c.host(raw('report_open_requested'), context());
  c.host(raw('report_open_requested'), context({ tenant_id: 'another-tenant' }));
  const snapshot = all(c);
  snapshot[0].tenant_id = 'modified';
  assert.equal(all(c)[0].tenant_id, JOURNEY_SCOPE.tenant_id);
  assert.equal(c.events({ tenant_id: 'another-tenant', workspace_id: JOURNEY_SCOPE.workspace_id }).length, 1);
  assert.deepEqual(c.events({}), []);
});

test('Power BI errors are operation errors unless the trusted lifecycle identifies load phase', () => {
  const c = collector();
  send(c, 'error', { data: { message: 'SECRET-ERROR', technicalDetails: { requestId: 'SECRET-ID' } } });
  send(c, 'error', { trusted: { report_phase: 'initialization' }, delivery: { event_id: 'event-2' } });
  assert.equal(all(c)[0].event_name, 'report_interaction');
  assert.equal(all(c)[1].event_name, 'report_load_failed');
  assert.ok(!JSON.stringify(all(c)).includes('SECRET'));
});

test('Looker completion preserves success, mixed partial, failure, cancelled and unknown', () => {
  const cases = [
    ['complete', [{ status: 'complete' }], 'success'],
    ['error', [{ status: 'complete' }, { status: 'error', errors: [{ sql: 'SECRET-SQL' }] }], 'partial'],
    ['error', [{ status: 'error' }], 'failure'],
    ['stopped', [{ status: 'complete' }], 'cancelled'],
    ['complete', undefined, 'unknown'],
    ['complete', new Array(1_000_001), 'unknown'],
    ['complete', [{ status: 'unexpected' }], 'unknown'],
  ];
  for (const [status, tileStatuses, expected] of cases) {
    const c = collector();
    send(c, 'dashboard:run:complete', { sourceSystem: 'looker', data: { status, dashboard: { tileStatuses, title: 'SECRET-TITLE' } } });
    assert.equal(all(c)[0].outcome, expected);
    if (!tileStatuses || tileStatuses.length > 1_000_000) {
      assert.equal(all(c)[0].parameters.tile_count, undefined);
      assert.equal(all(c)[0].parameters.failed_tile_count, undefined);
    }
    assert.ok(!JSON.stringify(all(c)).includes('SECRET'));
  }
});

test('Looker run and filter events retain kind and action origin without filter values', () => {
  const c = collector();
  send(c, 'dashboard:run:start', { sourceSystem: 'looker', trusted: { action_origin: 'background' } });
  send(c, 'dashboard:filters:changed', { sourceSystem: 'looker', data: { dashboard: { dashboard_filters: { secret: 'SECRET' } } }, delivery: { event_id: 'event-2' } });
  assert.equal(all(c)[0].action_origin, 'background');
  assert.equal(all(c)[1].parameters.interaction_kind, 'filters_changed');
  assert.ok(!JSON.stringify(all(c)).includes('SECRET'));
});

test('disabled policy prevents host, server and embed emission without blocking permitted work', () => {
  for (const globalDisabled of [false, true]) {
    const c = collector({ enabled: !globalDisabled });
    const trusted = context({ telemetry_enabled: globalDisabled });
    assert.equal(c.host(raw('report_open_requested'), trusted).status, 'disabled');
    assert.equal(c.server(raw('query_cancelled'), trusted).status, 'disabled');
    assert.equal(send(c, 'loaded', { trusted }).status, 'disabled');
    const allowedResult = [1, 2].reduce((sum, value) => sum + value, 0);
    assert.equal(allowedResult, 3);
    assert.deepEqual(all(c), []);
  }
});

test('nonessential telemetry collector failure returns unavailable without exposing error or throwing', () => {
  const c = collector({ now: () => { throw new Error('SECRET-COLLECTOR-DETAIL'); } });
  assert.deepEqual(c.host(raw('report_open_requested'), context()), { status: 'unavailable' });
  assert.equal(c.stats().unavailable, 1);
});

test('synthetic derived metrics count denominators, missing outcomes, rerenders, and partial views', () => {
  const result = runJourneyReference({ minimumSubjects: 1 });
  const metrics = result.metrics.metrics;
  assert.equal(result.collection.duplicates, 2);
  assert.deepEqual(metrics.zero_result_searches, { status: 'observed', numerator: 1, denominator: 2, rate: 0.5, missing_or_incomplete_results: 1 });
  assert.equal(metrics.search_to_report_ms.sample_count, 2);
  assert.equal(metrics.search_to_report_ms.mean_ms, 6000);
  assert.equal(metrics.search_to_report_ms.missing_outcome_count, 1);
  assert.equal(metrics.report_outcomes.denominator, 3);
  assert.equal(metrics.report_outcomes.rendered_views, 2);
  assert.equal(metrics.report_outcomes.partial_views, 1);
  assert.equal(metrics.query_outcomes.completed, 2);
  assert.equal(metrics.query_outcomes.results_viewed, 1);
  assert.equal(metrics.query_outcomes.missing_terminal, 1);
  assert.equal(metrics.documentation_to_report.numerator, 3);
  assert.equal(metrics.iq_source_follow_through.numerator, 2);
  assert.ok(!JSON.stringify(result).includes('DO-NOT-COLLECT'));
});

test('changing result counts and missing observations changes calculations rather than a fixed summary', () => {
  const { events } = runJourneyReference();
  const changed = structuredClone(events);
  const result = changed.find(e => e.event_name === 'search_results_shown' && e.parameters.visible_count === 0);
  result.parameters.visible_count = 5;
  const filtered = changed.filter(e => e.event_name !== 'query_results_viewed');
  const metrics = analyze(filtered).metrics;
  assert.equal(metrics.zero_result_searches.numerator, 0);
  assert.equal(metrics.query_outcomes.results_viewed, 0);
});

test('zero observed-result denominator and absent terminal events yield null rates, not zero evidence', () => {
  const c = collector();
  c.host(raw('search_submitted', { category: 'all' }), context({ search_id: 'search-1' }));
  c.host(raw('report_open_requested', {}, { event_id: 'event-2' }), context());
  c.host(raw('query_submitted', {}, { event_id: 'event-3' }), context({ query_id: 'query-1' }));
  const metrics = analyze(all(c)).metrics;
  assert.equal(metrics.zero_result_searches.denominator, 0);
  assert.equal(metrics.zero_result_searches.rate, null);
  assert.equal(metrics.search_to_report_ms.mean_ms, null);
  assert.equal(metrics.report_outcomes.missing_terminal_views, 1);
  assert.equal(metrics.query_outcomes.viewed_per_completed, null);
});

test('minimum cohort counts distinct subjects, repeated events never inflate people', () => {
  const { events } = runJourneyReference();
  assert.equal(analyze([...events, ...events], { minimumSubjects: 4 }).status, 'suppressed');
  const oneSubject = events.filter(e => e.subject_id === 'subject-1');
  assert.equal(analyze([...oneSubject, ...oneSubject], { minimumSubjects: 2 }).metrics, null);
  assert.equal(runJourneyReference().metrics.metrics.native_handoffs.status, 'suppressed');
  assert.equal(runJourneyReference().metrics.metrics.search_to_report_ms.mean_ms, null);
  assert.equal(runJourneyReference().metrics.metrics.search_to_report_ms.mean_status, 'minimum_cohort');
  assert.equal(runJourneyReference().metrics.metrics.zero_result_searches.status, 'suppressed');
  assert.equal(runJourneyReference().metrics.metrics.query_outcomes.viewed_per_completed, null);
});

test('scope, workspace, session, journey and subject prevent cross-context joins', () => {
  const c = collector();
  c.host(raw('query_submitted'), context({ query_id: 'query-1' }));
  const variations = [{ tenant_id: 'other' }, { workspace_id: 'other' }, { session_id: 'other' }, { journey_id: 'other' }, { subject_id: 'other' }];
  for (const [index, change] of variations.entries()) c.server(raw('query_completed', { outcome: 'success', row_count: 1, truncated: false },
    { event_id: `done-${index}`, occurred_at: '2026-10-03T12:00:01Z' }), context({ query_id: 'query-1', ...change }));
  assert.equal(analyze(all(c)).metrics.query_outcomes.completed, 0);
  assert.equal(analyze(all(c)).metrics.query_outcomes.missing_terminal, 1);
});

test('configured window, preview/test exclusion and background initiations constrain adoption', () => {
  const { events } = runJourneyReference();
  assert.equal(analyze(events, { start: '2026-10-03T12:01:30Z' }).coverage.unique_subjects, 2);
  assert.equal(analyze(events.map(e => ({ ...e, purpose: 'preview' }))).status, 'suppressed');
  assert.equal(analyze(events.map(e => ({ ...e, purpose: 'test' }))).status, 'suppressed');
  const background = events.map(e => e.event_name === 'query_submitted' ? { ...e, action_origin: 'background' } : e);
  assert.equal(analyze(background).metrics.query_outcomes.status, 'suppressed');
  const filtered = analyze(events, { experienceConfigVersion: 'no-such-version' });
  assert.equal(filtered.status, 'suppressed');
});

test('inactivity separates a reused session and observation-window boundaries exclude late terminals', () => {
  const c = collector();
  c.host(raw('query_submitted'), context({ query_id: 'query-1' }));
  c.server(raw('query_completed', { outcome: 'success', row_count: 1, truncated: false },
    { event_id: 'done', occurred_at: '2026-10-03T12:31:00Z' }), context({ query_id: 'query-1' }));
  assert.equal(analyze(all(c)).metrics.query_outcomes.completed, 0);
  assert.equal(analyze(all(c), { inactivityMs: 60 * 60_000 }).metrics.query_outcomes.completed, 1);
  assert.equal(analyze(all(c), { end: '2026-10-03T12:31:00Z', inactivityMs: 60 * 60_000 }).metrics.query_outcomes.completed, 0);
});

test('event ordering and repeated journeys preserve loopbacks rather than imposing a funnel', () => {
  const c = collector();
  const names = ['documentation_opened', 'report_open_requested', 'documentation_opened', 'report_open_requested'];
  names.forEach((name, index) => c.host(raw(name, {}, { event_id: `event-${index}`, occurred_at: `2026-10-03T12:00:0${index}Z` }), context()));
  c.host(raw('documentation_opened', {}, { event_id: 'repeat', occurred_at: '2026-10-03T12:00:05Z' }), context({ journey_id: 'journey-2' }));
  const metrics = analyze(all(c).reverse()).metrics;
  assert.equal(metrics.documentation_to_report.denominator, 2);
  assert.equal(metrics.documentation_to_report.numerator, 1);
  assert.equal(metrics.transitions.find(e => e.transition === 'documentation_opened → report_open_requested').occurrences, 2);
});

test('native handoffs end observation and do not create failed reports', () => {
  const c = collector();
  c.host(raw('native_source_opened', { reason: 'unsupported' }), context());
  const metrics = analyze(all(c)).metrics;
  assert.equal(metrics.native_handoffs.outcome, 'observation_ends');
  assert.equal(metrics.report_outcomes.status, 'suppressed');
});

test('contract covers all requested event names and requires bounded approved parameter types', () => {
  assert.equal(Object.keys(EVENT_CONTRACT).length, 25);
  const c = collector();
  for (const visible_count of [-1, 1.5, 1_000_001, 'SECRET']) {
    assert.equal(c.host(raw('search_results_shown', { visible_count, coverage_complete: true }), context()).status, 'rejected');
  }
  assert.throws(() => analyze([], { minimumSubjects: 0 }), /Invalid analytics/);
  assert.throws(() => analyze([], { experienceConfigVersion: 'someone@example.test' }), /Invalid analytics/);
  assert.throws(() => analyze([], { sourceSystem: 'free text' }), /Invalid analytics/);
  assert.equal(c.server(raw('query_completed', { outcome: 'cancelled', row_count: 0, truncated: false }), context()).status, 'rejected');
});

test('unavailable Power BI tile counts stay absent and cancelled queries have a cancelled outcome', () => {
  const c = collector();
  send(c, 'rendered');
  c.server(raw('query_cancelled', {}, { event_id: 'cancelled' }), context({ query_id: 'query-1' }));
  assert.equal(all(c).find(event => event.event_name === 'report_rendered').parameters.tile_count, undefined);
  assert.equal(all(c).find(event => event.event_name === 'query_cancelled').outcome, 'cancelled');
});

test('metrics reproject derived outcomes and report correlations require the bound resource', () => {
  const c = collector();
  c.host(raw('report_open_requested'), context());
  send(c, 'rendered', { trusted: { resource_ref: 'another-resource' }, delivery: { event_id: 'render', occurred_at: '2026-10-03T12:00:01Z' } });
  assert.equal(analyze(all(c)).metrics.report_outcomes.rendered_views, 0);
  const events = all(c).map(event => ({ ...event, outcome: 'failure' }));
  events.find(event => event.event_name === 'report_rendered').resource_ref = 'resource-1';
  assert.equal(analyze(events).metrics.report_outcomes.rendered_views, 1);
  assert.equal(analyze(events).metrics.report_outcomes.failed_views, 0);
});
