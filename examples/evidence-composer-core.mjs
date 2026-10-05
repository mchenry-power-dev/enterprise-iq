/** Evidence composer: deterministic JavaScript, no LLM, network, query execution or writeback. */
import { selectAuthorizedContext } from './authorized-context.mjs';
import { reconcileMetrics } from './metric-contract.mjs';
import { QUESTION } from './fixtures.mjs';

const money = (cents, currency) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency, maximumFractionDigits: 2,
}).format(cents / 100);

/**
 * Always reselect from current raw evidence and permission metadata. Source text is kept
 * as data in context, never parsed as instructions, evaluated, or used to grant access.
 * The only supported question is the synthetic revenue investigation.
 */
export function composeAnswer(inputs = {}) {
  const selected = selectAuthorizedContext(inputs);
  const context = selected.evidence;
  const references = context.map(item => ({
    id: item.id, title: item.title, platform: item.platform,
    reference: item.reference, version: item.version,
  }));
  const result = {
    question: QUESTION,
    composer: 'deterministic-reference',
    status: 'insufficient_support',
    answer: 'The currently permitted evidence is insufficient for a supported reconciliation. No numerical conclusion is asserted.',
    citations: references,
    context,
    caveats: ['Synthetic evidence and authorization; target adapters are not connected.',
      'This deterministic composer does not call a language model.'],
    nextInvestigations: ['Review permitted metric scope and definitions, then obtain current authorized evidence before retrying.'],
  };
  if (selected.status !== 'selected') return result;
  const roles = ['finance', 'sales', 'credits', 'definition', 'close', 'lineage'];
  const grouped = Object.fromEntries(roles.map(role => [role, context.filter(item => item.role === role)]));
  if (roles.some(role => grouped[role].length === 0)) return result;
  if (roles.some(role => grouped[role].length !== 1)) {
    result.reason = 'conflicting_allowed_evidence';
    result.answer = 'The permitted evidence contains competing versions or measurements. Their distinct meanings remain in the context; a reconciliation requires an approved selection.';
    result.nextInvestigations = ['Resolve the competing permitted definitions or measurements before comparing amounts.'];
    return result;
  }
  const checked = reconcileMetrics({
    finance: grouped.finance[0], sales: grouped.sales[0], credits: grouped.credits[0],
    definition: grouped.definition[0], closeNote: grouped.close[0], lineage: grouped.lineage[0],
    now: inputs.now,
  });
  result.status = checked.status;
  if (checked.status === 'insufficient_support') {
    result.reason = checked.reason;
    return result;
  }
  result.calculation = checked;
  const { grossCents, creditsCents, calculatedNetCents, financeNetCents, differenceCents } = checked.amounts;
  const currency = checked.contract.currency;
  const format = amount => money(amount, currency);
  if (checked.status === 'reconciled') {
    result.answer = `Finance uses net revenue v${checked.definitions.net.version}; Sales uses gross revenue v${checked.definitions.gross.version}. ` +
      `For ${checked.contract.entity}, ${checked.contract.period.start} through ${checked.contract.period.end}, ${currency}, ` +
      `${checked.contract.grain}, ${checked.contract.aggregation}, ${checked.contract.filters.join(', ')}, the figures reconcile: ` +
      `${format(grossCents)} gross − ${format(creditsCents)} period credits = ${format(calculatedNetCents)} net. ` +
      'The difference is explained by the permitted definitions and credit evidence; there is no evidence here of a broken pipeline.';
    result.nextInvestigations = ['Inspect the cited definition and close-period membership before making a pipeline claim.'];
  } else {
    result.answer = `The permitted definition gives ${format(grossCents)} gross − ${format(creditsCents)} period credits = ${format(calculatedNetCents)} net, ` +
      `while Finance reports ${format(financeNetCents)}. The residual is ${format(differenceCents)}. ` +
      'These inputs do not fully reconcile; their discrepancy does not establish a pipeline cause.';
    result.nextInvestigations = ['Check the cited amounts and close-period membership to explain the residual.'];
  }
  return result;
}
