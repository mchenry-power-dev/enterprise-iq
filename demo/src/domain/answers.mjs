import { composeAnswer } from "../../../examples/evidence-composer-core.mjs";
import { makeFixture } from "../../../examples/fixtures.mjs";
import {
  currentWindow,
  selectAuthorizedContext,
} from "../../../examples/authorized-context.mjs";
import {
  DEFAULT_FILTERS,
  PERIODS,
  REGIONS,
  PRODUCTS,
  RECORDS,
  SAMPLE_AS_OF,
  REFRESHED_AT,
  VALID_UNTIL,
  normalizeFilters,
  selectRecords,
  metricScope,
  money,
  periodLabel,
  groupRecords,
} from "./data.mjs";
import { canAccess, normalizePersona, searchCatalog } from "./catalog.mjs";

export const GUIDED_QUESTIONS = Object.freeze([
  {
    id: "reconcile",
    question: "Why do Finance and Sales show different revenue?",
    title: "Explain gross vs. net revenue",
  },
  {
    id: "credits",
    question: "Show the supporting credits and definitions.",
    title: "Inspect credits and definitions",
  },
  {
    id: "freshness",
    question: "How fresh is the source evidence?",
    title: "Check source freshness",
  },
  {
    id: "related",
    question: "Find related permitted reports and documents.",
    title: "Find related resources",
  },
]);
export const EVIDENCE_SCENARIOS = Object.freeze([
  { id: "baseline", title: "Complete evidence" },
  { id: "missing-credits", title: "Missing credit evidence" },
  { id: "stale", title: "Stale lineage" },
  { id: "conflicting-definitions", title: "Conflicting definitions" },
]);
const resourceForRole = {
  finance: "finance-report",
  sales: "sales-report",
  credits: "credits-by-period",
  definition: "revenue-definition",
  close: "close-note",
  lineage: "refresh-lineage",
};

export function resourceHref(id) {
  if (
    [
      "finance-report",
      "sales-report",
      "credits-report",
      "regional-report",
      "product-report",
    ].includes(id)
  )
    return `#/reports/${id}`;
  if (
    [
      "credits-by-period",
      "revenue-reconciliation",
      "sales-by-region",
      "dataset-freshness",
      "credit-ledger",
    ].includes(id)
  ) {
    return `#/data-explorer?template=${id === "credit-ledger" ? "credits-by-period" : id}`;
  }
  return `#/knowledge/${id}`;
}

/** Fresh raw evidence is built per request; no earlier authorized context is reused. */
export function makeDemoEvidence({
  filters = DEFAULT_FILTERS,
  persona = "finance",
  scenario = "baseline",
  records = RECORDS,
} = {}) {
  const f = normalizeFilters(filters);
  const fixture = makeFixture();
  fixture.identity = normalizePersona(persona);
  fixture.permissionSnapshot.knownIdentities = [
    "finance",
    "sales",
    "operations",
    "admin",
  ];
  const validScope =
    PERIODS.includes(f.period) &&
    ["All", ...REGIONS].includes(f.region) &&
    ["All", ...PRODUCTS].includes(f.product) &&
    f.entity === "aster-us";
  if (!validScope) return { ...fixture, evidence: [] };
  const selected = selectRecords(f, records);
  const scope = metricScope(f);
  const creditSetId = `${f.period}-${f.region}-${f.product}-posted-credits`;
  for (const evidence of fixture.evidence) {
    evidence.acl.subjects = ["finance", "sales", "operations", "admin"].filter(
      (role) => canAccess(resourceForRole[evidence.role], role),
    );
    evidence.reference = resourceHref(resourceForRole[evidence.role]);
    evidence.title = {
      finance: `Finance Performance · ${periodLabel(f.period)}`,
      sales: `Sales Performance · ${periodLabel(f.period)}`,
      credits: `Posted credits · ${periodLabel(f.period)}`,
      definition: "Gross vs. net revenue · v2",
      close: `${periodLabel(f.period)} close membership`,
      lineage: "Report ownership & refresh",
    }[evidence.role];
    if (evidence.payload.contract)
      Object.assign(evidence.payload.contract, structuredClone(scope));
    if (evidence.payload.scope) evidence.payload.scope = structuredClone(scope);
    if (evidence.role === "finance") {
      evidence.payload.rows = selected.map((row) => ({
        id: row.id,
        amountCents: row.netCents,
      }));
      evidence.text = `Finance net revenue for posted US transactions in ${periodLabel(f.period)}, with the selected dimension filters.`;
    }
    if (evidence.role === "sales") {
      evidence.payload.rows = selected.map((row) => ({
        id: row.id,
        amountCents: row.grossCents,
      }));
      evidence.text = `Sales gross revenue for posted US transactions in ${periodLabel(f.period)}, with the selected dimension filters.`;
    }
    if (evidence.role === "credits") {
      evidence.payload.rows = selected.map((row) => ({
        id: row.creditId,
        amountCents: row.creditsCents,
      }));
      evidence.payload.creditSetId = creditSetId;
      evidence.text =
        "Selected posted period credits, derived from the same public synthetic records and filters as the report.";
    }
    if (evidence.role === "close") {
      evidence.payload.creditSetId = creditSetId;
      evidence.payload.creditRecordIds = selected.map((row) => row.creditId);
      evidence.text =
        "These exact credit IDs belong to the selected sample reporting period and dimension filters.";
    }
  }
  if (scenario === "missing-credits")
    fixture.evidence = fixture.evidence.filter(
      (item) => item.role !== "credits",
    );
  else if (scenario === "stale")
    fixture.evidence.find(
      (item) => item.role === "lineage",
    ).payload.validUntil = "2026-10-02T00:00:00Z";
  else if (scenario === "conflicting-definitions") {
    const extra = structuredClone(
      fixture.evidence.find((item) => item.role === "definition"),
    );
    extra.id = "revenue-definition-v3";
    extra.title = "Competing revenue definition · v3";
    extra.payload.output.version = "3";
    fixture.evidence.push(extra);
  } else if (scenario !== "baseline") fixture.evidence = [];
  return fixture;
}

