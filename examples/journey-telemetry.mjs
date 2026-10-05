/** Local synthetic telemetry only: no network, identity provider, or ingestion service. */
const enumOf = (...values) => value => values.includes(value);
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
const boolean = value => typeof value === 'boolean';
const optional = validate => Object.assign(validate.bind(null), { optional: true });
const outcome = enumOf('success', 'partial', 'failure', 'cancelled', 'unknown');
const sourceSystemName = enumOf('enterprise-iq', 'power-bi', 'looker', 'snowflake', 'databricks', 'confluence', 'sharepoint');
const moduleName = enumOf('home', 'reports', 'data-explorer', 'knowledge', 'ask-iq', 'my-workspace');
const definition = (channel, fields = {}) => ({ channel, fields });

// Values are types or closed vocabularies; no free-text parameter is accepted.
export const EVENT_CONTRACT = Object.freeze({
  workspace_viewed: definition('host', { module: moduleName }),
  search_submitted: definition('host', { category: enumOf('reports', 'data', 'knowledge', 'all') }),
  search_results_shown: definition('host', { visible_count: count, coverage_complete: boolean }),
  search_result_opened: definition('host', { resource_type: enumOf('report', 'query', 'documentation') }),
  report_open_requested: definition('host'),
  report_initialized: definition('embed'),
  report_rendered: definition('embed', { outcome, tile_count: optional(count), failed_tile_count: optional(count) }),
  report_page_changed: definition('embed'),
  report_interaction: definition('embed', { interaction_kind: enumOf('run_started', 'filters_changed', 'operation_error') }),
  report_load_failed: definition('embed', { stage: enumOf('initialization', 'render') }),
  documentation_opened: definition('host'),
  definition_opened: definition('host'),
  resource_saved: definition('host', { resource_type: enumOf('report', 'query', 'investigation') }),
  native_source_opened: definition('host', { reason: enumOf('unsupported', 'user_choice', 'session_expired') }),
  query_submitted: definition('host'),
  query_completed: definition('server', { outcome: enumOf('success', 'partial'), row_count: count, truncated: boolean }),
  query_failed: definition('server', { reason: enumOf('denied', 'timeout', 'source_failure', 'unknown') }),
  query_cancelled: definition('server'),
  query_results_viewed: definition('host', { page_index: count }),
  iq_question_submitted: definition('host'),
  iq_answer_presented: definition('host', { outcome }),
  iq_source_opened: definition('host', { resource_type: enumOf('report', 'query', 'documentation') }),
  iq_feedback_submitted: definition('host', { rating: enumOf('helpful', 'unhelpful', 'task_success') }),
  experience_configuration_published: definition('server'),
  experience_variant_exposed: definition('host'),
});

const token = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z');
const scopeFields = ['tenant_id', 'workspace_id', 'subject_id', 'session_id', 'journey_id',
  'view_instance_id', 'resource_ref', 'experience_config_version'];
