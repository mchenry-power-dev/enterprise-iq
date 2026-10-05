import test from 'node:test';
import assert from 'node:assert/strict';
import { RECORDS, PERIODS, REGIONS, PRODUCTS, DEFAULT_FILTERS, summarize, selectRecords, groupRecords,
  REPORTS, DOCUMENTS, QUERY_DEFINITIONS, searchCatalog, canAccess, getResource, createDemoQuerySession,
  sqlPreview, runGuidedQuestion, createCsv, createQueryCsv, safeFilename, queryResultIsStale } from '../src/domain/index.mjs';

function complete(session, templateId = 'credits-by-period', parameters = {}, requestId = crypto.randomUUID()) {
  const initial = session.submit({ requestId, templateId, parameters });
  assert.equal(initial.status, 'pending');
  assert.equal(session.poll(initial.executionId).status, 'running');
  assert.equal(session.poll(initial.executionId).status, 'succeeded');
  return initial.executionId;
}

test('one integer-cent fixture derives the aligned September story and every report grouping', () => {
  const total = summarize();
  assert.equal(total.grossCents, 200_000_000);
  assert.equal(total.creditsCents, 16_000_000);
  assert.equal(total.netCents, 184_000_000);
  assert.equal(total.creditRate, 0.08);
  assert.equal(total.rowCount, 48);
  assert.equal(RECORDS.length, 192);
  for (const dimension of ['region', 'product', 'creditReason', 'channel']) {
    for (const metric of ['grossCents', 'creditsCents', 'netCents']) {
      assert.equal(groupRecords(DEFAULT_FILTERS, dimension).reduce((sum, row) => sum + row[metric], 0), total[metric]);
    }
  }
  for (const record of RECORDS) {
    assert.ok(Number.isSafeInteger(record.grossCents));
    assert.ok(Number.isSafeInteger(record.creditsCents));
    assert.equal(record.netCents, record.grossCents - record.creditsCents);
  }
});

test('time, region, and product filters affect records, summaries, and derived evidence together', () => {
  for (const period of PERIODS) for (const region of REGIONS) for (const product of PRODUCTS) {
    const filters = { period, region, product };
    const summary = summarize(filters);
    assert.equal(selectRecords(filters).length, 4);
    const answer = runGuidedQuestion('reconcile', { filters });
    assert.equal(answer.status, 'reconciled');
    assert.equal(answer.calculation.amounts.grossCents, summary.grossCents);
    assert.equal(answer.calculation.amounts.creditsCents, summary.creditsCents);
    assert.equal(answer.calculation.amounts.financeNetCents, summary.netCents);
    assert.equal(answer.calculation.contract.period.start, `${period}-01`);
    assert.ok(answer.answer.includes(`region=${region}`));
    assert.ok(answer.answer.includes(`product=${product}`));
  }
  assert.notEqual(summarize({ period: '2026-08' }).grossCents, summarize().grossCents);
});

test('changed source amounts change answers; incompatible values retain the unexplained residual', () => {
  const records = structuredClone(RECORDS);
  const record = records.find(row => row.period === '2026-09');
  record.creditsCents += 10_000;
  const mismatch = runGuidedQuestion('reconcile', { records });
  assert.equal(mismatch.status, 'unreconciled');
  assert.equal(mismatch.calculation.amounts.differenceCents, -10_000);
  record.netCents -= 10_000;
  const aligned = runGuidedQuestion('reconcile', { records });
  assert.equal(aligned.status, 'reconciled');
  assert.equal(aligned.calculation.amounts.creditsCents, 16_010_000);
});

test('zero measured values and empty or missing evidence remain different', () => {
  const zero = RECORDS.map(row => ({ ...row, grossCents: 0, creditsCents: 0, netCents: 0, units: 0 }));
  assert.equal(summarize({}, zero).creditRate, null);
  assert.equal(runGuidedQuestion('reconcile', { records: zero }).status, 'reconciled');
  assert.equal(runGuidedQuestion('reconcile', { records: [] }).status, 'insufficient_support');
  assert.equal(summarize({ region: 'unknown' }).coverage, 'empty');
  assert.equal(runGuidedQuestion('reconcile', { filters: { period: '2026-10' } }).status, 'insufficient_support');
  for (const scenario of ['missing-credits', 'stale', 'conflicting-definitions']) {
    const answer = runGuidedQuestion('reconcile', { scenario });
    assert.equal(answer.status, 'insufficient_support');
    assert.equal(answer.calculation, undefined);
  }
});

