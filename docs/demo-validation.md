# Interactive demo validation

[README](../README.md) · [Demo guide](demo-guide.md) · [Architecture](demo-architecture.md) · [Gallery](product-gallery.md)

This record applies to the browser reference demo, separate from the [historical reference validation](validation-and-roadmap.md). Test fixtures are synthetic. Browser device profiles are emulation, not physical-device verification. Official documentation review on **2026-10-04** is recorded in [References](references.md#interactive-demo-research).

Local release verification executed on **2026-10-05**. The clean rehearsal copied the complete tracked and untracked candidate into an ignored directory, without Git metadata, dependencies, or prior build artifacts. Application, test, reference, lockfile, and build-source hashes matched the working candidate. Browser checks used that rehearsal's production build at `/enterprise-iq/`.

## Execution record

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Runtime | PASS | Node.js 24.18.0; npm 11.16.0; Windows; Playwright 1.63.0. |
| Original reference tests | **117/117 PASS** | Original reference behavior, including authorization and evidence boundaries. |
| Clean dependency installation | PASS | Fresh `npm ci` installed 35 packages from the candidate lockfile. |
| Type check and production build | PASS | `typecheck` and `build`; correct `/enterprise-iq/` static base. |
| Demo unit/integration tests | **44/44 PASS** | 14 domain tests and 30 state/telemetry tests. |
| Production browser suite | **66 PASS; 0 failed; 9 intentionally skipped** | 75 profile cases, completed in 2.3 minutes; details below. |
| Responsive and enlarged text | PASS | 45 route/width combinations and three doubled-text checks. |
| Accessibility review | PASS within tested scope | 20 axe scans with no violations; dialog Escape/focus and semantic chart tables exercised across primary engines. |
| Independent visual review | PASS | All 10 main pages at 1440/390 pixels; enlarged layouts, compact 320-pixel Home/report/query, and all eight gallery captures inspected. |
| Lab performance | MEASURED | Three isolated cold loads; median observed LCP 1.716 seconds; CLS 0. See method below. |
| Documentation rendering | PASS locally | 16 Markdown files, 156 relative links, and 24 tables; 64 page renders at 1000/360 pixels in light/dark; all three original SVGs at those profiles and native size. Zero gate failures; images visually inspected. No disclosures present. The local renderer approximates GitHub; 98 external URLs were not fetched. |
| Public hosted acceptance | **66 PASS; 0 failed; 9 intentionally skipped** | Clean contexts against the public Pages build on 2026-10-05; same browser matrix, including exports, reload, configuration, local analytics, recovery, and phone workflows. |
| Public GitHub rendering | PASS | Actual GitHub rendering of README, gallery, guide, architecture, and validation at 1280/390 pixels in light/dark modes: 20 renders checked; screenshots reviewed for each page, images loaded, and no page-wide overflow. |

On **2026-10-05**, the [live demo](https://mchenry-power-dev.github.io/enterprise-iq/) was verified against [release a909a650](https://github.com/mchenry-power-dev/enterprise-iq/commit/a909a650262c669534e094a7657c1a40eb050d4e) after [CI and Pages deployment succeeded](https://github.com/mchenry-power-dev/enterprise-iq/actions/runs/37328961693). The in-app release marker matched that exact commit. The hosted suite completed in 2.6 minutes. A separate ten-route runtime check observed 12 same-origin requests, no external or localhost requests, and no page errors. Hosted checks repeat the local journey definitions; their counts are not additional distinct journeys.

## Browser coverage and counting

| Profile | Executed functional journeys | Viewport / method |
| --- | --- | --- |
| Chromium desktop | 15/15 PASS | 1440×1000 CSS pixels. |
| Chromium mobile | 15/15 PASS | Playwright Pixel 7 profile, 412×839, touch/mobile emulation. |
| WebKit desktop | 15/15 PASS | 1440×1000 CSS pixels. |
| WebKit mobile | 15/15 PASS | Playwright iPhone 13 profile, 390×664, touch/mobile emulation. |
| Firefox smoke | 3/3 PASS | Desktop profile: Finance filtering/export, Sales analysis/reload, and parameterized Databricks query/export. |

The 63 functional cases repeat the same 15 journey definitions across four primary profiles, plus three selected Firefox journeys. Two dedicated Chromium visual/reflow tests and one mobile measurement make **66 executed cases**. Nine skips prevent those dedicated checks from running again on other profiles; they do not represent missing functional journeys. The separate three-run performance measurement overlaps the suite's measurement and is not counted as three additional product journeys.

The visual sweep covers Home, Reports, Finance Performance, Data Explorer, Knowledge, Ask IQ, My Workspace, Experience Settings, Usage Analytics, and Source Directory. Axe 4.13.0 checks WCAG 2 A/AA, 2.1 AA, and 2.2 AA tagged rules at 1440 and 390 pixels. This is automated coverage plus targeted review, not accessibility certification or a complete assistive-technology audit.

Reflow checks cover Home, Finance Performance, Data Explorer, Settings, and Analytics at 320, 360, 390, 430, 768, 1024, 1366, 1440, and 1600 pixels. The 1366-pixel check uses a 768-pixel viewport height. Three additional 768-pixel checks double computed font sizes on Home, the report, and Settings. Tables may scroll within their own containers; no page-wide horizontal overflow was observed.

The final run includes regressions for malformed saved-state preservation and explicit recovery, invalid query limits rejected by both Save and Run, and unavailable resource routes producing no successful report activity. Earlier diagnostic runs are superseded by this final candidate result and are not added to its totals.

## Mobile lab measurement

Three consecutive cold browser contexts loaded Home with one worker and no concurrent browser tests or documentation renders. The production preview ran on a Windows host using Chromium **153.0.8010.12**, the Pixel 7 profile above, 4× CPU throttling, approximately 1.6 Mbps download / 750 Kbps upload, and 150 ms network latency through Chrome DevTools Protocol.

`PerformanceObserver` recorded largest-contentful-paint and layout-shift entries until the page reached network idle; navigation/resource timing supplied the remaining observations.

| Observation | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| Observed LCP | 1,716 ms | 1,792 ms | 1,692 ms |
| CLS | 0 | 0 | 0 |
| DOM content loaded | 1,226 ms | 1,348 ms | 1,256 ms |
| Subresource transfer, excluding document HTML | 117,753 bytes | 117,753 bytes | 117,753 bytes |

Median LCP was **1.716 seconds**. These observations met the local targets of approximately 2.5 seconds LCP and CLS below 0.1. They describe this synthetic Home load under the declared lab conditions, not production field performance, a Lighthouse score, or a physical phone measurement. Hosted timing remains separate from this local result.

## Reproduce

From the repository root:

```sh
npm --prefix demo ci
npm --prefix demo run test:reference
npm --prefix demo run typecheck
npm --prefix demo test
npm --prefix demo run build
cd demo
npx playwright install chromium firefox webkit
npm run test:e2e
npm run check:docs
```

On Linux CI, use `npx playwright install --with-deps chromium firefox webkit`. The browser suite starts the built preview at `/enterprise-iq/`. Set `EIQ_BASE_URL` to the published URL to run the same tests against the hosted build. Reports, screenshots, and traces are written to ignored `.local/` output, outside the Pages artifact.

For an isolated lab repeat, run `npm run test:e2e -- performance.spec.ts --project=chromium-mobile --workers=1 --repeat-each=3`. Set `EIQ_BASE_URL` when using an already running production preview on a different port. Firefox required elevated process execution in the restricted local Windows environment; its three smoke cases completed successfully.

## Release acceptance inventory

| Journey | Required observations |
| --- | --- |
| First use | Useful Finance Home; report opens; filters update values; Back preserves context. |
| Connected investigation | Finance → definition → credits query → results → close note → guided explanation → saved investigation; September 2026, USD, US entity stays aligned. |
| Alternate sources | Sales report is labeled Looker simulation; Databricks query computes its selected template. |
| Customization | Draft leaves active UI unchanged; preview is distinct; publish changes Home; reload persists; restore creates another version; organization locks remain. |
| Journey analytics | Seeded metrics respond to filters; optional local recording stays separate; stop/delete works; no analytics request leaves the browser. |
| Recovery | Direct links, Back/Forward, reload, unknown resource, empty results, cancelled/partial query, unsaved edits, and blocked storage have honest outcomes. |
| Responsive use | Phone investigation/customization, downloads, keyboard focus, dialog close, readable chart/table access, and no page-wide overflow. |

**Production validation not run:** enterprise SSO, live SDK embeds, warehouse authorization, tenant isolation, revocation propagation, model inference, scale/load, compliance certification, and business outcomes. These are outside this synthetic browser release.
