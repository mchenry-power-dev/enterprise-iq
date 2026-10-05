# Understand the journey, improve the experience

**Product direction:** an authorized Usage Analytics workspace helps an enterprise improve discovery, report use, query results, and supporting guidance. **Implemented:** an enterprise-owned event contract, simulated SDK mappings, privacy projection, and calculations over synthetic local events. There is no tag, collector endpoint, analytics property, live SDK, or outbound visitor tracking. The [interactive browser demo](demo-guide.md) adds optional browser-local recording, separate from seeded fictional journeys, with stop/delete controls and a visible 1,000-event retention boundary.

The intended loop is host actions + supported embed events + server outcomes → validation and privacy projection → tenant-scoped collection → modeled journeys → authorized aggregate analysis → prioritized UX changes → [versioned experience configuration](experience-and-customization.md). Product analytics, security audit records, source query history, and business data remain separate. An opaque correlation ID may connect separately protected records; sensitive payloads do not move into analytics.

## Contract and trust boundary

[The executable contract](../examples/journey-telemetry.mjs) uses schema version `1`. Every event carries `event_id`, `event_name`, `schema_version`, UTC `occurred_at` and `received_at`, `tenant_id`, `workspace_id`, pseudonymous `subject_id`, `session_id`, `journey_id`, `view_instance_id`, `source_system`, opaque `resource_ref`, `action_origin`, `experience_config_version`, `purpose`, a derived `outcome`, and allowlisted `parameters`. `duration_ms` is optional and bounded to one day; `search_id`, `query_id`, and `question_id` are optional opaque correlations. Searches and queries need their respective correlations to enter matching metrics.

Production scope must be assigned by an authenticated, authorized server context and a bound adapter, including safe resource aliases and a pseudonym issuer. The reference's `synthetic_trust: true` marker **simulates that caller boundary; it is not authentication**. A browser-provided tenant, subject, configuration version, resource, or action-origin claim is discarded. Opaque tokens have a bounded syntax, but the trusted issuer must still ensure they encode no names or business content. Dataset/model access requires separate authorization: an embedded report event grants no access to its underlying data.

Parameters permit only bounded counts, booleans, or closed vocabularies. Unknown fields are discarded; malformed required fields, unsupported schema/events, invalid timestamps, and channel mismatches reject with a generic status. Raw SDK payloads, names, emails, search text, SQL, results, filters, URLs, titles, questions, answers, and error details are never copied. Unknown tile counts stay absent. Pseudonymous data remains sensitive.

`host`, `server`, and `embed` are separate collector entry points. The browser demo also uses an explicit `sampleEmbed` entry for original React-chart observations; these are not mapped vendor SDK messages. Simulated message admission checks both the exact configured HTTPS origin and the bound sender object representing the iframe Window. Origin matching alone is insufficient. The Power BI wrapper is an original simulation of an SDK callback, not a claim about Power BI's private wire protocol. A production implementation should use its supported SDK and validate any direct message bridge. No cross-origin inspection is attempted.

Policy can disable telemetry globally or per trusted context. Emission then returns `disabled` without storage. Collector clock failure returns `unavailable` with no internal error detail; permitted work can proceed. These examples do not implement a durable queue, production identity, analytics role enforcement, or deletion service.

## Taxonomy and coverage

These are **Enterprise IQ event names**, not universal vendor event names. Each row inherits the contract and privacy projection above. `H` = fully observed instrumented host action; `E` = supported simulated embed event; `S` = server outcome. A row establishes only its stated trigger, not unobserved behavior or business success.

Deduplication `I` means exact retries of `(tenant_id, event_id)` retain one event; conflicting reuse rejects. Producers must retain the same event ID on retry. `V` additionally counts initial report rendering once per bound view/resource; later renders remain events. `C` additionally matches a query/search correlation within the same scope, subject, session segment, journey, and configuration. Two separately issued IDs cannot reliably be recognized as the same underlying action. No keystrokes are collected.

