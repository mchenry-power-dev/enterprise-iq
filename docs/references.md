# References and provenance

[README](../README.md) · [Architecture](architecture.md) · [Adapter matrix](source-adapters.md) · [Permissions](intelligence-and-permissions.md)

The following first-party documentation was opened and reviewed on **2026-10-03**. The verification date records documentation review, not a tenant connection or API test. Linked pages are mutable; recheck deployment, API version, preview status, permissions, and licensing before implementing an adapter. Specific claims are cited beside their use in the supporting documents.

| Official reference | Design constraint inspected | Verified |
| --- | --- | --- |
| [Power BI: embed for your organization](https://learn.microsoft.com/en-us/power-bi/developer/embedded/embed-sample-for-your-organization) | User sign-in, authorized report access, and licensing prerequisites. | 2026-10-03 |
| [Power BI: Get Reports In Group](https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-reports-in-group) | Workspace report enumeration and API scopes. | 2026-10-03 |
| [Power BI: Execute Queries](https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/execute-queries) | Separate read/build permissions, tenant setting, result limits, and service-principal RLS/SSO restrictions. | 2026-10-03 |
| [Looker: private embedding](https://cloud.google.com/looker/docs/private-embedding) | Authenticated embedded Looks, Explores, and dashboards. | 2026-10-03 |
| [Looker: API overview](https://docs.cloud.google.com/looker/docs/api-overview) | Programmatic content/query capabilities to evaluate separately from embedding. | 2026-10-03 |
| [Looker: API authentication](https://docs.cloud.google.com/looker/docs/api-auth) | Credential-bound execution identity; API and browser login are distinct. | 2026-10-03 |
| [Snowflake: SQL API](https://docs.snowflake.com/en/developer-guide/sql-api/index) | Submission, status, and cancellation; read-only constraints belong to this proposed application design. | 2026-10-03 |
| [Snowflake: SQL API reference](https://docs.snowflake.com/en/developer-guide/sql-api/reference) | Execution role, bound parameters, and timeout fields. | 2026-10-03 |
| [Snowflake: row access policies](https://docs.snowflake.com/en/user-guide/security-row-intro) | Row-policy behavior and Enterprise Edition or higher requirement. | 2026-10-03 |
| [Snowflake: Cortex Search overview](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-overview) | Owner's-rights search and service access; no automatic per-reader source-policy assumption. | 2026-10-03 |
| [Databricks: Unity Catalog](https://docs.databricks.com/aws/en/data-governance/unity-catalog/) | Governed objects, privileges, and lineage responsibilities. AWS documentation scope. | 2026-10-03 |
| [Databricks: SQL Statement Execution](https://docs.databricks.com/aws/en/dev-tools/sql-execution-tutorial) | Authentication, warehouse/object permissions, parameters, and result/timeout behavior. | 2026-10-03 |
| [Databricks: lineage in Unity Catalog](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage) | Lineage visibility, capture requirements, and coverage limits. | 2026-10-03 |
| [Confluence Cloud: REST API v2 introduction](https://developer.atlassian.com/cloud/confluence/rest/v2/intro/) | Authentication/authorization model and cursor pagination. | 2026-10-03 |
| [Confluence Cloud: page API](https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/#api-pages-id-get) | Page/space permissions, read scope, and version retrieval. | 2026-10-03 |
| [Microsoft Graph: overview](https://learn.microsoft.com/en-us/graph/overview) | Microsoft 365 API surface, including SharePoint. | 2026-10-03 |
| [Microsoft Graph: SharePoint resources](https://learn.microsoft.com/en-us/graph/api/resources/sharepoint?view=graph-rest-1.0) | Sites, lists, and drives/document libraries. | 2026-10-03 |
| [Microsoft Graph: authentication and authorization](https://learn.microsoft.com/en-us/graph/auth/auth-concepts) | Delegated access versus application identity and permission grants. | 2026-10-03 |
| [Azure AI Search: document-level access](https://learn.microsoft.com/en-us/azure/search/search-document-level-access-overview) | Security filters versus preview native ACL approaches; synchronized permissions and revocation limits. | 2026-10-03 |
| [GitHub: repository READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes) | Relative links/images and rendered heading anchors. | 2026-10-03 |

## Experience release research

The following additional first-party pages were opened and reviewed for this enhancement on **2026-10-03**. The adapter matrix records the resulting qualifications. These sources establish vendor mechanisms; **live tenant verification was NOT RUN**.

| Official reference | Boundary / deployment assumption | Verified |
| --- | --- | --- |
| [Power BI secure portal embedding](https://learn.microsoft.com/en-us/power-bi/collaborate-share/service-embed-secure) | Simple secure iframe differs from SDK organization embedding; automatic authentication is not SDK-compatible. | 2026-10-03 |
| [Power BI report settings](https://learn.microsoft.com/en-us/javascript/api/overview/powerbi/configure-report-settings) | Supported panes, layout, and settings; no unrestricted report styling promise. | 2026-10-03 |
| [Power BI filters](https://learn.microsoft.com/en-us/javascript/api/overview/powerbi/control-report-filters) | Report/page/visual filter operations; not an authorization boundary. | 2026-10-03 |
| [Power BI slicers](https://learn.microsoft.com/en-us/javascript/api/overview/powerbi/control-report-slicers) | Hierarchy slicer SDK 2.21 prerequisite; tuple slicers unsupported. | 2026-10-03 |
| [Power BI page navigation](https://learn.microsoft.com/en-us/javascript/api/overview/powerbi/page-navigation) | Supported embedded page APIs. | 2026-10-03 |
| [Power BI events](https://learn.microsoft.com/en-us/javascript/api/overview/powerbi/handle-events) | Initialization versus repeated render; error semantics; dataSelected coverage limits. | 2026-10-03 |
| [Looker signed embedding](https://docs.cloud.google.com/looker/docs/signed-embedding) | Google Cloud core Embed edition; Looker original enablement; scoped identity and signing prerequisites. | 2026-10-03 |
| [Looker Embed SDK](https://docs.cloud.google.com/looker/docs/embed-sdk-intro) | SDK 2 communication/navigation; distinct from server API; event order not guaranteed. | 2026-10-03 |
| [Looker embedded events](https://docs.cloud.google.com/looker/docs/embedded-javascript-events) | Dashboard run/filter semantics, partial failures, origin/sender validation. | 2026-10-03 |
| [Snowflake SQL API introduction](https://docs.snowflake.com/en/developer-guide/sql-api/intro) | Supports writes as well as reads; results partitioned; not a read-only security layer. | 2026-10-03 |
| [Snowflake SQL API authentication](https://docs.snowflake.com/en/developer-guide/sql-api/authenticating) | OAuth/key-pair execution identity; credentials remain server responsibilities. | 2026-10-03 |
| [Graph sitePage retrieval](https://learn.microsoft.com/en-us/graph/api/sitepage-get?view=graph-rest-1.0) | SharePoint Online, Graph v1.0, documented permissions and canvasLayout expansion; no complete native-page fidelity guarantee. | 2026-10-03 |
| [GA4 events](https://support.google.com/analytics/answer/9322688?hl=en) | Named interactions and event parameters inspire a local enterprise-owned contract. | 2026-10-03 |
| [GA4 key events](https://support.google.com/analytics/answer/9267568?hl=en) | Meaningful outcomes require declared interpretation; no tag/property created. | 2026-10-03 |
| [GA4 funnel exploration](https://support.google.com/analytics/answer/9327974?hl=en) | Funnel definitions and sequencing; local journey modeling also preserves loopbacks/optional paths. | 2026-10-03 |
| [GA4 single-page applications](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications) | Future optional virtual pageviews require duplicate avoidance. No export implemented. | 2026-10-03 |
| [Google Analytics PII restrictions](https://support.google.com/analytics/answer/6366371?hl=en) | Future export needs explicit enterprise approval and safe fields; pseudonymous remains sensitive. | 2026-10-03 |
| [Browser same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) | Cross-origin frame inspection is constrained; supported messaging must validate sender/origin. | 2026-10-03 |

**Unresolved:** exact tenant license/edition combinations, enabled source features, identity delegation, source policy tests, API/resource budgets, document fidelity, SDK version compatibility, and privacy/retention approval. Recheck these in a permitted deployment; documentation review cannot resolve them. The source matrix distinguishes local simulation from integration and lists fallback behavior.

## Interactive demo research

The following documentation was opened and reviewed for `ENTERPRISE-IQ-DEMO-03` on **2026-10-04**. This is a documentation review, not live tenant verification. The browser demo uses original local simulations; no vendor SDK is bundled and no enterprise API is called.

| Official reference | Constraint retained in the demo and intended adapter boundary | Reviewed |
| --- | --- | --- |
| [Power BI organization embedding](https://learn.microsoft.com/en-us/power-bi/developer/embedded/embed-sample-for-your-organization) | Real organization embedding requires user sign-in, content access, and applicable licensing. The sample report does not establish any of these. | 2026-10-04 |
| [Power BI JavaScript events](https://learn.microsoft.com/en-us/javascript/api/overview/powerbi/handle-events) | Initialization and rendering differ; renders can recur after interactions. Errors describe operations, and selection coverage is limited. | 2026-10-04 |
| [Looker private embedding](https://docs.cloud.google.com/looker/docs/private-embedding) | Private embedded content requires authentication. Original local charts are not authenticated Looker embeds. | 2026-10-04 |
| [Looker embedded events](https://docs.cloud.google.com/looker/docs/embedded-javascript-events) | Dashboard completion can occur when tiles fail. Supported messages need sender/origin validation and conservative interpretation. | 2026-10-04 |
| [Snowflake SQL API](https://docs.snowflake.com/en/developer-guide/sql-api/intro) | Supports submission, polling, cancellation, and partitioned results, including write statements. Approved local templates do not establish warehouse security. | 2026-10-04 |
| [Databricks Statement Execution](https://docs.databricks.com/aws/en/dev-tools/sql-execution-tutorial) | Warehouse/object access, timeout policy, cancellation, and result chunks require explicit adapter handling. The demo executes only fixtures. | 2026-10-04 |
| [Confluence REST API v2](https://developer.atlassian.com/cloud/confluence/rest/v2/intro/) | Authentication, authorization, and cursor pagination remain production adapter responsibilities. Sample documents are original prose. | 2026-10-04 |
| [Graph sitePage retrieval](https://learn.microsoft.com/en-us/graph/api/sitepage-get?view=graph-rest-1.0) | Authorized page retrieval and optional canvas layout expansion are distinct from complete SharePoint page fidelity. | 2026-10-04 |
| [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) | Static hosting publishes the built browser application; no application server or warehouse execution is provided. | 2026-10-04 |
| [Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) | Separate artifact creation from a gated deployment job with Pages and identity-token permissions. | 2026-10-04 |
| [Playwright browsers](https://playwright.dev/docs/browsers) | Chromium, Firefox, and WebKit require compatible installed binaries; an unexecuted engine is not a pass. | 2026-10-04 |
| [Playwright emulation](https://playwright.dev/docs/emulation) | Viewport, touch, and device emulation exercise browser profiles, not physical hardware. | 2026-10-04 |
| [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Inspect 320 CSS-pixel reflow and text enlargement; contain necessary two-dimensional tables without page-wide overflow. | 2026-10-04 |
| [WCAG target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Minimum target sizing has explicit exceptions; the demo aims for comfortable approximately 44-pixel controls. No certification is claimed. | 2026-10-04 |

## Original public assets

McHenry Power owns the independently authored public architecture, prose, synthetic scenario, reference code, tests, and SVG diagrams in this repository. Vendor documentation informed capability boundaries; no vendor sample code, platform logo, stock image, or employer material was copied into the deliverables. Platform names identify target systems, not partnerships, certifications, endorsements, or connected integrations.

The [synthetic walkthrough](walkthrough.md) and [fixture module](../examples/fixtures.mjs) document the local evidence behind the reference citations. These are scenario references, not tenant URLs. [Validation](validation-and-roadmap.md) records executable and render checks separately from this source review.
