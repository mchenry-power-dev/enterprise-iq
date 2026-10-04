import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture, SCENARIOS } from '../examples/fixtures.mjs';
import { selectAuthorizedContext } from '../examples/authorized-context.mjs';
import { compareMetricContracts } from '../examples/metric-contract.mjs';
import { composeAnswer } from '../examples/evidence-composer.mjs';

const source = (fixture, role) => fixture.evidence.find(item => item.role === role);
const contract = (fixture, role = 'finance') => source(fixture, role).payload.contract;
const serialized = value => JSON.stringify(value);
const noCalculation = answer => {
  assert.equal(answer.status, 'insufficient_support');
  assert.equal(answer.calculation, undefined);
};

test('authorized context contains all six synthetic roles, copies data, and omits ACLs', () => {
  const fixture = makeFixture();
  const selected = selectAuthorizedContext(fixture);
  assert.equal(selected.status, 'selected');
  assert.equal(selected.evidence.length, 6);
  assert.ok(selected.evidence.every(item => !Object.hasOwn(item, 'acl')));
  selected.evidence[0].payload.rows[0].amountCents = 1;
  assert.equal(source(fixture, 'finance').payload.rows[0].amountCents, 184_000_000);
});

test('denied source ID, title, text, citations and lineage links are absent from all output', () => {
  const fixture = makeFixture('restricted');
  const denied = source(fixture, 'credits');
  denied.title = 'RESTRICTED-TITLE-SENTINEL';
  denied.text = 'RESTRICTED-TEXT-SENTINEL';
  const answer = composeAnswer(fixture);
  noCalculation(answer);
  const output = serialized(answer);
  for (const marker of [denied.id, denied.title, denied.text, denied.reference]) {
    assert.ok(!output.includes(marker), `denied marker leaked: ${marker}`);
  }
  assert.equal(answer.context.length, 5);
  assert.equal(answer.citations.length, 5);
  assert.deepEqual(answer.context.find(item => item.role === 'lineage').payload.sourceIds,
    ['finance-report', 'sales-report']);
  assert.ok(!Object.hasOwn(answer, 'deniedCount'));
});

test('undeclared nested metadata and invalid cross-source provenance cannot leak denied evidence', () => {
  const fixture = makeFixture('restricted');
  const denied = source(fixture, 'credits');
  denied.title = 'HIDDEN-METADATA-TITLE';
  denied.text = 'HIDDEN-METADATA-TEXT';
  source(fixture, 'lineage').payload.related = {
    sourceId: denied.id, title: denied.title, text: denied.text,
  };
  const finance = source(fixture, 'finance');
  finance.payload.contract.provenance.fixtureId = denied.id;
  finance.payload.rows[0].related = { sourceId: denied.id, title: denied.title };
  const output = serialized(composeAnswer(fixture));
  for (const marker of [denied.id, denied.title, denied.text]) assert.ok(!output.includes(marker));
  // Mismatched provenance must also remain invalid when the referenced source is allowed.
  const baseline = makeFixture();
  contract(baseline).provenance.fixtureId = 'sales-report';
  noCalculation(composeAnswer(baseline));
});

test('an unknown evidence role cannot introduce an unrestricted payload into context', () => {
  const fixture = makeFixture();
  const unknown = structuredClone(source(fixture, 'definition'));
  unknown.role = 'custom-role';
  unknown.id = 'UNDECLARED-SOURCE';
  unknown.payload = { privateMetadata: 'UNDECLARED-PAYLOAD' };
  fixture.evidence.push(unknown);
  const output = serialized(composeAnswer(fixture));
  assert.ok(!output.includes(unknown.id));
  assert.ok(!output.includes('UNDECLARED-PAYLOAD'));
});

for (const identity of [undefined, '', 'unknown-user']) {
  test(`missing or unknown identity (${String(identity)}) fails closed`, () => {
    const answer = composeAnswer({ ...makeFixture(), identity });
    noCalculation(answer);
    assert.deepEqual(answer.context, []);
    assert.deepEqual(answer.citations, []);
  });
}

