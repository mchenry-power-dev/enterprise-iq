# Try Enterprise IQ

[README](../README.md) · [Architecture](demo-architecture.md) · [Validation](demo-validation.md) · [Gallery](product-gallery.md)

**Interactive reference demo · Sample data · Simulated sources**

The workspace opens with fictional Aster Manufacturing data. Reports, queries, documents, and guided explanations share a fixed sample reporting period. You do not need an account or a source connection. The demo persona changes permitted sample behavior; it is not authentication.

## Investigate September revenue

1. From Finance Home, open **Finance Performance**. September 2026, Aster Manufacturing US, USD, and posted transactions are the default scope. Net revenue is **$1,840,000**.
2. Change **Region** or **Product** and inspect the updated metric, chart, and underlying table. Reset filters to return to the full US sample. Report pages offer different views of the same records.
3. Open **Gross vs. net revenue** for the definition. The definition explains why Sales reports gross revenue while Finance subtracts posted credits. Use the investigation links to continue without losing period/filter context.
4. In **Data Explorer**, select **Credits by reason** and run the approved template. Inspect or sort the typed results, move between pages, and export the permitted result. The complete September sample contains **$160,000** of credits; a capped result is explicitly partial.
5. Read **September close note**, then open **Ask IQ**. Choose the supported gross-versus-net question. The deterministic composer verifies the compatible evidence before explaining **$2,000,000 − $160,000 = $1,840,000**.
6. Open a citation, then **Save investigation**. Find the saved context in **My Workspace** after navigation or refresh.

Use the evidence controls and simulated persona to explore withheld conclusions. Missing, stale, incompatible, or inaccessible evidence is not zero. Unsupported questions receive scope guidance. Ask IQ is labeled **Guided demo · No live LLM**.

## Explore the workspace

**Reports** supports title/description/alias search, source and department filters, favorites, and grid/list discovery. Finance Performance and Sales Performance demonstrate two analytical report styles. Credits & Adjustments, Regional Revenue, and Product Mix use distinct measures or breakdowns. Charts have textual values and underlying tables. Source opening explains the live integration requirement rather than inventing a tenant URL.

**Data Explorer** runs approved local templates through Snowflake and Databricks sample adapters. Query parameters affect the SQL preview and computed result. Changing parameters marks an earlier result stale. Cancellation, row limits, and partial output describe the local session; no query continues in a warehouse after the browser closes.

**Knowledge** contains original Confluence and SharePoint sample prose: definitions, a close note, credits policy, refresh/ownership notes, and department guidance. Documents retain source, owner, version, section anchors, and related resources.

**My Workspace** organizes favorites, saved views, query configurations, investigations, recent resources, and named collections. Browser storage is local to this demo and browser profile. Use the explicit reset confirmation only when you want to remove Enterprise IQ's saved state.

## Customize an experience

Open **Demo administration → Experience Settings**. On a phone, first open the navigation menu. The separate **Demo persona** control demonstrates the sample analyst, restricted viewer, and administrator. Select a configuration scope and edit the workspace title, theme, Home layout, navigation, featured reports, or contextual guidance.

Follow **Save draft → Preview draft → Publish to demo**. Drafting does not apply the change to the live workspace. The preview identifies itself as a preview. After publication, return Home to see the actual change and reload to confirm persistence. **Version history** can restore an earlier version as a new publication.

The effective-value table identifies inherited values and organization locks. Organization → department → personal precedence changes presentation only. A preference cannot grant access or enable unsupported modules, arbitrary HTML, scripts, or external navigation.

## Understand a journey

**Usage Analytics** starts with a populated synthetic event set. Explore outcomes, paths, friction, and configuration versions. Filter the sample and inspect definitions, denominators, missing observations, and small-cohort suppression. A completed query and a viewed result are different observations; a render does not establish understanding.

Select **This browser session** and explicitly start recording to create your own local path. Perform report/query/document actions, return to the path, then stop or delete it. Recording is off by default. Only allowed event metadata stays in this browser; raw searches, questions, SQL, result rows, and full URLs are excluded. Local clicks are never blended with the synthetic enterprise sample. The latest 1,000 events are retained, with an explicit coverage warning if earlier events fall outside that limit.

## Run locally

Use Node.js 24 or later from the repository root:

```sh
npm --prefix demo ci
npm --prefix demo run dev
```

Open the URL printed by Vite, including `/enterprise-iq/`. Use [Validation](demo-validation.md#reproduce) for the build and test commands. Production integration prerequisites remain in the [source adapter matrix](source-adapters.md).
