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

## Original public assets

McHenry Power owns the independently authored public architecture, prose, synthetic scenario, reference code, tests, and SVG diagrams in this repository. Vendor documentation informed capability boundaries; no vendor sample code, platform logo, stock image, or employer material was copied into the deliverables. Platform names identify target systems, not partnerships, certifications, endorsements, or connected integrations.

The [synthetic walkthrough](walkthrough.md) and [fixture module](../examples/fixtures.mjs) document the local evidence behind the reference citations. These are scenario references, not tenant URLs. [Validation](validation-and-roadmap.md) records executable and render checks separately from this source review.
