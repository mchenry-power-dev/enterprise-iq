# Product vision

Enterprise IQ™ proposes one workspace for finding analytics, understanding their business meaning, and investigating questions with permitted evidence. The public owner is McHenry Power, with a focus on Enterprise Analytics · Product Engineering · AI Systems. This document describes product direction; the executable release is a reference package, not a front end.

## The employee's tasks

| Workspace area | User task | Useful behavior |
| --- | --- | --- |
| Home | Resume work or begin an investigation | Global search, pinned/frequent reports, recently viewed items, and domain collections. Show useful context rather than invented usage counts or a decorative KPI wall. |
| Analytics Catalog | Find the appropriate report or dashboard | One catalog with business area, source, owner, and status filters. Results explain purpose, ownership, freshness, related metrics, and documentation. Filter sensitive discovery metadata before display. |
| Report workspace | Inspect a report and its meaning | A primary viewing surface with definitions, related documentation, freshness, and lineage available on demand. Use supported authenticated embedding where feasible and a native-open fallback where needed. Existing access and licensing still apply. |
| Knowledge | Understand procedures and definitions | Connect owned, versioned documentation to the relevant report, metric, or data product. Avoid an uncurated second document repository. |
| Ask IQ | Investigate a scoped business question | Return a concise explanation with sources, definitions, period, caveats, and useful next investigations. Open the specific permitted source from a citation; explain incompatible definitions. |
| My Workspace | Save useful starting points | Personal reports, collections, and questions. A saved question or answer does not confer lasting access; authorize every later retrieval. |

Connector administration and governance settings belong in a separate administrative area. Employee navigation follows tasks rather than creating six vendor-specific silos.

## What unification means

Access joins discovery and supported viewing. Context joins definitions, owners, versions, source data, and freshness. The custom LLM-powered intelligence layer is a proposed application responsibility that uses only authorized evidence and checked results. It does not mean a newly trained foundation model.

The workspace preserves native BI, warehouse, lakehouse, and documentation capabilities. Catalog metadata and approved documentation may be indexed; governed structured access and report experiences can stay with their authoritative platforms. The appropriate path depends on entitlement, freshness, and what the source actually supports.

## A complete answer experience

For the [synthetic September revenue investigation](walkthrough.md), a useful answer identifies the aligned period and entity, distinguishes gross from net revenue, shows the supported credit calculation, and provides source references. It explains uncertainty when permitted evidence cannot support a conclusion. Next investigations might inspect credit eligibility or compare definition versions, subject to renewed authorization.

The product direction succeeds when a person can find the correct report, inspect its meaning, and assess an answer's evidence. This release supplies no adoption, productivity, reliability, or savings measurement. Those outcomes require future research and publishable evidence.

## Public authorship

This reference is independently written from the supplied product vision, general engineering patterns, and [official documentation](references.md). Original SVG diagrams represent logical systems, not screenshots of an existing product. Code and fixtures are synthetic. No private implementation, employer material, platform partnership, or certification is asserted.