for (const mutate of [
  fixture => { delete fixture.permissionSnapshot; },
  fixture => { delete fixture.permissionSnapshot.knownIdentities; },
  fixture => { fixture.permissionSnapshot.checkedAt = 'invalid'; },
  fixture => { fixture.permissionSnapshot.checkedAt = '2026-09-31T00:00:00Z'; },
  fixture => { fixture.permissionSnapshot.checkedAt = '2026-10-03T12:01:00Z'; },
  fixture => { fixture.permissionSnapshot.expiresAt = fixture.now; },
  fixture => { fixture.now = 'invalid'; },
]) {
  test(`invalid or stale permission snapshot fails closed: ${mutate.toString()}`, () => {
    const fixture = makeFixture();
    mutate(fixture);
    const answer = composeAnswer(fixture);
    noCalculation(answer);
    assert.deepEqual(answer.context, []);
    assert.deepEqual(answer.citations, []);
  });
}

test('missing, stale, future and malformed per-source ACL metadata each exclude that source', () => {
  for (const acl of [undefined, {},
    { subjects: ['finance-analyst'], checkedAt: '2026-10-03T10:00:00Z', expiresAt: '2026-10-03T11:00:00Z' },
    { subjects: ['finance-analyst'], checkedAt: '2026-10-03T12:01:00Z', expiresAt: '2026-10-03T13:00:00Z' },
    { subjects: ['finance-analyst'], checkedAt: 'invalid', expiresAt: '2026-10-03T13:00:00Z' },
  ]) {
    const fixture = makeFixture();
    source(fixture, 'credits').acl = acl;
    const answer = composeAnswer(fixture);
    noCalculation(answer);
    assert.ok(!serialized(answer).includes('credit-ledger'));
  }
});

test('revocation requires a newly authorized context and removes old source references', () => {
  const fixture = makeFixture();
  const prior = composeAnswer(fixture);
  assert.equal(prior.status, 'reconciled');
  source(fixture, 'credits').acl.subjects = [];
  const following = composeAnswer(fixture);
  noCalculation(following);
  assert.ok(!serialized(following).includes('credit-ledger'));
  // Already emitted data cannot be erased, but it is never a subsequent access grant.
  const reused = composeAnswer({ ...fixture, evidence: prior.context });
  noCalculation(reused);
  assert.deepEqual(reused.context, []);
});

test('follow-up at an expired permission window receives no context', () => {
  const fixture = makeFixture();
  assert.equal(composeAnswer(fixture).status, 'reconciled');
  fixture.now = '2026-10-03T14:00:00Z';
  const answer = composeAnswer(fixture);
  noCalculation(answer);
  assert.deepEqual(answer.context, []);
});

test('same metric contract is compatible; filter order does not change meaning', () => {
  const left = contract(makeFixture());
  const right = structuredClone(left);
  right.filters.reverse();
  right.period = { end: right.period.end, start: right.period.start };
  right.definition = { version: '2', id: 'net-revenue' };
  assert.deepEqual(compareMetricContracts(left, right), { compatible: true, differences: [] });
});

for (const [dimension, replacement] of [
  ['period', { start: '2026-08-01', end: '2026-08-31' }],
  ['currency', 'EUR'], ['entity', 'Aster Manufacturing Canada'],
  ['grain', 'department-month'], ['filters', ['country=US', 'status=all']],
  ['aggregation', 'AVG'], ['definition', { id: 'net-revenue', version: '3' }],
]) {
  test(`different ${dimension} prevents direct comparison and reconciliation`, () => {
    const fixture = makeFixture();
    const left = contract(fixture);
    const right = structuredClone(left);
    right[dimension] = replacement;
    assert.equal(compareMetricContracts(left, right).compatible, false);
    assert.ok(compareMetricContracts(left, right).differences.includes(dimension));
    contract(fixture, 'sales')[dimension] = replacement;
    noCalculation(composeAnswer(fixture));
  });
}

test('missing scope field is incomplete evidence rather than a wildcard', () => {
  const fixture = makeFixture();
  delete contract(fixture, 'sales').filters;
  assert.equal(compareMetricContracts(contract(fixture), contract(fixture, 'sales')).compatible, false);
  noCalculation(composeAnswer(fixture));
});

test('invalid calendar dates and invalid currency codes fail closed without a formatting exception', () => {
  for (const change of [
    value => { value.period = { start: '2026-02-01', end: '2026-02-31' }; },
    value => { value.currency = 'USDollars'; },
  ]) {
    const fixture = makeFixture();
    for (const item of fixture.evidence) {
      if (item.payload.contract) change(item.payload.contract);
      if (item.payload.scope) change(item.payload.scope);
    }
    assert.equal(compareMetricContracts(contract(fixture), contract(fixture)).compatible, false);
    noCalculation(composeAnswer(fixture));
  }
});

