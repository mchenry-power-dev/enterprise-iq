# Product gallery

[README](../README.md) · [Demo guide](demo-guide.md) · [Architecture](demo-architecture.md) · [Validation](demo-validation.md)

**Interactive reference demo · Sample data · Simulated sources**

These eight captures were taken from the verified local production build on **2026-10-05** in Chromium 153, using a 1440-pixel desktop viewport and a 390-pixel phone viewport. The phone capture is browser emulation. Every image was visually inspected. Select an image to inspect the full-resolution file. Captures show synthetic Aster Manufacturing records; they are not vendor embeds or generated interface pictures.

## Employee Home

Search, meaningful report previews, and the central revenue investigation share a task-oriented workspace.

[![Finance Home with report previews, a revenue investigation entry, and links to definitions and saved work](images/demo/home.png)](images/demo/home.png)

## Interactive report

Finance Performance combines a shared reporting scope, computed measures, selectable regional bars, a four-month trend, and on-demand context.

[![Finance Performance showing September net revenue of 1.84 million dollars, gross revenue of 2 million dollars, and region and trend charts](images/demo/report.png)](images/demo/report.png)

## Governed query results

An approved reconciliation template computes typed rows from the same public fixture records. Viewing results is a separate action from completing execution.

[![Data Explorer with the Snowflake sample adapter, reconciliation parameters, and the computed regional and product result table](images/demo/data-explorer-results.png)](images/demo/data-explorer-results.png)

## Guided explanation

Ask IQ reconciles permitted evidence and opens its cited sample sources. It is a deterministic guided experience with no live LLM.

[![Ask IQ explaining gross revenue less posted credits equals net revenue, with the reporting context and clickable evidence citations](images/demo/ask-iq-answer.png)](images/demo/ask-iq-answer.png)

## Experience Settings and draft preview

Settings expose workspace scopes, approved presets, featured content, provenance, and locks. The second capture is the actual preview region after saving a local draft; it does not show a published change.

[![Experience Settings showing the Finance configuration scope, workspace title and appearance settings, and featured reports](images/demo/experience-settings.png)](images/demo/experience-settings.png)

[![Draft preview labeled not published, with the Finance close workspace title, navigation, and featured report cards](images/demo/experience-preview.png)](images/demo/experience-preview.png)

## Journey analytics

The journey view calculates its funnel from synthetic events and retains optional paths. It does not infer employee productivity or causal improvement.

[![Usage Analytics showing a configurable event funnel and connected synthetic journey paths with configuration-version context](images/demo/usage-journeys.png)](images/demo/usage-journeys.png)

## Phone report

The report reflows into stacked charts and touch-friendly filters. Wide underlying tables scroll within their own surface.

[![Finance Performance at a 390-pixel phone viewport with stacked filters, revenue measures, regional bars, and a monthly trend](images/demo/mobile-report.png)](images/demo/mobile-report.png)

To reproduce, build the app and start its production preview on port 4173. In another terminal, run `cd demo` and then `node e2e/capture-gallery.mjs`. Set `EIQ_BASE_URL` to use another verified build. The [validation record](demo-validation.md) identifies executed browser checks and release limits.
