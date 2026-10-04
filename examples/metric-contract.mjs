/** Deterministic contract comparison and integer-cent reconciliation, without source access. */
import { currentWindow } from './authorized-context.mjs';

const SCOPE_FIELDS = ['period', 'currency', 'entity', 'grain', 'filters', 'aggregation'];
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const validPeriod = value => value && validDate(value.start) && validDate(value.end) && value.start <= value.end;

function completeScope(contract) {
  return Boolean(contract && validPeriod(contract.period) &&
    /^[A-Z]{3}$/.test(contract.currency) &&
    ['currency', 'entity', 'grain', 'aggregation'].every(key =>
      typeof contract[key] === 'string' && contract[key].length > 0) &&
    Array.isArray(contract.filters) &&
    contract.filters.every(value => typeof value === 'string' && value.length > 0) &&
    new Set(contract.filters).size === contract.filters.length);
}

function sameDefinition(left, right) {
  return Boolean(left && right && typeof left.id === 'string' && left.id &&
    typeof left.version === 'string' && left.version &&
    left.id === right.id && left.version === right.version);
}

function scopeDifferences(left, right) {
  if (!completeScope(left) || !completeScope(right)) return ['incomplete_contract'];
  return SCOPE_FIELDS.filter(key => {
    if (key === 'period') return left.period.start !== right.period.start || left.period.end !== right.period.end;
    const a = key === 'filters' ? [...left[key]].sort() : left[key];
    const b = key === 'filters' ? [...right[key]].sort() : right[key];
    return !equal(a, b);
  });
}

/** Direct metric comparison requires the same scope AND the same definition/version. */
export function compareMetricContracts(left, right) {
  const differences = scopeDifferences(left, right);
  if (!sameDefinition(left?.definition, right?.definition)) differences.push('definition');
  return { compatible: differences.length === 0, differences };
}

function sumCents(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let total = 0;
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) ||
        !Number.isSafeInteger(row.amountCents) || row.amountCents < 0) return null;
    ids.add(row.id);
    total += row.amountCents;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

const unsupported = reason => ({ status: 'insufficient_support', reason });

/**
 * Reconciliation allows different metric meanings only through this explicit subtraction
 * definition. All amounts, period membership, freshness and provenance must be present.
 * Callers must authorize these objects first; this module does not grant access.
 */
export function reconcileMetrics({ finance, sales, credits, definition, closeNote, lineage, now } = {}) {
  const sources = [finance, sales, credits, definition, closeNote, lineage];
  if (sources.some(item => !item?.payload)) return unsupported('insufficient_allowed_evidence');
  if (sources.some(item => !currentWindow(item.freshness?.refreshedAt, item.freshness?.validUntil, now))) {
    return unsupported('stale_evidence');
  }
  const f = finance.payload;
  const s = sales.payload;
  const c = credits.payload;
  const d = definition.payload;
  const close = closeNote.payload;
  const refresh = lineage.payload;
  const metrics = [finance, sales, credits];
  if (metrics.some(item => !completeScope(item.payload.contract) ||
      !currentWindow(item.payload.contract.freshness?.refreshedAt,
        item.payload.contract.freshness?.validUntil, now) ||
      item.payload.contract.provenance?.fixtureId !== item.id ||
      item.payload.contract.provenance?.platform !== item.platform ||
      item.payload.contract.provenance?.version !== item.version)) {
    return unsupported('invalid_metric_evidence');
  }
  if ([s.contract, c.contract, d.scope, close.scope]
    .some(contract => scopeDifferences(f.contract, contract).length !== 0)) {
    return unsupported('incompatible_metric_scope');
  }
  if (f.contract.aggregation !== 'SUM') return unsupported('unsupported_aggregation');
  if (!sameDefinition(f.contract.definition, d.output) ||
      !sameDefinition(s.contract.definition, d.gross) ||
      !sameDefinition(c.contract.definition, d.credits) ||
      d.output.id !== 'net-revenue' || d.gross.id !== 'gross-revenue' || d.credits.id !== 'period-credits' ||
      d.operation !== 'subtract' || d.creditScope !== 'posted-in-period') {
    return unsupported('incompatible_definition');
  }
  if (typeof c.creditSetId !== 'string' || !c.creditSetId ||
      close.creditSetId !== c.creditSetId || !Array.isArray(close.creditRecordIds) ||
      !Array.isArray(c.rows) || c.rows.some(row => !row || typeof row.id !== 'string') ||
      !equal([...close.creditRecordIds].sort(), c.rows.map(row => row.id).sort())) {
    return unsupported('unverified_period_membership');
  }
  if (!currentWindow(refresh.completedAt, refresh.validUntil, now) ||
      !Array.isArray(refresh.sourceIds) ||
      metrics.some(item => !refresh.sourceIds.includes(item.id) ||
        item.payload.contract.freshness.refreshedAt !== refresh.completedAt)) {
    return unsupported('unverified_freshness_or_lineage');
  }
  const financeNetCents = sumCents(f.rows);
  const grossCents = sumCents(s.rows);
  const creditsCents = sumCents(c.rows);
  if ([financeNetCents, grossCents, creditsCents].some(value => value === null)) {
    return unsupported('invalid_or_missing_amount');
  }
  const calculatedNetCents = grossCents - creditsCents;
  const differenceCents = calculatedNetCents - financeNetCents;
  if (!Number.isSafeInteger(calculatedNetCents) || !Number.isSafeInteger(differenceCents)) {
    return unsupported('invalid_or_missing_amount');
  }
  return {
    status: differenceCents === 0 ? 'reconciled' : 'unreconciled',
    amounts: { grossCents, creditsCents, calculatedNetCents, financeNetCents, differenceCents },
    contract: structuredClone(f.contract),
    definitions: { net: d.output, gross: d.gross, credits: d.credits },
  };
}