| Event | Purpose and exact trigger | Allowed event parameters | Origin, deduplication, observation limit |
| --- | --- | --- | --- |
| `workspace_viewed` | Adoption: host finishes displaying an authorized workspace screen | `module` | H / I; display, not attention |
| `search_submitted` | Discovery demand: user submits search | `category` | H / C; no search text or keystrokes |
| `search_results_shown` | Search friction: visible results finish displaying | `visible_count`, `coverage_complete` | H / C; only authorized visible results, not hidden matches |
| `search_result_opened` | Discovery path: user activates a result | `resource_type` | H / C; activation, not loaded content |
| `report_open_requested` | Report demand: host requests a bound report view | none | H / V; request, not initialization |
| `report_initialized` | Load progress: Power BI `loaded` callback | none | E / I; initialization, not rendering |
| `report_rendered` | Report delivery: supported render/run-complete callback | `outcome`; optional `tile_count`, `failed_tile_count` | E / V; callback coverage differs by source |
| `report_page_changed` | Navigation: Power BI `pageChanged` callback | none | E / I; no page name or user-intent inference |
| `report_interaction` | Interaction coverage: mapped run, filter, or operation-error callback | `interaction_kind` | E / I; only mapped kinds, no values |
| `report_load_failed` | Load friction: Power BI error while trusted lifecycle says initializing/rendering | `stage` | E / V; no error message; post-load errors stay operations |
| `documentation_opened` | Knowledge path: authorized document displayed in host | none | H / I; display, not comprehension |
| `definition_opened` | Meaning lookup: authorized definition displayed | none | H / I; version/provenance stay in protected content |
| `resource_saved` | Explicit intent: permitted save acknowledged | `resource_type` | H / I; saved resource, not subsequent use |
| `native_source_opened` | Handoff: host launches native source | `reason` | H / I; subsequent actions unobservable |
| `query_submitted` | Query demand: approved execution requested | none | H / C; template/SQL/parameters stay outside analytics |
| `query_completed` | Execution delivery: server observes result-ready completion | `outcome`, `row_count`, `truncated` | S / C; server completion, not browser viewing |
| `query_failed` | Query friction: server confirms terminal failure | `reason` | S / C; closed reason, no source detail |
| `query_cancelled` | Cancellation: server confirms terminal cancellation | none | S / C; not merely a click on Cancel |
| `query_results_viewed` | Result delivery: permitted result page displays | `page_index` | H / C; display, not analysis or understanding |
| `iq_question_submitted` | Assistance demand: scoped question submitted | none | H / I; no question text |
| `iq_answer_presented` | Answer delivery: answer or insufficient-evidence state displays | `outcome` | H / I; no answer text or correctness claim |
| `iq_source_opened` | Evidence follow-through: permitted cited source opens | `resource_type` | H / I; no source content |
| `iq_feedback_submitted` | Explicit feedback: user submits an approved response | `rating` | H / I; self-report, no productivity inference |
| `experience_configuration_published` | Change provenance: server acknowledges a published version | none | S / I; publication is product direction, fixture event only |
| `experience_variant_exposed` | Experience attribution: host displays an effective version | none | H / I; exposure, not a randomized experiment |

Parameter vocabularies are inspectable in `EVENT_CONTRACT`: modules and source systems are closed lists; outcomes are `success`, `partial`, `failure`, `cancelled`, or `unknown` (`query_completed` permits only success/partial); counts are integers from 0 to 1,000,000. `purpose` is trusted `employee`, `preview`, or `test`; `action_origin` is trusted `user`, `background`, or `unknown`. SDK callbacks alone generally cannot establish human intent. Attribute `user` only when a known initiating host action or documented mechanism supports it.

