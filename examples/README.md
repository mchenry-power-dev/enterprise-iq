# Run the synthetic reference examples

From the repository root, using **Node.js 24 or later**:

```sh
node --test
node examples/evidence-composer.mjs
node examples/evidence-composer.mjs stale
node examples/evidence-composer.mjs conflicting-definitions
node examples/evidence-composer.mjs missing-credits
node examples/evidence-composer.mjs restricted
node examples/evidence-composer.mjs revoked
node examples/evidence-composer.mjs malicious
```

These commands use only Node's standard library; no installation, package manager, tenant,
credentials, model, or network is required. This release uses JavaScript ES modules because
Node was available in the authoring environment and Python was unavailable. The examples
are three readable modules plus [original synthetic fixtures](fixtures.mjs), rather than
live adapters or an application.

| Module | Reference behavior |
| --- | --- |
| [authorized-context.mjs](authorized-context.mjs) | Rechecks the synthetic identity registry and source ACL validity on every call, selects permitted evidence, and filters lineage links. |
| [metric-contract.mjs](metric-contract.mjs) | Checks compatible scope and definition versions, verifies period membership/freshness/provenance, and calculates integer-cent amounts using SUM. |
| [evidence-composer.mjs](evidence-composer.mjs) | Builds evidence context, citations, and a deterministic answer from the checked amounts. Source text remains data. |

The CLI prints JSON containing `status`, `answer`, `citations`, `context`, `caveats`, and
`nextInvestigations`. A supported
calculation additionally contains `calculation`. Baseline reconciliation is
**$2,000,000 − $160,000 = $1,840,000**. Changed measured amounts produce a different result;
an unexplained residual produces `unreconciled`, without attributing a pipeline cause.
The stale, conflicting, missing, restricted and revoked scenarios return
`insufficient_support` and omit the calculation. The malicious-text scenario retains the
untrusted text as context data but produces the same checked answer as baseline.

The question is fixed to the [September revenue walkthrough](../docs/walkthrough.md).
Its fictional company is Aster Manufacturing, with the entity `Aster Manufacturing US`;
all three measurements use September 1–30, 2026, USD, `entity-month`, `country=US`,
`status=posted`, and SUM. Metric contracts preserve period, currency, entity, grain,
filters, aggregation, definition ID/version, freshness, and fixture provenance. Direct
comparison requires identical definitions. Reconciliation instead requires the explicit
mapping: net-revenue v2 = gross-revenue v1 − period-credits v1. It does not silently equate
different meanings or choose among competing versions.

The clock is deliberately fixed to `2026-10-03T12:00:00Z` so repeated commands remain
reproducible. Synthetic permission windows run from 11:00 to 13:00 UTC that day. Source
freshness is valid through October 4; the lineage fixture records a completed refresh at
October 1, 06:00 UTC. These are invented scenario timestamps, not synchronization evidence
from any vendor. Citation references are relative links from `examples/` to the matching
synthetic source section in [the walkthrough](../docs/walkthrough.md), not tenant URLs.

For inspection, `makeFixture(scenario)` returns independently mutable input data.
`selectAuthorizedContext({identity, evidence, permissionSnapshot, now})` filters it.
`compareMetricContracts(left, right)` checks direct comparability.
`composeAnswer({identity, evidence, permissionSnapshot, now})` always performs fresh
selection. Emitted context omits ACLs and cannot itself authorize another request. A caller
must supply the current raw evidence and permission metadata for every follow-up.

[Tests](../tests/reference.test.mjs) change identities, ACLs, data, contracts, freshness,
definition versions, and source content. Their assertions cover fail-closed selection,
denied metadata, access revocation, arithmetic, missing evidence, semantic conflict, and
untrusted text. This validates reference behavior; it does not establish enterprise
authentication, row/column policy enforcement, deployed prompt-injection resistance,
model accuracy, scale, compliance, or any of the six platform connections. See the
[permission design](../docs/intelligence-and-permissions.md) for production requirements.
