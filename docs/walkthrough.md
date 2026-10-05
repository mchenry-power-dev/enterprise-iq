# One question across Finance and Sales

> **Synthetic scenario.** Aster Manufacturing is fictional. The six platform orientations below are local fixture records, not connected integrations or excerpts from real enterprise systems.

**Question:** “Why do Finance and Sales show different September revenue?”

A Finance analyst finds $1,840,000 in a finance report and $2,000,000 in a sales report. Both figures can be correct: Finance reports **net revenue**, while Sales reports **gross revenue**. The investigation needs the definitions, the credits assigned to the period, and current evidence before explaining the difference.

## Employee journey: do the work

**Before:** the employee locates two reports separately, finds each metric definition, checks the close note for period treatment, and seeks refresh evidence. A report title or screenshot alone cannot establish that the figures are comparable.

**Product direction:** the employee opens the Finance landing page, searches authorized reports, and opens the Finance report inside Enterprise IQ using the proposed Power BI organization-embedding adapter. They can use supported filters/pages/slicers and expand the report. Related material stays available on demand without permanently crowding the report.

They open the revenue definition, select the approved credits query in Data Explorer, supply September and the US entity, and inspect the returned table. Progress, cancellation, pagination, column types, USD-cent units, freshness, and completeness remain visible. Viewing a table is a separate action from server completion. An uncertain submission response resumes the existing execution instead of silently creating another query.

Next they consult the close note, ask a scoped IQ question, inspect its evidence, and save the investigation. Definitions, documentation, querying, and IQ are optional steps; an employee may revisit a report or stop after reading a definition. Unsupported documentation or report functions use an authorized native-open handoff. Later activity in that native platform is outside the host's observation.

This journey makes no measured time-savings or adoption claim. The [integrated CLI](../examples/working-experience.mjs) resolves configuration, executes a mock query, projects events, and calls the original [deterministic composer](../examples/evidence-composer.mjs). The [browser demo](demo-guide.md) adds interactive reports, original sample documents, local queries, and saved investigations. No live vendor embed, warehouse, or LLM is connected. Report viewing does not authorize model access to the underlying dataset; query and context checks remain separate.

## Administrator journey: improve the workspace

An authorized administrator opens Usage Analytics and notices repeated observed searches with zero visible results. They inspect aggregate counts, missing-result coverage, and approved category/navigation context, not raw search text or employee rankings. Small groups remain suppressed. A supported follow-up might ask employees about terminology through a separately approved research process.

In Experience Settings they preview a Finance navigation or curated-content change, validate locks and allowed modules, and publish a new version. Preview sessions are excluded from ordinary adoption analysis. Each subsequent event carries its effective experience configuration version. The browser demo restores earlier configurations as new published versions with an inspectable local history. Shared publishing and administrative authorization remain production integration work.

They compare equivalent observation windows and compatible instrumentation: zero-result rate, matched search-to-render latency with sample and missing-outcome counts, and query completion versus results viewed. Optional paths and loopbacks remain visible. An apparent improvement is a descriptive association; seasonality, audience, access, and coverage changes can explain it. Controlled evaluation would be required for a causal claim. See [metric definitions and privacy](journey-telemetry.md) and the [configuration rules](experience-and-customization.md).

## Fix the scope before comparing

All monetary records in this case share this contract:

| Dimension | Synthetic value |
| --- | --- |
| Period | September 1–30, 2026, inclusive |
| Currency | USD |
| Entity | Aster Manufacturing US |
| Grain | Entity-month |
| Filters | `country=US`, `status=posted` |
| Aggregation | `SUM`; calculations use integer cents |
| Definitions | Gross revenue v1; period credits v1; net revenue v2 |
| Provenance | Six fixture IDs below, with explicit credit record IDs |
| Freshness | Completed refresh and validity window in [refresh lineage](#refresh-lineage) |

The definition versions are deliberately different. Their explicit relationship makes the comparison meaningful; matching dates and currency alone does not.

## Six source records

Inspect the original synthetic records in [fixtures.mjs](../examples/fixtures.mjs). Each source link in the reference output points to its corresponding section here, relative to the `examples` directory.

### Finance report

`finance-report` is **Power BI-oriented**. It reports net revenue of **$1,840,000** using `net-revenue` v2 under the shared scope. This is an allowed summary record; permission to view a report would not by itself grant access to its underlying data in a production design.

### Sales report

`sales-report` is **Looker-oriented**. It reports gross revenue of **$2,000,000** using `gross-revenue` v1 under the same scope. Its metric meaning remains distinct from the finance report.

### Credit ledger

`credit-ledger` is **Snowflake-oriented**. Two synthetic records belong to `september-us-posted-credits`: `credit-a` is **$100,000** and `credit-b` is **$60,000**. Their sum is **$160,000**, represented by `period-credits` v1. The amount is calculated from the rows, not inferred from the gap between the reports.

### Revenue definition

`revenue-definition` is **Confluence-oriented**. Definition v2 states the relationship: **net revenue v2 = gross revenue v1 − period credits v1**. It does not redefine the Sales measure or silently rename gross revenue as net.

### Close note

`close-note` is **SharePoint-oriented**. Its `posted-in-period` rule assigns the specified posted US credits to September. Both `creditRecordIds` and `creditSetId` must match the ledger evidence. A different credit set cannot be substituted merely because its amount produces the desired total.

### Refresh lineage

`refresh-lineage` is **Databricks-oriented**. It records a completed refresh at **2026-10-01 06:00 UTC**, with evidence valid until **2026-10-04 00:00 UTC**. The example evaluates at a fixed synthetic time, **2026-10-03 12:00 UTC**, within that window. A completed refresh supports timeliness; it does not independently prove metric definitions or credit treatment.

## Supported explanation

For `finance-analyst`, all six records pass the synthetic authorization check. Permission metadata is valid from **2026-10-03 11:00 to 13:00 UTC**. After scope, definition, credit inclusion and freshness checks, the calculation is:

```text
$2,000,000 gross revenue − $160,000 period credits = $1,840,000 net revenue
```

Finance and Sales therefore use different documented definitions for the same business scope. The allowed evidence supports this reconciliation; it does **not** support blaming a broken pipeline. The answer retains both metric meanings, its scope, refresh reference and the six source links.

## When the conclusion must change

| Changed input | Required reference behavior |
| --- | --- |
| Expired refresh evidence | Withhold the current-period numeric reconciliation until sufficient timely evidence is available. |
| Conflicting definition versions | Preserve the distinct meanings and withhold reconciliation when the relationship is ambiguous. |
| Missing credit evidence | Report insufficient support. Missing credits are not zero. |
| Incomplete permitted context | Narrow or withhold the conclusion without naming or citing denied records. |

### Definition versions

The conflict variation adds `revenue-definition-v3`. Its net revenue v3 subtracts **all issued credits**, including credits outside the close period, while v2 uses the specified posted-in-period credits. The composer preserves both meanings and does not choose whichever definition makes the arithmetic fit. Each definition retains its own version and provenance.

The synthetic `sales-analyst` has less access than `finance-analyst`. Its emitted context and answer cannot identify denied records to explain a gap. Unknown identity or stale permission metadata fails before retrieval. Access revocation also requires a new authorized context: saved questions and earlier answers do not preserve entitlement.

Run the scenarios and tests through the [examples quickstart](../examples/README.md). The [authorized question flow](../diagrams/authorized-question-flow.svg) shows the decision sequence; [intelligence and permissions](intelligence-and-permissions.md) separates these fixture checks from production requirements.