const optionalCorrelations = ['search_id', 'query_id', 'question_id'];
const key = (event, fields) => JSON.stringify(fields.map(field => event[field] ?? null));
const journeyFields = ['tenant_id', 'workspace_id', 'subject_id', 'session_id', 'journey_id'];
const compare = (a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || a.event_id.localeCompare(b.event_id);

function trustedScope(context) {
  return context?.synthetic_trust === true && scopeFields.every(field => token(context[field]))
    && optionalCorrelations.every(field => context[field] === undefined || token(context[field]))
    && sourceSystemName(context.source_system)
    && enumOf('user', 'background', 'unknown')(context.action_origin)
    && enumOf('employee', 'preview', 'test')(context.purpose);
}

function project(raw, context, channel, receivedAt) {
  if (!trustedScope(context) || !raw || !Object.hasOwn(EVENT_CONTRACT, raw.event_name)) return null;
  const spec = EVENT_CONTRACT[raw.event_name];
  if (spec.channel !== channel || raw.schema_version !== 1 || !token(raw.event_id)
    || !timestamp(raw.occurred_at) || !timestamp(receivedAt)) return null;
  // Future timestamps are invalid; delayed and reordered delivery is accepted.
  if (Date.parse(raw.occurred_at) > Date.parse(receivedAt)) return null;
  const params = {};
  for (const [field, validate] of Object.entries(spec.fields)) {
    const value = raw.params?.[field];
    if (value === undefined && validate.optional) continue;
    if (value === undefined || !validate(value)) return null;
    params[field] = value;
  }
  const event = { event_id: raw.event_id, event_name: raw.event_name, schema_version: 1,
    occurred_at: raw.occurred_at, received_at: receivedAt };
  for (const field of scopeFields) event[field] = context[field];
  for (const field of optionalCorrelations) if (context[field] !== undefined) event[field] = context[field];
  for (const field of ['source_system', 'action_origin', 'purpose']) event[field] = context[field];
  event.outcome = params.outcome ?? (enumOf('report_load_failed', 'query_failed')(raw.event_name)
    || params.interaction_kind === 'operation_error' ? 'failure' : raw.event_name === 'query_cancelled' ? 'cancelled' : 'unknown');
  if (raw.duration_ms !== undefined) {
    if (!Number.isSafeInteger(raw.duration_ms) || raw.duration_ms < 0 || raw.duration_ms > 86_400_000) return null;
    event.duration_ms = raw.duration_ms;
  }
  event.parameters = params;
  return event;
}

function lookerCompletion(payload) {
  const tiles = payload.dashboard?.tileStatuses;
  const observedTiles = Array.isArray(tiles) && tiles.length <= 1_000_000;
  const statuses = observedTiles ? tiles.map(tile => tile?.status) : [];
  const good = statuses.filter(status => status === 'complete').length;
  const bad = statuses.filter(status => status === 'error').length;
  let result = 'unknown';
  if (payload.status === 'stopped') result = 'cancelled';
  else if (good && bad) result = 'partial';
  else if (bad && bad === statuses.length) result = 'failure';
  else if (payload.status === 'complete' && good && good === statuses.length) result = 'success';
  else if (payload.status === 'error') result = 'failure';
  return { outcome: result, ...(observedTiles ? { tile_count: statuses.length, failed_tile_count: bad } : {}) };
}

export function createTelemetryCollector({ enabled = true, now = () => new Date().toISOString() } = {}) {
  const stored = new Map();
  const stats = { accepted: 0, duplicates: 0, rejected: 0, disabled: 0, unavailable: 0 };
  const reject = () => { stats.rejected += 1; return { status: 'rejected' }; };
  const disabled = context => {
    if (!enabled || context?.telemetry_enabled === false) { stats.disabled += 1; return true; }
    return false;
  };
  function emit(raw, context, channel) {
    if (disabled(context)) return { status: 'disabled' };
    let event;
    try { event = project(raw, context, channel, now()); }
    catch { stats.unavailable += 1; return { status: 'unavailable' }; }
    if (!event) return reject();
    const id = key(event, ['tenant_id', 'event_id']);
    if (stored.has(id)) {
      const previous = stored.get(id);
      const withoutReceipt = value => { const { received_at, ...rest } = value; return JSON.stringify(rest); };
      if (withoutReceipt(previous) !== withoutReceipt(event)) return reject();
      stats.duplicates += 1;
      return { status: 'duplicate' };
    }
    stored.set(id, event);
    stats.accepted += 1;
    return { status: 'accepted' };
  }
  return {
    host: (raw, context) => emit(raw, context, 'host'),
    server: (raw, context) => emit(raw, context, 'server'),
    // Original sample-chart instrumentation only; this is NOT a vendor SDK adapter.
    sampleEmbed: (raw, context) => emit(raw, context, 'embed'),
    embed(message, binding, context, delivery) {
      if (disabled(context)) return { status: 'disabled' };
      // Simulated browser MessageEvent: exact origin AND Window identity, never a payload claim.
      if (!binding?.sender || !message || message.origin !== binding.origin || message.source !== binding.sender
        || !/^https:\/\/[^/?#]+$/.test(binding.origin ?? '') || binding.source_system !== context?.source_system) return reject();
      const payload = message.data;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return reject();
      let name;
      let params = {};
      if (binding.source_system === 'power-bi') {
        if (payload.type === 'loaded') name = 'report_initialized';
        if (payload.type === 'rendered') {
          name = 'report_rendered'; params = { outcome: 'success' };
        }
        if (payload.type === 'pageChanged') name = 'report_page_changed';
        if (payload.type === 'error') {
          if (enumOf('initialization', 'render')(context.report_phase)) {
            name = 'report_load_failed'; params = { stage: context.report_phase };
          } else {
            name = 'report_interaction'; params = { interaction_kind: 'operation_error' };
          }
        }
      } else if (binding.source_system === 'looker') {
        if (payload.type === 'dashboard:run:start') {
          name = 'report_interaction'; params = { interaction_kind: 'run_started' };
        }
        if (payload.type === 'dashboard:run:complete') { name = 'report_rendered'; params = lookerCompletion(payload); }
        if (payload.type === 'dashboard:filters:changed') {
          name = 'report_interaction'; params = { interaction_kind: 'filters_changed' };
        }
      }
      if (!name) return reject();
      return emit({ event_id: delivery?.event_id, occurred_at: delivery?.occurred_at,
        schema_version: 1, event_name: name, params }, context, 'embed');
    },
    events(scope) {
      if (!token(scope?.tenant_id) || !token(scope?.workspace_id)) return [];
      const result = [...stored.values()].filter(event => event.tenant_id === scope.tenant_id
        && event.workspace_id === scope.workspace_id).sort(compare);
      const seen = new Set();
      return result.map(event => {
        const copy = structuredClone(event);
        if (event.event_name === 'report_rendered') {
          const view = key(event, [...journeyFields, 'experience_config_version', 'resource_ref', 'view_instance_id']);
          copy.parameters.render_phase = seen.has(view) ? 'subsequent' : 'initial';
          seen.add(view);
        }
        return copy;
      });
    },
    stats: () => ({ ...stats }),
  };
}

/** Accept only projected collector events; this validates again before analysis. */
function canonicalEvent(event) {
  if (!event || !Object.hasOwn(EVENT_CONTRACT, event.event_name)) return null;
  return project({ ...event, params: event.parameters }, { ...event, synthetic_trust: true },
    EVENT_CONTRACT[event.event_name].channel, event.received_at);
}

export function computeJourneyMetrics(input, options) {
  const { tenant_id, workspace_id, start, end, minimumSubjects = 3, inactivityMs = 30 * 60_000,
    experienceConfigVersion, sourceSystem } = options ?? {};
  if (!token(tenant_id) || !token(workspace_id) || !timestamp(start) || !timestamp(end)
    || Date.parse(start) >= Date.parse(end) || !Number.isInteger(minimumSubjects) || minimumSubjects < 1
    || !Number.isSafeInteger(inactivityMs) || inactivityMs < 1
    || (experienceConfigVersion !== undefined && !token(experienceConfigVersion))
    || (sourceSystem !== undefined && !sourceSystemName(sourceSystem))) throw new Error('Invalid analytics scope or window');
  const inScope = input.map(canonicalEvent).filter(event => event && event.tenant_id === tenant_id
    && event.workspace_id === workspace_id && event.purpose === 'employee'
    && Date.parse(event.occurred_at) >= Date.parse(start) && Date.parse(event.occurred_at) < Date.parse(end)
    && (!experienceConfigVersion || event.experience_config_version === experienceConfigVersion)
    && (!sourceSystem || event.source_system === sourceSystem));
  const unique = new Map();
  for (const event of inScope.sort(compare)) if (!unique.has(event.event_id)) unique.set(event.event_id, event);
  const events = [...unique.values()];
  // A reused session ID cannot join events across a 30-minute inactivity gap.
  const segments = new Map();
  const last = new Map();
  for (const event of events) {
    const session = key(event, ['tenant_id', 'workspace_id', 'subject_id', 'session_id']);
    const previous = last.get(session);
    const segment = previous && Date.parse(event.occurred_at) - previous.time <= inactivityMs ? previous.segment : (previous?.segment ?? -1) + 1;
    segments.set(event.event_id, segment);
    last.set(session, { time: Date.parse(event.occurred_at), segment });
  }
  const groupKey = (event, field) => JSON.stringify([key(event, [...journeyFields, 'experience_config_version']), segments.get(event.event_id), event[field]]);
  const distinctSubjects = records => new Set(records.map(event => event.subject_id)).size;
  const protect = (records, result) => distinctSubjects(records) < minimumSubjects
    ? { status: 'suppressed', reason: 'minimum_cohort', minimum_subjects: minimumSubjects }
    : { status: 'observed', ...result };
  const user = name => events.filter(event => event.event_name === name && event.action_origin === 'user');
  const firstBy = (records, field) => {
    const first = new Map();
    for (const event of records.filter(e => e[field])) if (!first.has(groupKey(event, field))) first.set(groupKey(event, field), event);
    return [...first.values()];
  };
  const related = (event, field, names) => events.filter(other => other[field] && groupKey(other, field) === groupKey(event, field)
    && (field !== 'view_instance_id' && field !== 'query_id' || event.resource_ref === other.resource_ref)
    && names.includes(other.event_name) && Date.parse(other.occurred_at) >= Date.parse(event.occurred_at));
  const searches = firstBy(user('search_submitted'), 'search_id');
  const shown = searches.map(search => ({ search, results: related(search, 'search_id', ['search_results_shown'])[0] }));
  const eligible = shown.filter(item => item.results?.parameters.coverage_complete === true);
  const zero = eligible.filter(item => item.results.parameters.visible_count === 0).length;
  const latency = searches.map(search => {
    const open = related(search, 'search_id', ['report_open_requested'])[0];
    const render = open && related(open, 'view_instance_id', ['report_rendered']).find(event => event.outcome === 'success');
    return { search, render, ms: render ? Date.parse(render.occurred_at) - Date.parse(search.occurred_at) : null };
  });
  const matches = latency.filter(item => item.render);
  const safeLatency = distinctSubjects(matches.map(item => item.search)) >= minimumSubjects;
  const opens = firstBy(user('report_open_requested'), 'view_instance_id');
  const reportStates = opens.map(open => ({ open, outcomes: related(open, 'view_instance_id', ['report_rendered', 'report_load_failed']) }));
  const submissions = firstBy(user('query_submitted'), 'query_id');
  const queryStates = submissions.map(query => ({ query, outcomes: related(query, 'query_id', ['query_completed', 'query_failed', 'query_cancelled']),
    viewed: related(query, 'query_id', ['query_results_viewed']) }));
  const completed = queryStates.filter(item => item.outcomes.some(event => event.event_name === 'query_completed'));
  const completedViewed = completed.filter(item => item.viewed.some(view => item.outcomes.some(done => done.event_name === 'query_completed'
    && Date.parse(view.occurred_at) >= Date.parse(done.occurred_at))));
  const safeCompletionRatio = distinctSubjects(completed.map(item => item.query)) >= minimumSubjects;
  const pathGroups = new Map();
  for (const event of events.filter(event => event.action_origin === 'user')) {
    const id = groupKey(event, 'journey_id');
    if (!pathGroups.has(id)) pathGroups.set(id, []);
    pathGroups.get(id).push(event);
  }
  const paths = [...pathGroups.values()];
  const follows = (path, from, to) => path.some((event, index) => event.event_name === from && path.slice(index + 1).some(next => next.event_name === to));
  const docs = paths.filter(path => path.some(event => event.event_name === 'documentation_opened'));
  const answers = paths.filter(path => path.some(event => event.event_name === 'iq_answer_presented'));
  const transitions = new Map();
  for (const path of paths) for (let i = 1; i < path.length; i += 1) {
    const label = `${path[i - 1].event_name} → ${path[i].event_name}`;
    if (!transitions.has(label)) transitions.set(label, { count: 0, subjects: new Set() });
    const entry = transitions.get(label); entry.count += 1; entry.subjects.add(path[i].subject_id);
  }
  const publicTransitions = [...transitions].filter(([, value]) => value.subjects.size >= minimumSubjects)
    .map(([transition, value]) => ({ transition, occurrences: value.count, subjects: value.subjects.size }));
  const observation = { tenant_id, workspace_id, start, end, clock: 'occurred_at UTC; half-open window',
    inactivity_ms: inactivityMs, minimum_subjects: minimumSubjects,
    experience_config_version: experienceConfigVersion ?? 'all; segment before comparison', source_system: sourceSystem ?? 'all; coverage differs' };
  if (distinctSubjects(events) < minimumSubjects) return { status: 'suppressed', observation, reason: 'minimum_cohort', metrics: null };
  return { status: 'observed', observation,
    coverage: { meaning: 'Observed synthetic events only; missing is not zero and handoff is not failure.',
      excluded: 'Other scopes, outside window, preview/test, invalid events; background initiations excluded.',
      unique_subjects: distinctSubjects(events), deduplicated_events: events.length },
    metrics: {
      zero_result_searches: protect(eligible.length ? eligible.map(item => item.search) : searches, { numerator: zero, denominator: eligible.length,
        rate: eligible.length ? zero / eligible.length : null, missing_or_incomplete_results: searches.length - eligible.length }),
      search_to_report_ms: protect(searches, { sample_count: matches.length, missing_outcome_count: searches.length - matches.length,
        mean_ms: safeLatency ? matches.reduce((sum, item) => sum + item.ms, 0) / matches.length : null,
        mean_status: safeLatency ? 'observed' : matches.length ? 'minimum_cohort' : 'no_matches' }),
      report_outcomes: protect(opens, { denominator: opens.length,
        initialized_views: reportStates.filter(item => related(item.open, 'view_instance_id', ['report_initialized']).length).length,
        rendered_views: reportStates.filter(item => item.outcomes.some(event => event.event_name === 'report_rendered' && event.outcome === 'success')).length,
        failed_views: reportStates.filter(item => item.outcomes.some(event => event.event_name === 'report_load_failed' || event.outcome === 'failure')).length,
        partial_views: reportStates.filter(item => item.outcomes.some(event => event.outcome === 'partial')).length,
        unknown_views: reportStates.filter(item => item.outcomes.some(event => event.outcome === 'unknown')).length,
        cancelled_views: reportStates.filter(item => item.outcomes.some(event => event.outcome === 'cancelled')).length,
        missing_terminal_views: reportStates.filter(item => item.outcomes.length === 0).length }),
      query_outcomes: protect(submissions, { denominator: submissions.length, completed: completed.length, results_viewed: completedViewed.length,
        completion_rate: submissions.length ? completed.length / submissions.length : null,
        viewed_per_completed: safeCompletionRatio ? completedViewed.length / completed.length : null,
        viewed_ratio_status: safeCompletionRatio ? 'observed' : completed.length ? 'minimum_cohort' : 'no_completions',
        partial: completed.filter(item => item.outcomes.some(event => event.outcome === 'partial')).length,
        missing_terminal: queryStates.filter(item => !item.outcomes.length).length,
        failed: queryStates.filter(item => item.outcomes.some(event => event.event_name === 'query_failed')).length,
        cancelled: queryStates.filter(item => item.outcomes.some(event => event.event_name === 'query_cancelled')).length }),
      documentation_to_report: protect(docs.flat(), { numerator: docs.filter(path => follows(path, 'documentation_opened', 'report_open_requested')).length, denominator: docs.length }),
      iq_source_follow_through: protect(answers.flat(), { numerator: answers.filter(path => follows(path, 'iq_answer_presented', 'iq_source_opened')).length, denominator: answers.length }),
      transitions: publicTransitions,
      native_handoffs: protect(user('native_source_opened'), { count: user('native_source_opened').length, outcome: 'observation_ends' }),
      return_use: { status: 'not_estimated', reason: 'Fixture does not establish a longitudinal eligible population.' },
    } };
}
