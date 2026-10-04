import { pathToFileURL } from 'node:url';
import { makeFixture } from './fixtures.mjs';
import { composeAnswer } from './evidence-composer.mjs';
import { resolveExperience } from './experience-configuration.mjs';
import { makeExperienceFixture } from './experience-fixtures.mjs';
import { createMockQueryExecutor, createQuerySession } from './governed-query.mjs';
import { makeQueryFixture } from './query-fixtures.mjs';
import { createTelemetryCollector, computeJourneyMetrics } from './journey-telemetry.mjs';
import { syntheticTelemetryContext, runJourneyReference, JOURNEY_WINDOW, JOURNEY_SCOPE } from './journey-fixtures.mjs';

/** Original, in-memory Finance walkthrough. Every UI/SDK action is explicitly simulated. */
export function runWorkingExperience({ telemetryEnabled = true, queryFixture = makeQueryFixture(),
  experienceFixture = makeExperienceFixture(), telemetryClock = () => JOURNEY_WINDOW.end } = {}) {
  const configuration = resolveExperience(experienceFixture);
  if (configuration.status !== 'resolved') return { synthetic: true, configuration };
  const collector = createTelemetryCollector({ enabled: telemetryEnabled, now: telemetryClock });
  const trusted = syntheticTelemetryContext({ experience_config_version: configuration.experience_config_version,
    search_id: 'search-1', query_id: 'query-1', question_id: 'question-1' });
  let sequence = 0;
  let second = 0;
  const eventTime = () => new Date(Date.parse(JOURNEY_WINDOW.start) + second++ * 1_000).toISOString();
  const emit = (event_name, params = {}, overrides = {}, channel = 'host') => collector[channel]({
    schema_version: 1, event_id: `walkthrough-${++sequence}`, occurred_at: eventTime(), event_name, params,
  }, { ...trusted, ...overrides });
  if (configuration.effective.landingPage) {
    emit('workspace_viewed', { module: configuration.effective.landingPage });
    emit('experience_variant_exposed');
  }
  emit('search_submitted', { category: 'reports' });
  const reports = configuration.effective.collectionResourceIds;
  emit('search_results_shown', { visible_count: reports.length, coverage_complete: true });
  if (reports.includes('finance-report')) {
    const bi = { ...trusted, source_system: 'power-bi', resource_ref: 'resource-report-1' };
    emit('search_result_opened', { resource_type: 'report' }, bi);
    emit('report_open_requested', {}, bi);
    const sender = {};
    const binding = { origin: 'https://synthetic-bi.example', sender, source_system: 'power-bi' };
    for (const type of ['loaded', 'rendered', 'pageChanged', 'rendered']) {
      // These are synthetic messages, not actual Power BI callbacks or a browser render.
      collector.embed({ origin: binding.origin, source: sender, data: { type } }, binding,
        { ...bi, action_origin: type === 'pageChanged' ? 'user' : 'background' },
        { event_id: `walkthrough-${++sequence}`, occurred_at: eventTime() });
    }
  }
  emit('definition_opened', {}, { source_system: 'confluence', resource_ref: 'resource-definition-1' });

  const executor = createMockQueryExecutor({ readFixture: () => queryFixture });
  const session = createQuerySession({ getTrustedContext: () => queryFixture.context,
    getPolicy: () => queryFixture.policy, executor, clock: () => Date.parse(queryFixture.now) });
  const queryContext = { source_system: 'snowflake', resource_ref: 'resource-query-1' };
  emit('query_submitted', {}, queryContext);
  let execution = session.submit({ requestId: 'walkthrough-request-1', templateId: 'credits-by-period',
    parameters: { period: '2026-09', entity: 'aster-us' } });
  const states = [execution.status];
  while (['pending', 'running'].includes(execution.status)) {
    execution = session.poll(execution.executionId);
    states.push(execution.status);
  }
  const pages = [];
  if (execution.status === 'succeeded') {
    emit('query_completed', { outcome: execution.result.coverage === 'complete' ? 'success' : 'partial',
      row_count: execution.result.rowCount, truncated: execution.result.truncated },
    { ...queryContext, action_origin: 'background' }, 'server');
    let cursor;
    do {
      const page = session.page({ executionId: execution.executionId, pageSize: 1,
        ...(cursor ? { cursor } : {}) });
      if (page.status !== 'available') break;
      pages.push(page);
      // The in-platform consumer is simulated by this CLI accepting each authorized page.
      emit('query_results_viewed', { page_index: pages.length - 1 }, queryContext);
      cursor = page.nextCursor;
    } while (cursor);
  } else {
    emit('query_failed', { reason: execution.status === 'rejected' ? 'denied' : 'source_failure' },
      { ...queryContext, action_origin: 'background' }, 'server');
  }

  emit('documentation_opened', {}, { source_system: 'sharepoint', resource_ref: 'resource-document-1' });
  emit('iq_question_submitted');
  const evidence = makeFixture();
  // Context assembly remains separately authorized by the original composer. Successful
  // report telemetry is never evidence, nor does a query page waive these ACL checks.
  evidence.identity = queryFixture.context?.subjectId;
  evidence.now = queryFixture.now;
  const credits = evidence.evidence.find(item => item.role === 'credits');
  const complete = pages.length > 0 && pages.every(page => page.coverage === 'complete') &&
    pages.at(-1).nextCursor === null;
  if (complete) {
    credits.payload.contract = structuredClone(pages[0].contract);
    credits.payload.rows = pages.flatMap(page => page.rows.map(row => ({ id: row.creditId, amountCents: row.amountCents })));
  } else evidence.evidence = evidence.evidence.filter(item => item.role !== 'credits');
  const answer = composeAnswer(evidence);
  // Presenting even a reconciled deterministic answer does not establish user correctness.
  emit('iq_answer_presented', { outcome: 'unknown' });
  if (answer.citations.length) emit('iq_source_opened', { resource_type: 'documentation' });
  emit('resource_saved', { resource_type: 'investigation' });
  const events = collector.events(JOURNEY_SCOPE);
  const reference = telemetryEnabled ? runJourneyReference({ experienceConfigVersion: configuration.experience_config_version }) : null;
  return {
    synthetic: true,
    scope: 'Executed local configuration/query/composer; simulated host/SDK actions; no live integration or tracking.',
    configuration,
    query: { execution: 'synthetic-mock', states, starts: executor.starts, result: execution, pages,
      displayedCreditsCents: complete ? pages.flatMap(page => page.rows).reduce((sum, row) => sum + row.amountCents, 0) : null },
    answer: { status: answer.status, answer: answer.answer, calculation: answer.calculation, citations: answer.citations },
    journey: { events, collection: collector.stats(), metrics: computeJourneyMetrics(events, { ...JOURNEY_SCOPE, ...JOURNEY_WINDOW }) },
    separateSyntheticCohort: reference && { fixture: reference.fixture, metrics: reference.metrics, collection: reference.collection },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.slice(2).some(arg => arg !== '--telemetry-disabled')) {
    console.error('Usage: node examples/working-experience.mjs [--telemetry-disabled]');
    process.exitCode = 1;
  } else console.log(JSON.stringify(runWorkingExperience({ telemetryEnabled: !process.argv.includes('--telemetry-disabled') }), null, 2));
}
