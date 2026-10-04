# Validation and roadmap

The experience release extends the existing documentation and Node.js standard-library reference package. It preserves the original permission-aware retrieval, metric contracts, and deterministic composer, and adds configuration, governed mock queries, and journey telemetry. No runtime dependencies are required.

## Reproduce the local checks

Run `node --test`, `node examples/working-experience.mjs`, and `node examples/working-experience.mjs --telemetry-disabled` from the repository root. The [example guide](../examples/README.md) also preserves all seven composer scenarios. The integrated output connects executed configuration, mock query results, and separately authorized composition; its host/SDK actions are explicitly simulated. A separate three-subject event fixture demonstrates aggregate calculations and suppression.

The checks establish local behavior only. They do not verify enterprise authentication, source row/column policies, live APIs, model accuracy, deployed prompt-injection resistance, production scale, or regulatory compliance.

## Release verification record

Verification date: **2026-10-03**. Local checks used **Node.js v24.18.0**. The following results were executed rather than inferred from the design.

| Check | Result |
| --- | --- |
| Baseline | **PASS — 42/42** original tests before editing; clean `main` at `2b102da`. |
| Full reference suite | **PASS — 117 tests; 0 failed, skipped, or cancelled**, using `node --test`: 42 original, 15 configuration, 27 query, 25 telemetry, 8 integrated. |
| Executed CLI commands | **PASS** — integrated Finance and telemetry-disabled commands; all seven original composer scenarios. Outputs parse as JSON. Credits derive from rows, and changed rows change the reconciliation. |
| Configuration and query boundaries | **PASS** — locks, unsafe values, access revocation, cross-tenant/subject reuse, bounded pagination/export, idempotent retry, cancel/timeout races, zero/partial/failure distinctions, fresh evidence and authorization. |
| Event and metric boundaries | **PASS** — sensitive-field projection, unknown events, sender/origin spoofing, duplicates/reordering, recurring renders, partial/unknown outcomes, missing terminals, repeated actors, cohort thresholds, windows, and telemetry disabled/unavailable. |
| Markdown and SVG rendering | **PASS** — 12 Markdown files at 900px and 360px in light/dark themes (48 variants), all three original SVGs, and focused visual inspection. No missing images or page overflow; wide supporting tables scroll within the page. Full-resolution diagram links remain visible. |
| Links, anchors, filename case | **PASS** — 98 relative links across 12 Markdown files, including original citation destinations. README main content is approximately 921 words excluding commands. |
| Publication preflight | **PASS** — authenticated account and owner `mchenry-power-dev`, public repository, default branch `main`, upstream baseline unchanged. Publication result will be recorded after push. |
| Public-content review | **PASS** — independently authored prose/code/SVGs and synthetic fixtures; original evidence patterns preserved. No credentials, personal filesystem paths, employer content, caches, temporary renders, new license, or tracking client is included. Staged content is checked before commit. |

Local preview tooling and render images are excluded by `.gitignore`; they are not product screenshots or runtime dependencies. Visual checks use an isolated headless Chrome process and a local Markdown preview approximating GitHub styling. Publication checks distinguish a successful push from actual public rendering. UTF-8 heading markers and a narrow-layout overflow discovered during rendering were corrected.

**NOT RUN:** live platform API/tenant or embed SDK tests, enterprise identity or source row/column enforcement tests, model inference/evaluation, production load/scale testing, real employee/visitor tracking, and compliance assessment. They are outside this reference release; enterprise credentials are not needed to complete it.

## What is delivered

The README is the primary entry point. Supporting documents cover employee/admin journeys, enterprise customization, event contracts and calculations, distinct source paths, permissions, and source-backed capability limits. The updated main SVG and one new feedback-loop SVG complement the preserved authorized-question diagram. Six executable patterns and an integrated CLI derive behavior from synthetic inputs.

Platform labels are target roles only. The package makes no network calls to enterprise systems, deploys no LLM, and creates no application UI. Public reference code does not become confidential because the repository has no license; this release does not grant a license or claim open-source reuse rights.

## A staged integration direction

1. **Prove one identity and one source path.** Define end-user entitlement, revocation behavior, source policy enforcement, supported viewing, and metadata visibility. Validate with a permitted test environment before expanding the catalog.
2. **Establish metric and evidence contracts.** Confirm time, currency, entity, grain, filters, aggregation, definition versions, freshness, and source provenance with accountable owners. Test permission changes and incompatible definitions.
3. **Add governed structured analysis.** Use approved read-only templates with typed parameters, query budgets, row limits, and timeouts. Validate execution identity and source-enforced row/column controls separately from document access.
4. **Evaluate model-assisted composition.** Supply only authorized evidence and deterministic results. Evaluate citation fidelity, uncertainty, unsupported claims, malicious content, and access changes before exposing user workflows.
5. **Build the employee and administration surfaces.** Implement supported viewing, accessible states, typed query tables, and saved investigations. Add persistent configuration preview/publish/history/restore after source access and licensing are established.
6. **Approve intentional measurement.** Implement trusted collection, aggregate access, retention/deletion, disclosure controls, and coverage monitoring. Validate SDK mappings and source-specific execution outcomes. Evaluate version changes descriptively; causal claims require suitable study design. External analytics export requires separate explicit enterprise approval.

These are validation gates, not announced integrations or scheduled commitments. No Kubernetes, vector database, or agent framework is required merely to complete this reference.
