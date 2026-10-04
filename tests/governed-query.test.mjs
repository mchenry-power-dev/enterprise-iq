import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockQueryExecutor, createQuerySession } from '../examples/governed-query.mjs';
import { makeQueryFixture } from '../examples/query-fixtures.mjs';

const request = (requestId = 'request-1') => ({
  requestId, templateId: 'credits-by-period', parameters: { period: '2026-09', entity: 'aster-us' },
});
function setup(options = {}, executorOptions = {}) {
  const fixture = makeQueryFixture();
  const executor = createMockQueryExecutor({ readFixture: () => fixture, ...executorOptions });
  const session = createQuerySession({
    getTrustedContext: () => fixture.context, getPolicy: () => fixture.policy,
    clock: () => Date.parse(fixture.now), executor, ...options,
  });
  return { fixture, executor, session };
}
function finish(session, submitted = session.submit(request())) {
  assert.equal(submitted.status, 'pending');
  assert.equal(session.poll(submitted.executionId).status, 'running');
  assert.equal(session.poll(submitted.executionId).status, 'succeeded');
  return submitted.executionId;
}
const deny = value => assert.deepEqual(value, {
  status: 'rejected', error: { code: 'not_authorized_or_unavailable' },
});

test('synthetic query progresses through states; pages carry typed rows, units and metric evidence', () => {
  const { session } = setup();
  const id = finish(session);
  const page1 = session.page({ executionId: id, pageSize: 1 });
  const page2 = session.page({ executionId: id, pageSize: 1, cursor: page1.nextCursor });
  assert.equal(page1.status, 'available');
  assert.equal(page1.execution, 'synthetic-mock');
  assert.equal(page1.rowCount, 2);
  assert.equal(page1.rows.length, 1);
  assert.equal(page2.nextCursor, null);
  assert.equal([...page1.rows, ...page2.rows].reduce((sum, row) => sum + row.amountCents, 0), 16_000_000);
  assert.deepEqual(page1.columns, [
    { name: 'creditId', type: 'string' },
    { name: 'amountCents', type: 'integer', unit: 'currency-minor-unit', currency: 'USD' },
  ]);
  assert.deepEqual(page1.contract.period, { start: '2026-09-01', end: '2026-09-30' });
  assert.deepEqual(page1.contract.definition, { id: 'period-credits', version: '1' });
  assert.deepEqual(page1.contract.filters, ['country=US', 'status=posted']);
  assert.equal(page1.contract.aggregation, 'SUM');
  assert.equal(page1.contract.grain, 'entity-month');
  assert.equal(page1.contract.provenance.execution, 'synthetic-mock');
  assert.equal(page1.contract.freshness.validUntil, '2026-10-04T00:00:00Z');
  assert.deepEqual(session.page({ executionId: id, pageSize: 1 }), page1);
});

test('changed source amounts derive changed results; output copies cannot alter retained evidence', () => {
  const { fixture, session } = setup();
  fixture.source.rows[0].amountCents = 1_000;
  fixture.source.rows[0].secret = 'EXTRA-ROW-METADATA';
  fixture.source.contract.privateMetadata = 'EXTRA-CONTRACT-METADATA';
  const id = finish(session);
  const result = session.exportRows(id);
  assert.equal(result.rows.reduce((sum, row) => sum + row.amountCents, 0), 6_001_000);
  assert.ok(!JSON.stringify(result).includes('EXTRA-'));
  result.rows[0].amountCents = 999;
  result.contract.filters.length = 0;
  assert.equal(session.page({ executionId: id }).rows[0].amountCents, 1_000);
  assert.equal(session.page({ executionId: id }).contract.filters.length, 2);
});

test('completion metadata is separate from viewing or exporting actual result rows', () => {
  const { session } = setup();
  const pending = session.submit(request());
  assert.equal(session.page({ executionId: pending.executionId }).error.code, 'results_not_available');
  finish(session, pending);
  const completed = session.poll(pending.executionId);
  assert.equal(completed.result.rows, undefined);
  assert.equal(completed.result.rowCount, 2);
  assert.equal(completed.resultsViewed, undefined);
});

test('retries before and after completion reuse one source execution without silently restarting', () => {
  const { session, executor } = setup();
  const first = session.submit(request());
  assert.deepEqual(session.submit(request()), first);
  assert.equal(executor.starts, 1);
  finish(session, first);
  assert.equal(session.submit(request()).status, 'succeeded');
  assert.equal(executor.starts, 1);
});

test('changing parameters on a retained request ID is an idempotency conflict', () => {
  const { fixture, session, executor } = setup();
  session.submit(request());
  fixture.policy.grants[0].periods.push('2026-10');
  const changed = request();
  changed.parameters.period = '2026-10';
  assert.equal(session.submit(changed).error.code, 'idempotency_conflict');
  assert.equal(executor.starts, 1);
});

