/** Entirely synthetic activity, identities, times, resources, and SDK messages. */
import { createTelemetryCollector, computeJourneyMetrics } from './journey-telemetry.mjs';

export const JOURNEY_WINDOW = { start: '2026-10-03T12:00:00Z', end: '2026-10-03T13:00:00Z' };
export const JOURNEY_SCOPE = { tenant_id: 'synthetic-tenant', workspace_id: 'synthetic-finance' };

export function syntheticTelemetryContext(overrides = {}) {
  return { synthetic_trust: true, telemetry_enabled: true, ...JOURNEY_SCOPE,
    subject_id: 'subject-1', session_id: 'session-1', journey_id: 'journey-1',
    view_instance_id: 'view-1', resource_ref: 'resource-1', experience_config_version: 'experience-v1',
    source_system: 'enterprise-iq', action_origin: 'user', purpose: 'employee', ...overrides };
}

export function runJourneyReference({ experienceConfigVersion = 'experience-v1', minimumSubjects = 3 } = {}) {
  const collector = createTelemetryCollector({ now: () => '2026-10-03T13:00:00.000Z' });
  const sender = {};
  const binding = { origin: 'https://synthetic-bi.example', sender, source_system: 'power-bi' };
  const time = second => new Date(Date.parse(JOURNEY_WINDOW.start) + second * 1_000).toISOString();
  let sequence = 0;
  const emit = (context, second, event_name, params = {}, channel = 'host') => collector[channel]({
    schema_version: 1, event_id: `event-${++sequence}`, occurred_at: time(second), event_name, params,
  }, context);
  const embed = (context, second, data, sourceBinding = binding) => {
    const delivery = { event_id: `event-${++sequence}`, occurred_at: time(second) };
    const message = { origin: sourceBinding.origin, source: sender, data };
    return { result: collector.embed(message, sourceBinding, context, delivery), message, delivery };
  };
  for (let actor = 1; actor <= 3; actor += 1) {
    const start = (actor - 1) * 100;
    const context = syntheticTelemetryContext({ subject_id: `subject-${actor}`, session_id: `session-${actor}`,
      journey_id: `journey-${actor}`, view_instance_id: `view-${actor}`, resource_ref: `resource-${actor}`,
      search_id: `search-${actor}`, query_id: `query-${actor}`, question_id: `question-${actor}`,
      experience_config_version: experienceConfigVersion });
    emit(context, start, 'workspace_viewed', { module: 'home' });
    emit(context, start + 1, 'experience_variant_exposed');
    emit(context, start + 2, 'search_submitted', { category: 'reports', raw_search: 'SYNTHETIC-PRIVATE-TEXT' });
    emit(context, start + 3, 'search_results_shown', { visible_count: actor === 2 ? 0 : 2, coverage_complete: actor !== 3 });
    emit(context, start + 4, 'documentation_opened');
    emit(context, start + 5, 'report_open_requested');
    if (actor !== 3) {
      const bi = { ...context, source_system: 'power-bi' };
      // Reversed arrival proves event-time reconstruction; rerenders remain distinct.
      const rendered = embed(bi, start + 8, { type: 'rendered', title: 'SYNTHETIC-SENSITIVE-TITLE' });
      embed(bi, start + 6, { type: 'loaded' });
      collector.embed(rendered.message, binding, bi, rendered.delivery);
      embed(bi, start + 10, { type: 'rendered' });
      embed({ ...bi, action_origin: 'background' }, start + 11, { type: 'pageChanged', newPage: { displayName: 'DO-NOT-COLLECT' } });
    } else {
      const looker = { ...context, source_system: 'looker' };
      const lookerBinding = { ...binding, source_system: 'looker' };
      embed(looker, start + 6, { type: 'dashboard:run:start' }, lookerBinding);
      embed(looker, start + 8, { type: 'dashboard:run:complete', status: 'error', dashboard: {
        tileStatuses: [{ status: 'complete' }, { status: 'error', errors: [{ sql: 'SYNTHETIC-DO-NOT-COLLECT' }] }],
      } }, lookerBinding);
    }
    emit(context, start + 12, 'query_submitted');
    if (actor !== 3) emit({ ...context, source_system: 'snowflake', action_origin: 'background' }, start + 14,
      'query_completed', { outcome: 'success', row_count: actor === 1 ? 4 : 0, truncated: false }, 'server');
    if (actor === 1) emit(context, start + 15, 'query_results_viewed', { page_index: 0 });
    emit(context, start + 16, 'iq_question_submitted');
    emit(context, start + 17, 'iq_answer_presented', { outcome: 'unknown' });
    if (actor !== 2) emit(context, start + 18, 'iq_source_opened', { resource_type: 'documentation' });
    if (actor === 1) emit(context, start + 19, 'resource_saved', { resource_type: 'investigation' });
    if (actor === 3) emit(context, start + 19, 'native_source_opened', { reason: 'unsupported' });
  }
  const events = collector.events(JOURNEY_SCOPE);
  return { synthetic: true, fixture: 'Three fictional subjects; no live SDK or employee observation.', events,
    metrics: computeJourneyMetrics(events, { ...JOURNEY_SCOPE, ...JOURNEY_WINDOW, minimumSubjects }), collection: collector.stats() };
}
