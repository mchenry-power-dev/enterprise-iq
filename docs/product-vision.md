# Product vision

[README](../README.md) · [Walkthrough](walkthrough.md) · [Customization](experience-and-customization.md) · [Journey analytics](journey-telemetry.md)

**One workspace to view reports, query data, and understand the business.** Enterprise IQ™ proposes a customizable working experience with intentional journey measurement. This document describes product direction. The [interactive reference demo](demo-guide.md) implements a bounded synthetic version; [demo validation](demo-validation.md) records its release status. McHenry Power independently authors this public reference.

## Employee navigation

| Area | Task and useful behavior |
| --- | --- |
| Home | Resume an investigation, open a department landing page, or search authorized assets. |
| Reports | Discover and interact with supported embedded reports, including their permitted filters, pages, and source functions. |
| Data Explorer | Select a governed dataset/query template, enter validated parameters, run, and inspect a typed table or permitted chart. |
| Knowledge | Read authorized definitions and documentation with source, version, owner, and freshness. |
| Ask IQ | Ask a scoped question using separately authorized documentation and query evidence. Inspect citations and uncertainty. |
| My Workspace | Save favorites, approved layouts, and investigation references. Reauthorize every later opening. |

Enterprises can rename/reorder approved modules without changing access. **Experience Settings** and **Usage Analytics** are separate administrative areas, not ordinary employee defaults. Connector governance also stays in administration.

## Report workspace

Search opens the selected permitted report inside Enterprise IQ when its adapter supports the task. Keep the report's interactive area primary. Definitions, documentation, freshness, ownership, and Ask IQ open on demand in dismissible panels; expand/fullscreen preserves working space. Keyboard navigation, visible focus, accessible names, and return focus after closing panels are requirements. Source content accessibility must be assessed separately.

| State | Proposed response |
| --- | --- |
| Loading | Show progress and a cancellable navigation route; initialization is distinct from rendering. |
| Denied | Explain access is unavailable without exposing hidden asset metadata. |
| Expired session | Request renewed authentication, then recheck access before restoring a view. |
| Unavailable | Show a safe failure category and deliberate retry; preserve the investigation reference. |
| Unsupported task | Offer an authorized native-open handoff and declare the observation boundary. |

The host shell's branding and panels are separate from vendor-supported report customization. Filters are convenience controls, not row-level authorization. The [adapter matrix](source-adapters.md) qualifies supported report interactions, SDK events, permissions, and licensing. Do not imply the complete Power BI Service or Looker administration surface is embedded.

## Data Explorer

The first product workflow uses allowlisted templates, not arbitrary SQL. A policy-controlled SQL editor for advanced users is future work. Show pending/running progress, cancellation, typed columns, units, freshness, pagination, and explicit complete/partial/truncated states. Export and chart actions depend on fresh policy checks. An empty complete result is different from missing or incomplete evidence.

Retain an execution identifier across retries so a lost response cannot silently create another expensive job. A cancellation request can race completion; display the confirmed state. Server completion and browser viewing are distinct outcomes. The [mock query pattern](../examples/governed-query.mjs) implements a bounded local state machine, not SQL compatibility or production source enforcement.

## Knowledge and Ask IQ

Retrieve permitted documents and render supported sanitized content with original source/version links. Open unsupported macros, web parts, and editing tasks in the native source. An embedded report does not give the LLM its dataset. Separately authorize, minimize, and validate any query result or document supplied to the proposed custom LLM application. Shared context does not imply universal data replication.

The deterministic [composer](../examples/evidence-composer.mjs) checks the Finance/Sales arithmetic and context boundaries. It neither trains nor invokes a model. Source identity, object/row/column permissions, caller-scoped caches, and fresh access checks remain requirements of a production integration. A hidden menu or client role switch is not a security boundary.

## Enterprise product ownership

**Use, customize, improve:** department landing pages and approved tools shape the task; permitted personal preferences refine it; aggregate observed journeys inform later versions. The browser demo implements local preview, publish, version history, and restoration alongside the reference resolver and validator. Shared administrative services and enterprise approval workflows remain future integration work.

The browser demo's Usage Analytics has Overview, Journeys, Friction, and Experience Changes views. Its default shows a few core outcomes, top friction, and coverage notes; advanced breakdowns are optional. Analyze the experience, not employee productivity rankings. Session time and model responses do not establish successful work. Fragmented sites can also be measured; the proposed benefit is a shared experience and intentional measurement architecture with declared blind spots.

Original diagrams represent logical responsibilities. The [product gallery](product-gallery.md) shows the actual synthetic browser demo. No employer implementation, connected source integration, partnership, certification, or adoption result is asserted. [Evidence and release status](validation-and-roadmap.md).
