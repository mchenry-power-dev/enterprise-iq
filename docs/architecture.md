# Architecture

[README](../README.md) · [Walkthrough](walkthrough.md) · [Permissions](intelligence-and-permissions.md) · [Adapter matrix](source-adapters.md)

Enterprise IQ proposes one workspace for interacting with reports, querying governed data, consulting documentation, and asking a source-linked question. Enterprises configure that experience and use declared journey evidence to improve it. Source platforms keep their reports, data, and permissions. This repository implements small synthetic reference examples and an [interactive browser workspace](demo-architecture.md). Live adapters, enterprise identity, and LLM integration remain product direction.

## Three paths with different responsibilities

The [main system diagram](../diagrams/enterprise-workspace.svg) separates viewing, context retrieval, and structured analysis. An embedded chart is a viewing surface: its pixels do not become evidence or grant access to underlying data.

**A. Discovery and viewing:** user identity → authorized catalog/search → report workspace → supported authenticated embed or native deep link. Catalog results include permitted purpose, owner, freshness, and related definitions. Sensitive titles, snippets, and result counts require authorization too. Power BI's organization embedding requires users to sign in and retains access and licensing prerequisites; Looker supports private authenticated embedding. These are vendor capabilities to evaluate, not implemented connections. [Power BI embedding](https://learn.microsoft.com/en-us/power-bi/developer/embedded/embed-sample-for-your-organization), [Looker private embedding](https://cloud.google.com/looker/docs/private-embedding).

**B. Documentation and context retrieval:** source adapters → approved content/metadata with permissions and versions → permission-filtered retrieval → selected evidence. A proposed index holds only approved catalog metadata and documentation, including source references and authorization freshness. Permission checks precede retrieval output, snippets, citations, and context assembly. Native document access and retrieval authorization remain distinct responsibilities; indexed permissions need an explicit synchronization policy. [Azure AI Search access-control overview](https://learn.microsoft.com/en-us/azure/search/search-document-level-access-overview).

**C. Structured analysis:** Data Explorer or an approved question tool → allowlisted query template → validated parameters and trusted execution policy → source-enforced access → bounded typed results with provenance. Snowflake SQL API and Databricks Statement Execution are query interfaces, not full-workspace iframes. The plan fixes data products, role/warehouse, row and cost budgets, and timeout. Polling, cancellation, result partitions, and repeat-request behavior need source-specific adapters. Tables/chart inputs go to the employee; only separately authorized and complete evidence reaches the composer. Power BI semantic queries also require separate read/build permissions. [Power BI Execute Queries](https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/execute-queries), [query adapter boundaries](source-adapters.md#query-execution).

## Configuration and feedback paths

The experience resolver applies organization → team → individual settings with locks, validation, and value provenance. Its output selects presentation and approved tools; authorization is a separate trusted input and must be freshly enforced by every backend operation. Changing a menu cannot grant a report or query. The [configuration reference](experience-and-customization.md) demonstrates two synthetic departments.

The proposed measurement path is **host actions + supported embed events + server outcomes → validation/privacy projection → tenant-scoped collection → modeled journeys → authorized aggregate analysis → prioritized UX changes → versioned experience updates**. Security audits, query history, business results, and product analytics remain separately protected; opaque correlations can connect authorized investigations without copying sensitive payloads. Disabled or unavailable nonessential analytics must not block permitted work. See [event contract, coverage, and metrics](journey-telemetry.md).

A cross-origin host cannot inspect all iframe activity. The adapter projects only supported events and checks message origin and sender; no raw SDK payload enters analytics. Unsupported observation is unknown, not zero usage. [Browser same-origin boundary](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy).

## Evidence and metric contract

The proposed intelligence layer receives the smallest permitted evidence set needed for the scoped question. Each numerical claim keeps its contract and provenance alongside its value:

| Dimension | Required meaning |
| --- | --- |
| Period | Start/end, accounting period, and relevant timezone or close convention. |
| Currency and unit | Currency code, amount scale, and any approved conversion basis. |
| Entity | The same business entity or explicit permitted entity selection. |
| Grain | The observation level, such as entity-month; aggregation must not duplicate finer rows. |
| Filters | Explicit inclusion/exclusion rules and parameter values. |
| Aggregation | Sum, distinct count, average, or another approved operation. |
| Definition and version | Metric identity, formula, and effective definition version. |
| Freshness | Source observation/refresh time, completion status, and question-specific acceptable age. |
| Provenance | Permitted source ID/link, source version, retrieval time, and query/result reference where applicable. |

Gross and net revenue are distinct metrics. Compare their accounting scope first, then reconcile through an explicit versioned definition and permitted credit evidence. Equal names or amounts do not establish semantic compatibility. Missing evidence remains unknown; it never becomes zero. The [walkthrough](walkthrough.md) demonstrates these decisions, and the [examples](../examples/README.md) implement a bounded synthetic contract.

## Decisions and their costs

| Tradeoff | Proposed decision | Consequence to inspect |
| --- | --- | --- |
| Federated access vs. indexed copies | Keep structured queries at sources; index approved metadata/docs selectively. | Less duplication, but source availability and index synchronization affect answers. |
| Broad discovery vs. metadata leakage | Authorize before emitting titles, snippets, facets, counts, or links. | Discovery may be narrower; hidden assets are not listed to explain a gap. |
| Fast caches vs. freshness/revocation | Cache with caller scope, source version, authorization expiry, and data freshness; recheck before reuse. | Cache hits cannot bypass new access decisions; invalidation costs remain. |
| Flexible questions vs. incompatible definitions | Resolve metric versions and accounting dimensions before calculating. | Some questions need clarification or separate conclusions. |
| Model-generated queries vs. reviewable plans | Accept only approved read-only templates/tools and validated parameters. | Reduced flexibility buys an inspectable execution boundary. |
| One workspace vs. native capabilities | Embed only supported experiences; retain a native-open route. | Vendor login, licenses, and specialized interactions still matter. |

## Small reference, replaceable production components

The executable stack is Node.js with standard-library modules and the built-in test runner. Synthetic fixtures model evidence selection, contract comparison, deterministic composition, configuration resolution, mock query sessions, and journey telemetry. The integrated CLI connects these examples. The [browser application](demo-architecture.md) now reuses these patterns in a React/TypeScript demo. Source APIs, model inference, and a tracking endpoint are not connected; [demo validation](demo-validation.md) records browser and publication checks.

A future implementation needs logical responsibilities for identity/policy, catalog and retrieval, approved query execution, and answer composition. Storage, search engine, hosting, and model provider should follow source requirements and validated workload needs. This reference does not select an infrastructure platform or imply a scale-tested deployment. See [validation and roadmap](validation-and-roadmap.md) for delivered checks and integration gates.
