# Browser demo architecture

[README](../README.md) · [Guide](demo-guide.md) · [Validation](demo-validation.md) · [Reference architecture](architecture.md)

Enterprise IQ is a static React/TypeScript application built with Vite. The browser executes original public fixtures and reference logic. Power BI, Looker, Snowflake, Databricks, Confluence, and SharePoint identify **simulated adapter roles**, not connected services. No enterprise credentials, model provider, external analytics collector, server session, or database is required.

## Data and evidence

The [fixture records](../demo/src/domain/data.mjs) use integer USD cents and a fixed sample clock. Four months, four US regions, three product groups, and posted credit reasons support time comparisons, filters, pagination, and drill-down. Reports, queries, and answers derive their values from this shared record set.

The [catalog](../demo/src/domain/catalog.mjs) supplies report definitions, original sample documents, approved query templates, source metadata, aliases, and synthetic visibility decisions. A persona change alters permitted presentation and evidence. All bundled records remain publicly inspectable client assets: this does not provide enterprise isolation.

The browser reuses the repository's deterministic evidence composer, metric-contract checks, governed query-session contract, locked configuration resolver, and sanitized event calculations. Browser-compatible logic is separate from Node CLI/file operations; the existing standard-library examples and tests remain independently runnable. The browser has no arbitrary SQL editor and makes no inference call.

September 2026, USD, Aster Manufacturing US, entity-month grain, posted transactions, aggregation, definition versions, freshness, and provenance must align before a numerical explanation is issued. Scoped reports, credits, and close membership use the same selected records. Missing or inaccessible evidence narrows or withholds the conclusion. Reading, viewing a result, exporting, and composing context are separate synthetic checks.

## State and configuration

The [state model](../demo/src/state/model.mjs) uses the application-specific key `enterprise-iq:demo:v2`, with an explicit `v1` migration. Favorites, collections, saved contexts, recent resources, UI choices, and published/draft configurations stay in browser-local storage. The storage adapter handles denied writes and quota failure with a visible session-only fallback and detects changed revisions or a reset in another tab. Unreadable or newer stored data stays intact until the visitor chooses recovery or reset. Reset removes only Enterprise IQ-owned keys after confirmation; it never clears origin-wide storage or unrelated applications.

Configuration resolves organization, workspace, and personal layers through the existing [locked resolver](../examples/experience-configuration.mjs). The active layer and draft are distinct. Preview resolves the draft without publishing. Publication stores a versioned layer; restoring an earlier version creates another version. The configuration cannot alter entitlements. Unsafe routes, unsupported fields, and invalid values are rejected.

## Events and privacy

Usage Analytics computes seeded observations through the existing [journey contract](journey-telemetry.md). Small cohorts and incomplete observations remain visible as limitations. The optional local recorder starts only through explicit user action, stays separate from sample metrics, and can be stopped/deleted. It retains normalized allowlisted metadata, not raw search/query/question text, result data, source payloads, or full URLs. The latest 1,000 local events are retained; earlier events count toward an explicit incomplete-coverage notice and export metadata. No telemetry is sent to a service.

Initial report delivery differs from rerendering; query completion differs from results viewed; native handoff ends observation. Configuration versions provide descriptive cohort context. Before/after differences do not prove causality, employee productivity, or business value.

## Delivery and assets

The Vite base is `/enterprise-iq/`. Hash routes preserve direct links and refresh behavior on GitHub Pages without a server rewrite or origin-wide fallback. The release identifier is injected from the build commit. [The workflow](../.github/workflows/pages.yml) runs reference tests, demo tests, type checking, production build, browser acceptance, and documentation link/render checks before the deployment job. The Pages artifact contains only `demo/dist`; validation captures stay in a separate check artifact.

UI charts, layout, prose, and synthetic data are original. The application uses system fonts and the project-local Lucide icon package; vendor names are displayed as labeled source badges. [Dependency notices](../demo/public/third-party-notices.txt) accompany the deployed application. Gallery images are captures of the running application, not generated interface mockups.

Live adapters would still require source-enforced identity/policy, delegated access design, revocation handling, SDK and tenant validation, licensing review, model evaluation if introduced, and privacy approval before real telemetry. [Official references](references.md#interactive-demo-research) were reviewed on 2026-10-04; [Validation](demo-validation.md) records executed checks separately.
