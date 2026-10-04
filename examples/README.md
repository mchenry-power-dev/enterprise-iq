# Run the synthetic reference examples

From the repository root, using **Node.js 24 or later**:

```sh
node --test
node examples/working-experience.mjs
node examples/working-experience.mjs --telemetry-disabled
node examples/evidence-composer.mjs
node examples/evidence-composer.mjs stale
node examples/evidence-composer.mjs conflicting-definitions
node examples/evidence-composer.mjs missing-credits
node examples/evidence-composer.mjs restricted
node examples/evidence-composer.mjs revoked
node examples/evidence-composer.mjs malicious
```

All commands use Node's standard library: no installation, credentials, tenant, model,
tracking endpoint, or network. The integrated CLI resolves a **Finance** experience,
executes the mock credits query, retrieves its table, and projects a sanitized event
journey. The disabled variant demonstrates permitted work without analytics emission.
Neither command opens an embedded report or connects to an enterprise system.

| Pattern | Implemented reference behavior |
| --- | --- |
| [Authorized context](authorized-context.mjs) | Recheck the synthetic identity registry and source ACL validity; select evidence and permitted lineage links. |
| [Metric contracts](metric-contract.mjs) | Check scope, definition versions, period membership, freshness and provenance; calculate integer-cent SUM amounts. |
| [Evidence composer](evidence-composer.mjs) | Produce a deterministic answer and citations from authorized, checked evidence. |
| [Experience configuration](experience-configuration.mjs) | Resolve validated layers, locks, access projection, value provenance and a configuration version. |
| [Governed query](governed-query.mjs) | Execute an allowlisted mock template with current policy checks, bounded results, pagination and cancellation. |
| [Journey telemetry](journey-telemetry.mjs) | Project host/server/simulated SDK events and calculate scoped, coverage-aware metrics. |

## Original evidence and arithmetic

The composer prints JSON with `status`, `answer`, `citations`, `context`, `caveats`, and
`nextInvestigations`. Supported calculations also contain `calculation`. Baseline:
**$2,000,000 − $160,000 = $1,840,000**. Changed amounts change the result; an unexplained
residual produces `unreconciled` without inventing a pipeline cause. Stale, conflicting,
missing, restricted and revoked scenarios return `insufficient_support` without a
calculation. Malicious source text remains inert data and does not change the checked answer.

The fixed question concerns the [September revenue walkthrough](../docs/walkthrough.md).
All three measurements describe fictional `Aster Manufacturing US`, September 1–30, 2026,
USD, `entity-month`, `country=US`, `status=posted`, and SUM. Contracts retain period,
currency, entity, grain, filters, aggregation, definition ID/version, freshness and
provenance. Direct comparison requires the same definition. Reconciliation requires the
explicit mapping **net-revenue v2 = gross-revenue v1 − period-credits v1**.

The [original fixture](fixtures.mjs) fixes evaluation at `2026-10-03T12:00:00Z`, with
permission windows from 11:00 to 13:00 UTC. Freshness expires October 4; the synthetic
refresh occurred October 1 at 06:00 UTC. These timestamps are invented, not vendor evidence.
Citations link from `examples/` to local walkthrough anchors.

`makeFixture(scenario)` returns independent mutable inputs.
`selectAuthorizedContext({identity, evidence, permissionSnapshot, now})` filters them;
`compareMetricContracts(left, right)` checks comparability. `composeAnswer` always performs
fresh selection. Emitted context omits ACLs and cannot authorize a subsequent request:
follow-ups need current raw evidence and permission metadata.

## Resolve a department experience

Import `makeExperienceFixture('finance')` or `makeExperienceFixture('sales')` from
[experience-fixtures.mjs](experience-fixtures.mjs), then pass it to `resolveExperience`.
Finance prioritizes close reports, definitions and Data Explorer; Sales uses a curated
scorecard workspace with Data Explorer unavailable. These differences derive from fixture inputs.

Precedence is organization → team → individual. Earlier locks prevail; arrays replace
whole values. The result includes `effective`, per-setting `provenance`, `conflicts`, and
`experience_config_version`. Unknown modules, unsafe routes, malformed settings and
authorization preferences fail validation. A separate trusted synthetic access projection
removes inaccessible resources/actions; hiding navigation does not authorize anything.
Preview, publication history and restoration remain [product direction](../docs/experience-and-customization.md).

## Inspect a governed query session

[`makeQueryFixture()`](query-fixtures.mjs) supplies source data, policy, context and time.
Construct `createMockQueryExecutor({readFixture})`, then `createQuerySession` with the
executor and trusted `getTrustedContext`, `getPolicy`, and `clock` callbacks (milliseconds
since epoch). These simulate server ownership, not authentication.

Submit `{requestId, templateId: 'credits-by-period', parameters: {period: '2026-09', entity:
'aster-us'}}`. No SQL or client identity field is accepted. Default polls advance
`pending` → `running` → `succeeded`. Call `page({executionId, pageSize: 1})`, then pass its
`nextCursor` with the same page size. `exportRows(executionId)` needs separate current
export permission. Every read rechecks ownership and policy; evidence reuse rechecks freshness.

Results contain column types, currency units, contract metadata and completeness. Complete
empty, partial empty and failed execution remain distinct. Defaults cap results at 100 rows
and pages at 25; export respects the result cap. Server completion does not establish viewing.

`cancel(executionId)` establishes local cancellation, not proof a warehouse stopped. Terminal
states remain terminal; timeout wins completion first observed at its deadline. Polls drive
mock progress and deadline enforcement. Retrying the same request ID reuses its execution;
changed parameters conflict, including after an uncertain start failure. Idempotency is
in-memory and lost on restart. Production needs durable requests and source resource controls.

## Inspect sanitized journeys

`createTelemetryCollector` separates host, server and simulated embed inputs. Its projection
keeps allowlisted parameters and trusted synthetic scope; raw SQL, results, text, titles,
URLs and SDK payloads are not analytics. Embed messages require the configured origin and
sender. Power BI initialization differs from rendering; Looker completion preserves partial,
failed or unknown outcomes. Rerenders remain observable without becoming new initial views.

[Journey fixtures](journey-fixtures.mjs) export `runJourneyReference()` for a separate
three-subject simulation. Its events are not live SDK observations or executions of the
integrated query. `computeJourneyMetrics` deduplicates, orders by event time, applies scope,
window and inactivity rules, and protects small cohorts. Missing coverage is not zero;
native-open is a handoff. See [event definitions and metric limits](../docs/journey-telemetry.md).

The [tests](../tests/) change data, policy, configurations, clocks and event delivery.
They substantiate local reference behavior, not enterprise isolation, model accuracy,
production scale, compliance or connected platforms. See the
[permission design](../docs/intelligence-and-permissions.md) for remaining production work.