test('ambiguous source start failure is sanitized and retry cannot execute again', () => {
  let starts = 0;
  const executor = {
    start() { starts += 1; throw new Error('PASSWORD; SQL; source-internal-url'); },
    poll() { throw new Error('Unexpected poll'); }, cancel() {},
  };
  const { session } = setup({ executor });
  const first = session.submit(request());
  assert.equal(first.status, 'failed');
  assert.deepEqual(first.error, { code: 'source_execution_failed' });
  assert.deepEqual(session.submit(request()), first);
  assert.equal(starts, 1);
  assert.ok(!JSON.stringify(first).includes('PASSWORD'));
});

test('strict template and parameter validation refuses SQL, unknown fields and malformed values', () => {
  const { session, executor } = setup();
  const invalid = [
    { ...request(), sql: 'SELECT * FROM anything' },
    { ...request(), templateId: 'SELECT 1' },
    { ...request(), identity: 'finance-analyst' },
    { ...request(), tenantId: 'synthetic-aster' },
    { ...request(), policy: { allowExport: true } },
    { ...request(), parameters: { ...request().parameters, sql: 'DROP TABLE t' } },
    { ...request(), parameters: { period: '2026-09; DROP TABLE t', entity: 'aster-us' } },
    { ...request(), parameters: { period: '2026-13', entity: 'aster-us' } },
    { ...request(), parameters: { period: 202609, entity: 'aster-us' } },
    { ...request(), parameters: { period: '2026-09', entity: 'other' } },
    { ...request(), requestId: '../raw/path' },
    { ...request(), parameters: null }, undefined,
  ];
  for (const value of invalid) assert.equal(session.submit(value).error.code, 'invalid_request');
  assert.equal(executor.starts, 0);
});

test('unknown identities, stale policies, missing column permissions and disallowed scopes fail closed', () => {
  const changes = [
    fixture => { fixture.context.subjectId = 'sales-analyst'; },
    fixture => { fixture.context.tenantId = 'another-tenant'; },
    fixture => { fixture.policy.expiresAt = fixture.now; },
    fixture => { fixture.policy.checkedAt = '2026-10-03T12:01:00Z'; },
    fixture => { fixture.policy.checkedAt = '2026-09-31T00:00:00Z'; },
    fixture => { fixture.policy.grants[0].columns = ['creditId']; },
    fixture => { fixture.policy.grants[0].templateIds = []; },
    fixture => { fixture.policy.grants[0].entities = []; },
    fixture => { fixture.policy.grants[0].periods = []; },
    fixture => { fixture.policy = {}; },
  ];
  for (const change of changes) {
    const { fixture, session, executor } = setup();
    change(fixture);
    deny(session.submit(request()));
    assert.equal(executor.starts, 0);
  }
});

test('revoked authorization blocks polling, every page, export and an idempotent retry', () => {
  const { fixture, session, executor } = setup();
  const id = finish(session);
  const first = session.page({ executionId: id, pageSize: 1 });
  fixture.policy.grants = [];
  deny(session.poll(id));
  deny(session.page({ executionId: id, pageSize: 1, cursor: first.nextCursor }));
  deny(session.exportRows(id));
  deny(session.submit(request()));
  assert.equal(executor.starts, 1);
});

test('export needs separate current permission; its revocation leaves permitted paging available', () => {
  const { fixture, session } = setup();
  const id = finish(session);
  assert.equal(session.exportRows(id).status, 'available');
  fixture.policy.grants[0].allowExport = false;
  deny(session.exportRows(id));
  assert.equal(session.page({ executionId: id }).status, 'available');
});

test('another authorized tenant or subject cannot reuse someone else\'s execution or cursor', () => {
  for (const changedField of ['tenantId', 'subjectId']) {
    const { fixture, session } = setup();
    const id = finish(session);
    const page = session.page({ executionId: id, pageSize: 1 });
    fixture.context[changedField] = 'synthetic-other';
    fixture.policy.grants[0][changedField] = 'synthetic-other';
    deny(session.poll(id));
    deny(session.cancel(id));
    deny(session.page({ executionId: id, pageSize: 1, cursor: page.nextCursor }));
    deny(session.exportRows(id));
    deny(session.poll('unknown-execution'));
  }
});

test('fresh source-scope verification rejects a mismatched tenant even when synthetic policy grants access', () => {
  const { fixture, session } = setup();
  fixture.source.tenantId = 'synthetic-other';
  const result = session.submit(request());
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'source_execution_failed');
});