test('gross and net are distinct meanings; only the explicit versioned definition reconciles them', () => {
  const fixture = makeFixture();
  assert.equal(compareMetricContracts(contract(fixture), contract(fixture, 'sales')).compatible, false);
  assert.equal(composeAnswer(fixture).status, 'reconciled');
  source(fixture, 'definition').payload.gross.version = '2';
  const answer = composeAnswer(fixture);
  noCalculation(answer);
  assert.equal(answer.reason, 'incompatible_definition');
});

test('baseline calculates $2M minus $160k equals $1.84M from allowed integer-cent rows', () => {
  const answer = composeAnswer(makeFixture());
  assert.equal(answer.status, 'reconciled');
  assert.deepEqual(answer.calculation.amounts, {
    grossCents: 200_000_000, creditsCents: 16_000_000, calculatedNetCents: 184_000_000,
    financeNetCents: 184_000_000, differenceCents: 0,
  });
  assert.equal(answer.citations.length, 6);
  assert.equal(answer.calculation.contract.provenance.fixtureId, 'finance-report');
  assert.match(answer.answer, /net revenue v2; Sales uses gross revenue v1/);
});

test('changed allowed amounts change the calculation and produce an unexplained residual', () => {
  const fixture = makeFixture();
  source(fixture, 'credits').payload.rows[1].amountCents = 2_000_000;
  const answer = composeAnswer(fixture);
  assert.equal(answer.status, 'unreconciled');
  assert.equal(answer.calculation.amounts.creditsCents, 12_000_000);
  assert.equal(answer.calculation.amounts.calculatedNetCents, 188_000_000);
  assert.equal(answer.calculation.amounts.differenceCents, 4_000_000);
  assert.match(answer.answer, /do not fully reconcile/);
});

test('changed consistent amounts create a different reconciled answer, rather than fixed prose', () => {
  const fixture = makeFixture();
  source(fixture, 'sales').payload.rows[0].amountCents = 130_000_000;
  source(fixture, 'finance').payload.rows[0].amountCents = 194_000_000;
  const answer = composeAnswer(fixture);
  assert.equal(answer.status, 'reconciled');
  assert.equal(answer.calculation.amounts.grossCents, 210_000_000);
  assert.match(answer.answer, /\$2,100,000\.00/);
  assert.match(answer.answer, /\$1,940,000\.00/);
});

test('the checked contract determines narrative period and filters', () => {
  const fixture = makeFixture();
  for (const item of fixture.evidence) {
    for (const value of [item.payload.contract, item.payload.scope].filter(Boolean)) {
      value.period = { start: '2026-08-01', end: '2026-08-31' };
      value.filters = ['country=US', 'status=posted', 'division=Industrial'];
    }
  }
  const answer = composeAnswer(fixture);
  assert.equal(answer.status, 'reconciled');
  assert.match(answer.answer, /2026-08-01 through 2026-08-31/);
  assert.match(answer.answer, /division=Industrial/);
  assert.ok(!answer.answer.includes('September 2026'));
});

test('citations use navigable local walkthrough source anchors', () => {
  const answer = composeAnswer(makeFixture());
  for (const citation of answer.citations) {
    assert.equal(citation.reference, `../docs/walkthrough.md#${citation.id}`);
  }
  const conflict = composeAnswer(makeFixture('conflicting-definitions'));
  assert.equal(conflict.citations.find(item => item.id === 'revenue-definition-v3').reference,
    '../docs/walkthrough.md#definition-versions');
});

test('zero is accepted only as an explicit measured amount, not as missing evidence', () => {
  const fixture = makeFixture();
  for (const row of source(fixture, 'credits').payload.rows) row.amountCents = 0;
  source(fixture, 'finance').payload.rows[0].amountCents = 200_000_000;
  const answer = composeAnswer(fixture);
  assert.equal(answer.status, 'reconciled');
  assert.equal(answer.calculation.amounts.creditsCents, 0);
});