Candidate key events are an authorized result displayed, an acknowledged report save, and explicit `task_success` feedback. Each establishes a specific observation. A model answer and a rendered report do not establish correctness or understanding. The event/parameter and key-event approach is inspired by [GA4 events](https://support.google.com/analytics/answer/9322688?hl=en) and [key events](https://support.google.com/analytics/answer/9267568?hl=en), verified **2026-10-03**; Enterprise IQ defines its own semantics.

## Documented SDK mappings

| Simulated vendor event | Normalized meaning and conservative rule |
| --- | --- |
| Power BI `loaded` | `report_initialized`; report initialization only |
| Power BI `rendered` | `report_rendered`, success means the render callback occurred; first event-time render per view is `initial`, later callbacks are `subsequent` |
| Power BI `pageChanged` | `report_page_changed`; discard page objects |
| Power BI `error` | `report_load_failed` only in a trusted load phase; otherwise `report_interaction` with `operation_error` and failure outcome |
| Looker `dashboard:run:start` | `report_interaction` with `run_started`; tiles begin loading/querying, not equivalent to Power BI initialization |
| Looker `dashboard:run:complete` | `report_rendered`; inspect reported status and tile statuses, never assume all tiles succeeded |
| Looker `dashboard:filters:changed` | `report_interaction` with `filters_changed`; discard filter names and values |

Power BI rendering can recur after interaction. Its `dataSelected` coverage excludes range and relative slicers; this small reference does not map selection at all. Errors describe failed operations and are not universally load failures. No generic Power BI filter-change event is invented. [Microsoft event reference](https://learn.microsoft.com/en-us/javascript/api/overview/powerbi/handle-events), verified **2026-10-03**.

Looker run completion can include unsuccessful tiles. The reference maps mixed complete/error tiles to `partial`, all reported error tiles or error status to `failure`, stopped status to `cancelled`, and complete status plus a nonempty all-complete tile list to `success`. Missing or unrecognized evidence yields `unknown`; absent tile counts remain absent. Tile errors may contain SQL, so only counts and categories survive. Looker also warns that event delivery order can vary and illustrates checking both iframe source and origin. [Looker event reference](https://docs.cloud.google.com/looker/docs/embedded-javascript-events), verified **2026-10-03**. These mappings have not been verified against a live tenant or edition.

| Coverage class | What can be established | What remains unknown |
| --- | --- | --- |
| Fully observed host action | Instrumented display, submit, save acknowledgment, handoff | Work outside the host; understanding |
| Supported embed callback | Only the mapped callback and permitted metadata | Arbitrary iframe behavior; unsupported selections |
| Server outcome | A trusted adapter's terminal result state | Whether anyone viewed that result |
| Proxy/inference | A declared event-time path or latency association | Motivation, causation, productivity |
| Unobservable | Native-open continuation, disabled telemetry, lost/unavailable callbacks | Usage quantity; unsupported is not zero |

## Calculations and limitations

`computeJourneyMetrics` requires a tenant/workspace scope and UTC observation window `[start, end)`. Events are reprojected, deduplicated, and sorted by occurrence time with event ID as the tie-breaker. Arrival time is retained for diagnosis. Future occurrence times reject; this fixture does not implement distributed clock correction. Out-of-order arrival therefore cannot turn a second render into a second initial view. Equal-time event order is deterministic but does not prove causal order.

The local session rule splits a supplied session after **more than 30 minutes between observed events**; background events can keep this observation segment open. This is an explicit reference rule, not GA4's session implementation or proof of active attention. Journeys are independently issued task IDs and may repeat within a session. Matching includes tenant, workspace, subject, session segment, journey, and configuration; view/query matching also requires the bound opaque resource. The trusted issuer must mint a new view ID when its source binding changes.

Common exclusions are other scopes, invalid events, outside-window events, test/preview sessions, and background/unknown **initiations**. Terminal outcomes still match user-initiated requests. Missing prior steps, late terminals outside the window, and lost instrumentation remain missing evidence. Source/version filters are available, but a source filter can exclude host-side counterparts: compare only compatible instrumentation, scopes, and configuration cohorts. Reports initialized in Power BI and Looker runs started are distinct observations.

| Metric | Numerator / denominator or sample | Missing coverage and interpretation |
| --- | --- | --- |
| Zero-result search rate | Submitted searches whose first matched, completely observed results show zero / submitted searches with that eligible results event | Incomplete/missing results excluded from denominator and counted separately; empty denominator gives `null` |
| Search-to-first-render latency | Mean `occurred_at(render) − occurred_at(search)` for matched searches with a successful render after their first report-open request | Reports sample count and missing-outcome count; partial/unknown/failure callbacks do not supply success latency |
| Report outcomes | Unique opened views with any observed initialization, successful render, failure, partial, unknown, or cancellation / unique user-requested views | Rerenders do not inflate views; categories can overlap after recovery; no terminal callback is reported separately |
| Query completion and viewing | Completed correlated submissions / user submissions; completed submissions with a later viewed result / completed submissions | Reports partial, failure, cancellation, and missing terminals separately; zero-row completion is still a completion |
| Documentation → report | Observed user-action journeys with a later report request / journeys containing a documentation open | Optional steps and loopbacks are retained; this establishes sequence, not causality |
| IQ evidence follow-through | Journeys with source-open after answer-presented / journeys containing answer-presented | A journey-level path, not proof that a particular answer caused a click or was correct |
| Transitions and handoffs | Adjacent user-origin event transitions, preserving repeats; native-open event count | Handoff outcome is `observation_ends`, never automatic failure |

Minimum cohort is **3 distinct pseudonymous subjects by default**, configurable for synthetic tests. Whole analyses and metric denominators below the threshold suppress output; latency means also require enough matched subjects, and viewed/completed ratios require enough completed-submission subjects. Each transition has its own distinct-subject threshold. These are elementary local guards, not a complete statistical disclosure-control system: production must address differencing, repeated queries, and small cells. Return use is explicitly `not_estimated`; favorites-adoption and return rates need a declared eligible population and longer observation window. Repeated events never count as additional people.

[The fixture](../examples/journey-fixtures.mjs) has three fictional subjects, a zero-result search, incomplete results coverage, repeated renders, a partial Looker run, an unviewed completed query, and a missing query terminal. At the default threshold some subsets are deliberately suppressed. A minimum of one is used only in explicitly synthetic unit assertions to verify arithmetic. Fixture counts are not usage statistics.

## Usage Analytics and enterprise ownership

The proposed default administrator screen shows core observed outcomes, one relevant trend, top friction points, and coverage notes. Optional views cover **Adoption**, **Journeys**, **Friction**, and **Experience Changes**. An administrator could find repeated zero-result searches by approved category, inspect sanitized paths, improve Finance's terminology or navigation, publish a version, and compare later compatible cohorts. Raw search terms are absent, so terminology research needs a separate approved process. Before/after differences are descriptive associations; causal claims need a suitable controlled evaluation. No employee ranking or time-spent-as-productivity measure is proposed.

Proposed controls: authorized aggregate access by tenant/workspace, a reviewed minimum cohort, 30-day event retention and 180-day aggregate retention as configurable starting points, pseudonym rotation, scoped deletion propagation, and separately restricted correlation mappings. Owners must approve those periods and access policies before production. No retention/deletion service or compliance certification is delivered here.

An optional future GA4 exporter requires explicit enterprise approval, field and destination review, retention/deletion decisions, and a documented mapping. Omit tenant/resource/subject context unless independently approved; do not export raw text, SQL, source payloads, identity, or URLs. A SPA needs intentional virtual-screen pageviews and one ownership path to avoid duplicates from automatic and manual emission. Google's [SPA measurement guidance](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications) and [PII restrictions](https://support.google.com/analytics/answer/6366371?hl=en), verified **2026-10-03**, inform that future design. [GA4 funnel exploration](https://support.google.com/analytics/answer/9327974?hl=en), verified the same day, supports ordered-step analysis; this reference also preserves optional paths and loopbacks rather than imposing one linear funnel. No Google collection is configured or called.

Run the telemetry checks with `node --test tests/journey-telemetry.test.mjs`. Continue with the [integrated examples](../examples/README.md), [employee/admin walkthrough](walkthrough.md), and [source adapter boundaries](source-adapters.md).