function questionId(question) {
  const normalized = String(question ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[?.!]+$/u, "");
  const found = GUIDED_QUESTIONS.find((item) =>
    [item.id, item.question, item.title].some(
      (text) =>
        text.toLocaleLowerCase("en-US").replace(/[?.!]+$/u, "") === normalized,
    ),
  );
  if (found) return found.id;
  if (
    [
      "why do finance and sales show different september revenue",
      "explain gross versus net revenue",
      "why do finance and sales show different revenue",
      "gross vs net revenue",
    ].includes(normalized)
  )
    return "reconcile";
  return null;
}

export function runGuidedQuestion(question = "reconcile", options = {}) {
  const id = questionId(question);
  const f = normalizeFilters(options.filters);
  if (!id)
    return {
      status: "unsupported",
      composer: "deterministic-reference",
      answer:
        "This guided demo supports revenue reconciliation, supporting credits, source freshness, and related resources. Choose a supported question below.",
      conclusion: "Choose a supported guided question.",
      citations: [],
      suggestedQuestions: GUIDED_QUESTIONS,
      filters: f,
    };
  const fixture = makeDemoEvidence(options);
  const composed = composeAnswer(fixture);
  const citations = composed.citations.map((item) => ({
    ...item,
    resourceId: item.id === "credit-ledger" ? "credits-by-period" : item.id,
    href: item.reference,
  }));
  const response = {
    ...composed,
    question: GUIDED_QUESTIONS.find((item) => item.id === id).question,
    citations,
    filters: f,
    period: periodLabel(f.period),
    suggestedQuestions: GUIDED_QUESTIONS,
    followUps: [
      { label: "Inspect credits", href: resourceHref("credits-by-period") },
      {
        label: "Read metric definition",
        href: resourceHref("revenue-definition"),
      },
    ].filter((item) =>
      canAccess(
        item.label === "Inspect credits"
          ? "credits-by-period"
          : "revenue-definition",
        options.persona,
      ),
    ),
  };
  if (id === "related") {
    const resources = searchCatalog("revenue", {
      persona: options.persona,
    }).filter((item) => ["report", "document"].includes(item.kind));
    return {
      ...response,
      status: resources.length ? "supported" : "insufficient_support",
      calculation: undefined,
      context: [],
      answer: resources.length
        ? "These currently permitted sample resources support a revenue investigation. Open a report to inspect values or read the definition to compare their meaning."
        : "No related resources are available for the current simulated persona.",
      conclusion: "Related permitted resources",
      resources,
      citations: resources.map((item) => ({
        id: item.id,
        resourceId: item.id,
        title: item.title,
        platform: item.source,
        href: resourceHref(item.id),
        reference: resourceHref(item.id),
      })),
    };
  }
  if (id === "freshness") {
    const context = selectAuthorizedContext(fixture).evidence;
    const lineage = context.find((item) => item.role === "lineage");
    const fresh =
      lineage &&
      currentWindow(
        lineage.payload.completedAt,
        lineage.payload.validUntil,
        SAMPLE_AS_OF,
      );
    return {
      ...response,
      status: fresh ? "supported" : "insufficient_support",
      calculation: undefined,
      conclusion: fresh
        ? "A fixed sample refresh, with explicit evidence dates."
        : "Current source freshness is not established.",
      answer: fresh
        ? `The synthetic datasets refreshed at ${REFRESHED_AT} and have a validity window ending ${VALID_UNTIL}. This demo evaluates them at ${SAMPLE_AS_OF}, its fixed sample clock. The selected reporting period is ${periodLabel(f.period)}. These timestamps describe sample evidence, not a live platform connection.`
        : "The currently permitted lineage does not establish current evidence at the fixed sample clock. A fresh numerical reconciliation is withheld.",
      citations: citations.filter((item) => item.id === "refresh-lineage"),
    };
  }
  if (!response.calculation)
    return {
      ...response,
      conclusion:
        "There is not enough compatible, permitted evidence to reconcile.",
    };
  const amounts = response.calculation.amounts;
  const conclusion = `${money(amounts.grossCents)} gross − ${money(amounts.creditsCents)} credits = ${money(amounts.calculatedNetCents)} net.`;
  if (id === "credits") {
    const breakdown = groupRecords(
      f,
      "creditReason",
      options.records ?? RECORDS,
    );
    return {
      ...response,
      conclusion: `${money(amounts.creditsCents)} in supporting period credits.`,
      breakdown,
      answer:
        `${periodLabel(f.period)} credits total ${money(amounts.creditsCents)} for the selected scope. ` +
        breakdown
          .map((row) => `${row.name}: ${money(row.creditsCents)}`)
          .join("; ") +
        ". Net revenue v2 subtracts these posted period credits v1 from gross revenue v1. The close membership was checked against the selected credit IDs.",
    };
  }
  return { ...response, conclusion, amounts };
}