test('catalog visibility is checked before metadata search and direct resource opening', () => {
  assert.deepEqual(searchCatalog('ＣＲＥＤＩＴ', { persona: 'finance', kind: 'query' }),
    searchCatalog('credit', { persona: 'finance', kind: 'query' }));
  assert.ok(searchCatalog('ＣＲＥＤＩＴ', { persona: 'finance', kind: 'query' }).some(item => item.id === 'credits-by-period'));
  assert.ok(searchCatalog('regional', { department: 'Sales', source: 'Looker' }).length);
  assert.equal(searchCatalog('no such document').length, 0);
  assert.ok(searchCatalog('', { persona: 'finance' }).some(item => item.id === 'close-note'));
  const restricted = searchCatalog('', { persona: 'sales' });
  assert.ok(!restricted.some(item => ['close-note', 'credits-policy', 'credits-report', 'credits-by-period'].includes(item.id)));
  assert.equal(getResource('close-note', 'sales'), null);
  assert.equal(getResource('unknown-resource'), null);
  assert.equal(canAccess('finance-report', 'unknown-role'), false);
  assert.equal(searchCatalog('', { persona: 'unknown-role' }).length, 0);
  for (const item of [...REPORTS, ...DOCUMENTS, ...QUERY_DEFINITIONS]) assert.ok(item.description.length > 20);
});

test('guided scope rejects unrelated questions and restricted answers never reveal denied citations or rows', () => {
  assert.equal(runGuidedQuestion('What is the weather?').status, 'unsupported');
  assert.equal(runGuidedQuestion('Explain gross versus net revenue.').status, 'reconciled');
  const denied = runGuidedQuestion('credits', { persona: 'sales' });
  assert.equal(denied.status, 'insufficient_support');
  const encoded = JSON.stringify(denied);
  assert.ok(!encoded.includes('credit-ledger'));
  assert.ok(!encoded.includes('close-note'));
  assert.ok(!encoded.includes('credit-2026-09-'));
  assert.ok(!denied.context.some(item => ['credits', 'close'].includes(item.role)));
  assert.equal(denied.calculation, undefined);
  assert.equal(runGuidedQuestion('freshness', { scenario: 'stale' }).status, 'insufficient_support');
  assert.equal(runGuidedQuestion('freshness').status, 'supported');
  const related = runGuidedQuestion('related', { persona: 'sales' });
  assert.ok(related.citations.length);
  assert.ok(related.citations.every(item => canAccess(item.resourceId, 'sales')));
});

test('all approved templates calculate local records and carry source, scope, type, and definition context', () => {
  for (const source of ['Snowflake', 'Databricks']) {
    const session = createDemoQuerySession();
    for (const template of QUERY_DEFINITIONS) {
      const id = complete(session, template.id, { source, region: 'West', period: '2026-08' });
      const page = session.page({ executionId: id });
      assert.equal(page.status, 'available');
      assert.ok(page.rows.length);
      assert.equal(page.contract.provenance.platform, source);
      assert.equal(page.contract.period.start, '2026-08-01');
      assert.deepEqual(page.contract.filters, ['country=US', 'status=posted', 'region=West']);
      assert.equal(page.contract.definition.id, template.id);
      assert.ok(page.columns.every(c => ['string', 'integer'].includes(c.type)));
      const preview = sqlPreview(template.id, { source, region: 'West', period: '2026-08' });
      assert.ok(preview.includes("region = 'West'"));
      assert.ok(preview.includes("period = '2026-08'"));
      if (template.id === 'credits-by-period') assert.equal(page.rows.reduce((sum, row) => sum + row.amountCents, 0), summarize({ region: 'West', period: '2026-08' }).creditsCents);
      if (template.id === 'revenue-reconciliation') assert.equal(page.rows.reduce((sum, row) => sum + row.netCents, 0), summarize({ region: 'West', period: '2026-08' }).netCents);
    }
  }
});

test('pagination carries every row once and applies an honest bounded export', () => {
  const session = createDemoQuerySession({ maxRows: 17 });
  const id = complete(session);
  let cursor; const rows = [];
  do {
    const page = session.page({ executionId: id, pageSize: 7, ...(cursor ? { cursor } : {}) });
    assert.equal(page.rowCount, 17);
    assert.equal(page.truncated, true);
    assert.equal(page.coverage, 'partial');
    rows.push(...page.rows); cursor = page.nextCursor;
  } while (cursor);
  assert.equal(rows.length, 17);
  assert.equal(new Set(rows.map(row => row.creditId)).size, 17);
  assert.deepEqual(session.exportRows(id).rows, rows);
  assert.equal(session.page({ executionId: id, pageSize: 101 }).error.code, 'invalid_page_size');
  assert.equal(session.page({ executionId: id, cursor: 'made-up' }).error.code, 'invalid_cursor');
});

test('template input limits and scenario output are independent, with empty, partial and failure distinct', () => {
  const session = createDemoQuerySession();
  const limited = session.page({ executionId: complete(session, 'credits-by-period', { limit: 5 }) });
  assert.equal(limited.rows.length, 5);
  assert.deepEqual(limited.partialReasons, ['row_limit']);
  const partial = session.page({ executionId: complete(session, 'credits-by-period', { scenario: 'partial' }) });
  assert.equal(partial.rows.length, 24); assert.equal(partial.coverage, 'partial');
  assert.deepEqual(partial.partialReasons, ['source_partial']);
  const empty = session.page({ executionId: complete(session, 'credits-by-period', { scenario: 'empty' }) });
  assert.equal(empty.rows.length, 0); assert.equal(empty.coverage, 'complete');
  const failed = session.submit({ requestId: 'failed', templateId: 'credits-by-period', parameters: { scenario: 'failed' } });
  session.poll(failed.executionId);
  assert.equal(session.poll(failed.executionId).status, 'failed');
  assert.equal(session.page({ executionId: failed.executionId }).error.code, 'results_not_available');
});