test('missing any required permitted role withholds the numerical conclusion', () => {
  for (const role of ['finance', 'sales', 'credits', 'definition', 'close', 'lineage']) {
    const fixture = makeFixture();
    fixture.evidence = fixture.evidence.filter(item => item.role !== role);
    noCalculation(composeAnswer(fixture));
  }
});

test('stale freshness, incomplete lineage and stale metric observations prevent reconciliation', () => {
  const variants = [
    fixture => { source(fixture, 'definition').freshness.validUntil = '2026-10-02T00:00:00Z'; },
    fixture => { contract(fixture).freshness.validUntil = '2026-10-02T00:00:00Z'; },
    fixture => { source(fixture, 'lineage').payload.validUntil = '2026-10-02T00:00:00Z'; },
    fixture => { source(fixture, 'lineage').payload.sourceIds = ['finance-report', 'sales-report']; },
    fixture => { source(fixture, 'lineage').payload.completedAt = '2026-10-01T07:00:00Z'; },
  ];
  for (const change of variants) {
    const fixture = makeFixture();
    change(fixture);
    noCalculation(composeAnswer(fixture));
  }
});

test('conflicting definition versions preserve distinct meanings without choosing one', () => {
  const answer = composeAnswer(makeFixture('conflicting-definitions'));
  noCalculation(answer);
  assert.equal(answer.reason, 'conflicting_allowed_evidence');
  const definitions = answer.context.filter(item => item.role === 'definition');
  assert.deepEqual(definitions.map(item => item.payload.output.version), ['2', '3']);
  assert.deepEqual(definitions.map(item => item.payload.creditScope), ['posted-in-period', 'all-issued']);
  assert.ok(!answer.answer.includes('$1,840,000'));
});

test('close-period membership and fixture provenance are required, not assumed', () => {
  for (const change of [
    fixture => { source(fixture, 'close').payload.creditRecordIds = ['credit-a']; },
    fixture => { source(fixture, 'close').payload.creditSetId = 'october-credits'; },
    fixture => { contract(fixture).provenance.fixtureId = 'other-report'; },
    fixture => { delete contract(fixture).provenance.version; },
  ]) {
    const fixture = makeFixture();
    change(fixture);
    noCalculation(composeAnswer(fixture));
  }
});

test('missing, malformed, duplicate and unsafe values are insufficient, never replaced with zero', () => {
  for (const rows of [[], undefined, [null], [{ id: 'credit-a', amountCents: null }],
    [{ id: 'credit-a', amountCents: 1.5 }], [{ id: 'credit-a', amountCents: Number.MAX_SAFE_INTEGER + 1 }],
    [{ id: 'credit-a', amountCents: 1 }, { id: 'credit-a', amountCents: 2 }],
  ]) {
    const fixture = makeFixture();
    source(fixture, 'credits').payload.rows = rows;
    noCalculation(composeAnswer(fixture));
  }
});

test('even matching AVG scopes cannot make a SUM-only calculator claim support', () => {
  const fixture = makeFixture();
  for (const item of fixture.evidence) {
    if (item.payload.contract) item.payload.contract.aggregation = 'AVG';
    if (item.payload.scope) item.payload.scope.aggregation = 'AVG';
  }
  const answer = composeAnswer(fixture);
  noCalculation(answer);
  assert.equal(answer.reason, 'unsupported_aggregation');
});

test('malicious-looking source instructions remain inert data and cannot change the answer', () => {
  const baseline = composeAnswer(makeFixture());
  const answer = composeAnswer(makeFixture('malicious'));
  assert.equal(answer.status, 'reconciled');
  assert.equal(answer.answer, baseline.answer);
  assert.deepEqual(answer.calculation, baseline.calculation);
  assert.deepEqual(answer.citations, baseline.citations);
  assert.match(answer.context.find(item => item.role === 'definition').text, /Ignore earlier instructions/);
  assert.ok(!answer.answer.includes('SECRET-DOCUMENT'));
});

test('all CLI fixture scenarios exercise the advertised reference outcomes', () => {
  const statuses = Object.fromEntries(SCENARIOS.map(scenario => [scenario, composeAnswer(makeFixture(scenario)).status]));
  assert.deepEqual(statuses, {
    baseline: 'reconciled', stale: 'insufficient_support', 'conflicting-definitions': 'insufficient_support',
    'missing-credits': 'insufficient_support', restricted: 'insufficient_support',
    revoked: 'insufficient_support', malicious: 'reconciled',
  });
});