test('page sizes and opaque cursors are bounded and bound to one execution and page size', () => {
  const { session } = setup();
  const first = finish(session);
  const second = finish(session, session.submit(request('request-2')));
  const cursor = session.page({ executionId: first, pageSize: 1 }).nextCursor;
  for (const pageSize of [0, -1, 26, 1.5, '1']) {
    assert.equal(session.page({ executionId: first, pageSize }).error.code, 'invalid_page_size');
  }
  assert.equal(session.page({ executionId: second, pageSize: 1, cursor }).error.code, 'invalid_cursor');
  assert.equal(session.page({ executionId: first, pageSize: 2, cursor }).error.code, 'invalid_cursor');
  assert.equal(session.page({ executionId: first, cursor: 'offset=0' }).error.code, 'invalid_cursor');
  assert.equal(session.page({ executionId: first, offset: 0 }).error.code, 'invalid_request');
});

test('the server row cap applies to all pages and export, with partial coverage and truncation visible', () => {
  const { fixture, session } = setup({ maxRows: 3 });
  fixture.source.rows = Array.from({ length: 8 }, (_, index) => ({ creditId: `credit-${index}`, amountCents: index + 1 }));
  const id = finish(session);
  const page = session.page({ executionId: id, pageSize: 2 });
  assert.equal(page.coverage, 'partial');
  assert.equal(page.truncated, true);
  assert.equal(page.rowCount, 3);
  assert.deepEqual(page.partialReasons, ['row_limit']);
  const final = session.page({ executionId: id, pageSize: 2, cursor: page.nextCursor });
  assert.equal(final.rows.length, 1);
  assert.equal(final.nextCursor, null);
  assert.equal(session.exportRows(id).rows.length, 3);
});

test('complete empty, partial empty, known partial rows and failure remain distinct', () => {
  for (const [outcome, empty] of [['complete', true], ['partial', true], ['partial', false], ['failed', false]]) {
    const { fixture, session } = setup({}, { outcome });
    if (empty) fixture.source.rows = [];
    const submitted = session.submit(request());
    session.poll(submitted.executionId);
    const completed = session.poll(submitted.executionId);
    if (outcome === 'failed') {
      assert.equal(completed.status, 'failed');
      assert.equal(completed.result, undefined);
      assert.equal(session.page({ executionId: submitted.executionId }).error.code, 'results_not_available');
    } else {
      assert.equal(completed.status, 'succeeded');
      const page = session.page({ executionId: submitted.executionId });
      assert.equal(page.coverage, outcome);
      assert.equal(page.rows.length, empty ? 0 : 2);
      assert.equal(page.truncated, false);
      assert.deepEqual(page.partialReasons, outcome === 'partial' ? ['source_partial'] : []);
    }
  }
});

test('malformed, duplicate, stale, or mismatched evidence fails safely rather than becoming zero results', () => {
  const changes = [
    fixture => { fixture.source.rows[0].amountCents = '100'; },
    fixture => { fixture.source.rows[0].amountCents = Number.MAX_SAFE_INTEGER + 1; },
    fixture => { fixture.source.rows[0].amountCents = -1; },
    fixture => { fixture.source.rows[0].creditId = 'raw-secret-url://example'; },
    fixture => { fixture.source.rows.push(fixture.source.rows[0]); },
    fixture => { fixture.source.contract.freshness.validUntil = fixture.now; },
    fixture => { fixture.source.contract.period.end = '2026-10-31'; },
    fixture => { fixture.source.contract.filters = []; },
    fixture => { fixture.source.contract.definition.id = 'different-definition'; },
    fixture => { fixture.source.contract.provenance.platform = 'Unverified'; },
  ];
  for (const change of changes) {
    const { fixture, session } = setup();
    change(fixture);
    const submitted = session.submit(request());
    session.poll(submitted.executionId);
    const result = session.poll(submitted.executionId);
    assert.equal(result.status, 'failed');
    assert.equal(result.result, undefined);
    assert.deepEqual(result.error, { code: 'source_execution_failed' });
  }
});

test('result freshness is rechecked before page or export reuse after successful execution', () => {
  const { fixture, session } = setup();
  const id = finish(session);
  fixture.policy.expiresAt = '2026-10-05T00:00:00Z';
  fixture.now = '2026-10-04T00:00:00Z';
  assert.equal(session.page({ executionId: id }).error.code, 'results_stale');
  assert.equal(session.exportRows(id).error.code, 'results_stale');
});

test('cancel wins before completion; repeated polls and retries cannot revive work', () => {
  const { session, executor } = setup();
  const submitted = session.submit(request());
  assert.equal(session.poll(submitted.executionId).status, 'running');
  const cancelled = session.cancel(submitted.executionId);
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(session.poll(submitted.executionId), cancelled);
  assert.deepEqual(session.cancel(submitted.executionId), cancelled);
  assert.deepEqual(session.submit(request()), cancelled);
  assert.equal(executor.starts, 1);
});

