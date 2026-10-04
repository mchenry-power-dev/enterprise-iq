# Intelligence and permissions

[README](../README.md) · [Architecture](architecture.md) · [Walkthrough](walkthrough.md) · [Run the examples](../examples/README.md)

The product direction is a **custom LLM-powered intelligence layer** over authorized reports, definitions, documentation, and structured results. The delivered answer composer is deterministic and uses synthetic evidence. No foundation-model training, deployed inference, enterprise SSO, or production isolation is established by this reference.

## Authorization belongs outside the model

A model cannot grant access, validate an identity, or make a restricted source safe by omitting its citation. A production service must authenticate the caller and authorize every evidence path before content reaches retrieval output, a model, or the answer composer. A browser role selector can demonstrate synthetic behavior but cannot establish a security boundary. Real restricted documents must never be bundled in a public client.

Report access, semantic/query access, row/column policies, and documentation permissions are separate controls. Each must be preserved for its corresponding operation. Service-account access establishes the service account's reach, not the employee's entitlement. For example, Looker API calls run as the user bound to API credentials, independently of browser login; Microsoft Graph distinguishes delegated access from app-only access. [Looker API authentication](https://docs.cloud.google.com/looker/docs/api-auth), [Microsoft Graph authorization](https://learn.microsoft.com/en-us/graph/auth/auth-concepts).

## Production requirements

These are design requirements for a future integration, not claims that enterprise security exists here:

1. **Authenticate and fail closed.** Unknown identity, missing permission metadata, invalid timestamps, and expired authorization freshness prevent context selection. Determine the effective execution identity for each source.
2. **Filter before disclosure.** Apply authorization to evidence, titles, snippets, search counts, suggestions, citations, and related assets. Do not expose denied source IDs or a list of hidden titles when explaining insufficient support.
3. **Preserve source controls.** Enforce source object permissions and relevant row/column/document restrictions; do not substitute a broad service-account result for end-user access.
4. **Recheck every reuse.** Follow-ups, exports, saved questions/answers, and cached context require a new valid access decision. Bind caches to caller scope, authorization state, source versions, and freshness, and invalidate on revocation.
5. **Define synchronization.** Document how source permissions and group membership changes reach an index, the maximum accepted authorization age, and behavior during synchronization failure. If validity cannot be established, withhold the affected context.
6. **Contain operational disclosure.** Keep denied evidence out of logs, traces, debugging output, shared caches, and errors. Log only the permitted audit data required to investigate decisions.
7. **Treat content as evidence.** Retrieved instructions are untrusted text. They cannot change system policy, request credentials, choose tools, or expand query scope. The reference stores malicious-looking text as data; it does not validate a deployed agent's resistance to prompt injection.
8. **Constrain execution.** Approve read-only templates/tools, validate parameters and scope, and enforce cost, rows, timeout, and completeness limits. Reject truncation and query errors as incomplete evidence. No autonomous writeback is included.
9. **Verify claims.** Compute numerical statements deterministically; retain permitted source links, period, definition versions, and freshness. Explain incompatible definitions and uncertainty. Unavailable or missing evidence is not zero.

Indexing does not make permissions automatically current. Azure AI Search's documented native token-based ACL approaches are preview features and evaluate synchronized permission metadata. Snowflake Cortex Search executes with owner's rights; source-table policies must not be assumed to propagate as each caller's entitlement. These limitations inform the design without committing this reference to either service. [Azure AI Search document access](https://learn.microsoft.com/en-us/azure/search/search-document-level-access-overview), [Cortex Search privilege model](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-overview).

## Preferences, execution, and telemetry

Experience configuration is presentation data. Organization locks, module allowlists, and source visibility constrain personal preferences; they never grant data access, change a source role, or disable backend checks. The local resolver's synthetic access projection is not an identity provider. Production source credentials and trust context cannot originate in a client-supplied role or tenant field.

The mock query session authorizes submission and every later poll, page, and export against fresh synthetic context. Approved templates and strict parameters define its scope; no SQL-prefix regex claims arbitrary SQL is safe. Bind actual source execution to the intended identity, relevant row/column controls, bounded resources, and isolated results before replacing the mock. A saved result cursor is not an entitlement. Partial query rows may support an explicitly partial display, but do not establish a complete reconciliation.

Telemetry is an independently governed, nonessential stream. Project allowlisted event parameters before collection; never copy queries, result rows, filters, questions, answers, source URLs, identities, or SDK error details into routine analytics. Trusted server/adapter context supplies tenant and pseudonymous subject scope in the production design. The reference simulates that boundary. Usage analysis requires aggregate authorization, small-cohort protection, retention/deletion controls, and an explicit purpose; pseudonymous is not anonymous. See [journey telemetry](journey-telemetry.md).

## Evidence-bounded composition

The [authorized question flow](../diagrams/authorized-question-flow.svg) makes policy checks precede selection and composition. In the reference, synthetic permission records control which fixtures can enter context. Contract checks and arithmetic then determine whether the allowed evidence supports the September revenue reconciliation. The output includes source references for permitted supporting evidence; an insufficient result does not enumerate denied sources.

A future model could explain this verified context and propose a permitted next investigation. It would receive neither unrestricted source material nor authority to decide entitlements. Reopening a citation must still pass the destination's access checks.

The [reference tests](../examples/README.md) vary identity, permission age, revocation, source presence, contract dimensions, definitions, freshness, and amounts. They establish local behavior only. Production identity, vendor policy enforcement, six live APIs, deployed model behavior, scale, and regulatory compliance require separate evidence. [Recorded validation and next gates](validation-and-roadmap.md).