test('cancellation is terminal and completion does not assert viewed results', () => {
  const session = createDemoQuerySession();
  const request = { requestId: 'cancel-me', templateId: 'credits-by-period', parameters: {} };
  const initial = session.submit(request);
  session.poll(initial.executionId);
  assert.equal(session.cancel(initial.executionId).status, 'cancelled');
  assert.equal(session.poll(initial.executionId).status, 'cancelled');
  assert.equal(session.submit(request).status, 'cancelled');
  assert.equal(session.page({ executionId: initial.executionId }).status, 'rejected');
  const id = complete(session);
  const completion = session.poll(id);
  assert.equal(completion.result.rows, undefined);
  assert.equal(completion.resultsViewed, undefined);
});

test('current persona and export policy are rechecked before every page and download', () => {
  let persona = 'finance'; let exporting = true;
  const session = createDemoQuerySession({ getPersona: () => persona, allowExport: () => exporting });
  const id = complete(session);
  assert.equal(session.exportRows(id).status, 'available');
  exporting = false;
  assert.equal(session.exportRows(id).error.code, 'not_authorized_or_unavailable');
  assert.equal(session.page({ executionId: id }).status, 'available');
  persona = 'sales';
  assert.equal(session.page({ executionId: id }).error.code, 'not_authorized_or_unavailable');
  assert.equal(session.exportRows(id).error.code, 'not_authorized_or_unavailable');
  assert.equal(session.submit({ requestId: 'denied', templateId: 'credits-by-period', parameters: {} }).status, 'rejected');
  assert.equal(session.page({ executionId: complete(session, 'sales-by-region') }).status, 'available');
});

test('idempotency fingerprints include dimensions and source, and reject caller SQL or invalid inputs', () => {
  const session = createDemoQuerySession();
  const request = { requestId: 'one', templateId: 'credits-by-period', parameters: {} };
  const first = session.submit(request);
  assert.deepEqual(session.submit(request), first);
  for (const parameters of [{ region: 'West' }, { product: 'Services' }, { source: 'Databricks' }]) {
    assert.equal(session.submit({ ...request, parameters }).error.code, 'idempotency_conflict');
  }
  for (const parameters of [{ sql: 'SELECT 1' }, { source: 'Unverified' }, { period: "2026-09'; DROP TABLE sample" },
    { region: 'unknown' }, { limit: 0 }, { limit: 101 }, { limit: 3.5 }, { entity: 'other' }]) {
    assert.equal(session.submit({ ...request, requestId: crypto.randomUUID(), parameters }).error.code, 'invalid_request');
  }
  assert.ok(sqlPreview('credits-by-period', { region: "'); SELECT" }).startsWith('-- Choose valid'));
  assert.equal(queryResultIsStale({}, { region: 'West' }), true);
  assert.equal(queryResultIsStale({}, { ...DEFAULT_FILTERS }), false);
});

test('CSV preserves literal data and protects spreadsheet formulas and safe filenames', () => {
  const csv = createCsv([{ name: '=HYPERLINK("bad")', amount: 0 }, { name: '  +1', amount: null },
    { name: 'A, "quoted"\nname', amount: 10 }, { name: '\t@SUM(1)', amount: 5 }], ['name', 'amount']);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"\'  +1"'));
  assert.ok(csv.includes('"A, ""quoted""\nname"'));
  assert.ok(csv.includes('"\'\t@SUM(1)"'));
  assert.equal(safeFilename('../../private/report September:2026'), 'private-report-September-2026.csv');
  assert.equal(safeFilename(''), 'enterprise-iq-export.csv');
  assert.equal(safeFilename('file', 'html'), 'file.csv');
});

test('query exports keep monetary units, definition versions, filters, freshness and partial coverage', () => {
  const session=createDemoQuerySession();
  const id=complete(session,'revenue-reconciliation',{region:'West',product:'Services',limit:1});
  const result=session.exportRows(id);
  const csv=createQueryCsv(result);
  for (const value of ['grossCents','netCents','reportingPeriodStart','2026-09-01','Aster Manufacturing US',
    'USD','entity-month','SUM','region=West','product=Services','net-revenue','gross-revenue',
    '2026-10-01T06:00:00Z','Snowflake','coverage']) assert.ok(csv.includes(value), value);
  assert.equal(result.columns.find(column=>column.name==='netCents').definition.version,'2');
  assert.throws(()=>createQueryCsv({status:'rejected'}),/currently permitted/);
});