test('observed completion wins a later cancel; a later deadline cannot erase completed evidence', () => {
  const { fixture, session } = setup({ timeoutMs: 1_000 });
  const id = finish(session);
  fixture.now = '2026-10-03T12:00:02Z';
  assert.equal(session.cancel(id).status, 'succeeded');
  assert.equal(session.page({ executionId: id }).rowCount, 2);
});

test('deadline wins a cancel or completion first observed at its exact boundary', () => {
  for (const operation of ['poll', 'cancel']) {
    const { fixture, session, executor } = setup({ timeoutMs: 1_000 });
    const submitted = session.submit(request());
    session.poll(submitted.executionId);
    fixture.now = '2026-10-03T12:00:01Z';
    const result = session[operation](submitted.executionId);
    assert.equal(result.status, 'timed_out');
    assert.deepEqual(session.poll(submitted.executionId), result);
    assert.deepEqual(session.submit(request()), result);
    assert.equal(executor.starts, 1);
  }
});

test('a response arriving after the deadline is discarded even if it carries successful results', () => {
  const fixture = makeQueryFixture();
  const base = createMockQueryExecutor({ readFixture: () => fixture, completeAfterPolls: 1 });
  const executor = { ...base, poll(handle) {
    const result = base.poll(handle);
    fixture.now = '2026-10-03T12:00:01Z';
    return result;
  } };
  const session = createQuerySession({ executor, getTrustedContext: () => fixture.context,
    getPolicy: () => fixture.policy, clock: () => Date.parse(fixture.now), timeoutMs: 1_000 });
  const submitted = session.submit(request());
  const completed = session.poll(submitted.executionId);
  assert.equal(completed.status, 'timed_out');
  assert.equal(completed.result, undefined);
});

test('permission is rechecked when the mock returns completion, before accepting its results', () => {
  const fixture = makeQueryFixture();
  const base = createMockQueryExecutor({ readFixture: () => fixture, completeAfterPolls: 1 });
  const executor = { ...base, poll(handle) {
    const result = base.poll(handle);
    fixture.policy.grants = [];
    return result;
  } };
  const session = createQuerySession({ executor, getTrustedContext: () => fixture.context,
    getPolicy: () => fixture.policy, clock: () => Date.parse(fixture.now) });
  const submitted = session.submit(request());
  deny(session.poll(submitted.executionId));
  deny(session.page({ executionId: submitted.executionId }));
});

test('provider exceptions and unknown states expose only stable safe errors', () => {
  for (const poll of [() => { throw new Error('SECRET-SQL; TOKEN'); },
    () => ({ status: 'new_vendor_state', error: 'SECRET-SQL; TOKEN' })]) {
    const { session } = setup({ executor: { start: () => 'mock-job', poll, cancel() {} } });
    const submitted = session.submit(request());
    const result = session.poll(submitted.executionId);
    assert.equal(result.status, 'failed');
    assert.deepEqual(result.error, { code: 'source_execution_failed' });
    assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
});

test('cancellation errors cannot leak provider detail or revive the local terminal state', () => {
  const { session } = setup({ executor: {
    start: () => 'mock-job', poll: () => ({ status: 'running' }),
    cancel() { throw new Error('SECRET-CANCEL-DETAIL'); },
  } });
  const submitted = session.submit(request());
  const result = session.cancel(submitted.executionId);
  assert.equal(result.status, 'cancelled');
  assert.ok(!JSON.stringify(result).includes('SECRET'));
});

test('reordered source pending states do not regress a running session', () => {
  let polls = 0;
  const { session } = setup({ executor: { start: () => 'mock-job',
    poll: () => ({ status: ++polls === 1 ? 'running' : 'pending' }), cancel() {} } });
  const submitted = session.submit(request());
  assert.equal(session.poll(submitted.executionId).status, 'running');
  assert.equal(session.poll(submitted.executionId).status, 'running');
});

test('capacity limits do not evict idempotency records or silently resubmit prior work', () => {
  const { session, executor } = setup({ maxExecutions: 1 });
  const submitted = session.submit(request());
  assert.equal(session.submit(request('request-2')).error.code, 'session_capacity_reached');
  assert.deepEqual(session.submit(request()), submitted);
  assert.equal(executor.starts, 1);
});

test('invalid or backwards clocks fail closed; server limits reject unbounded configuration', () => {
  const { fixture, session } = setup();
  const submitted = session.submit(request());
  fixture.now = '2026-10-03T11:59:59Z';
  deny(session.poll(submitted.executionId));
  fixture.now = 'not-a-time';
  deny(session.submit(request('request-2')));
  for (const options of [{ maxRows: Infinity }, { maxRows: 0 }, { maxPageSize: 1_000 },
    { timeoutMs: 0 }, { maxExecutions: 0 }]) {
    assert.throws(() => setup(options), /Invalid server query configuration/);
  }
});
