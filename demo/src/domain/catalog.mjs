import { REFRESHED_AT } from "./data.mjs";

export const SOURCES = Object.freeze([
  {
    id: "power-bi",
    name: "Power BI",
    category: "Reports",
    description:
      "Interactive Finance report simulation. Original charts, filters, pages, and tables.",
    mode: "Sample adapter",
  },
  {
    id: "looker",
    name: "Looker",
    category: "Reports",
    description:
      "Interactive Sales dashboard simulation with local tile calculations.",
    mode: "Sample adapter",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    category: "Queries",
    description:
      "Approved local query templates with typed results and bounded sessions.",
    mode: "Sample adapter",
  },
  {
    id: "databricks",
    name: "Databricks",
    category: "Queries",
    description:
      "The same public synthetic records, exposed through a second sample query adapter.",
    mode: "Sample adapter",
  },
  {
    id: "confluence",
    name: "Confluence",
    category: "Knowledge",
    description:
      "Original metric definitions and department guidance, rendered as safe text.",
    mode: "Sample adapter",
  },
  {
    id: "sharepoint",
    name: "SharePoint",
    category: "Knowledge",
    description: "Original close, credit policy, and ownership notes.",
    mode: "Sample adapter",
  },
]);

const report = (
  id,
  title,
  description,
  department,
  source,
  metric,
  dimension,
  aliases,
  owner,
) => ({
  id,
  title,
  description,
  department,
  source,
  platform: source,
  metric,
  dimension,
  aliases,
  owner,
  kind: "report",
  updatedAt: REFRESHED_AT,
  freshness: "Sample refresh · 1 Oct 2026, 06:00 UTC",
  relatedIds: ["revenue-definition", "close-note", "refresh-lineage"],
});
export const REPORTS = Object.freeze([
  report(
    "finance-report",
    "Finance Performance",
    "Understand net revenue, period credits, and the monthly close.",
    "Finance",
    "Power BI",
    "netCents",
    "region",
    ["net revenue", "revenue", "month end", "close", "financial performance"],
    "Finance Analytics",
  ),
  report(
    "sales-report",
    "Sales Performance",
    "Explore gross revenue across regions, products, and sales channels.",
    "Sales",
    "Looker",
    "grossCents",
    "product",
    ["gross revenue", "revenue", "sales dashboard", "bookings"],
    "Commercial Analytics",
  ),
  report(
    "credits-report",
    "Credits & Adjustments",
    "Follow posted credits by reason, region, and product.",
    "Finance",
    "Power BI",
    "creditsCents",
    "creditReason",
    ["credit ledger", "adjustments", "returns", "credits policy"],
    "Revenue Accounting",
  ),
  report(
    "regional-report",
    "Regional Revenue",
    "Compare regional contributions and four months of gross revenue.",
    "Sales",
    "Looker",
    "grossCents",
    "region",
    ["territory", "regional sales", "geography"],
    "Commercial Analytics",
  ),
  report(
    "product-report",
    "Product Mix",
    "See equipment, components, and services contribution to the business.",
    "Operations",
    "Power BI",
    "netCents",
    "product",
    ["category", "units", "product mix", "operations"],
    "Operations Insights",
  ),
]);

const doc = (
  id,
  title,
  description,
  source,
  owner,
  sections,
  aliases,
  department = "Finance",
) => ({
  id,
  title,
  description,
  source,
  platform: source,
  owner,
  sections,
  aliases,
  department,
  kind: "document",
  version: "2.0",
  updatedAt: REFRESHED_AT,
  asOf: "1 October 2026",
  relatedIds: ["finance-report", "sales-report"],
});

export const DOCUMENTS = Object.freeze([
  doc(
    "revenue-definition",
    "Gross vs. net revenue",
    "The definitions behind Finance and Sales, with a common comparison contract.",
    "Confluence",
    "Finance Governance",
    [
      {
        id: "definitions",
        title: "Two measures, two useful views",
        paragraphs: [
          "Gross revenue v1 is the sum of posted sales amounts before period credits. Sales uses it to understand commercial activity.",
          "Net revenue v2 subtracts posted period credits v1 from gross revenue. Finance uses it to describe the amount retained after those adjustments.",
        ],
      },
      {
        id: "comparison",
        title: "Compare the same scope",
        paragraphs: [
          "Align period, currency, entity, grain, filters, aggregation, and definition version before comparing values. This demo uses Aster Manufacturing US, USD, entity-month grain, SUM, country=US, and status=posted.",
          "Report filters add region and product restrictions to every side of the comparison. A gross value for one region cannot explain a net value for the whole entity.",
        ],
      },
      {
        id: "calculation",
        title: "The September reconciliation",
        paragraphs: [
          "The synthetic September records sum to $2,000,000 gross and $160,000 posted credits. Net revenue is therefore $1,840,000. All report and query values are derived from those same records.",
          "An unavailable credit set is missing evidence. It must never be silently interpreted as zero credits. The guided explanation checks current simulated permissions, period membership, definitions, freshness, and lineage before asserting the result.",
        ],
      },
    ],
    ["definition", "gross", "net", "metric", "reconciliation"],
  ),
  doc(
    "close-note",
    "September close note",
    "What belongs in the September close and how the synthetic credit set is matched.",
    "SharePoint",
    "Revenue Accounting",
    [
      {
        id: "scope",
        title: "Close scope",
        paragraphs: [
          "The September sample close covers posted US transactions dated 1–30 September 2026 in USD. Later-period credits do not belong to this reporting period. Region and product selections remain part of the evidence context.",
        ],
      },
      {
        id: "membership",
        title: "Credit membership",
        paragraphs: [
          "The sample ledger contains 48 posted September credit allocations across four regions, three products, and four adjustment reasons. Its amounts sum to $160,000. The exact credit IDs are generated with the same period and dimension keys as their related sales records.",
          "The deterministic composer compares the credit IDs in the scoped ledger with the scoped close membership. A mismatch withholds the reconciliation instead of reporting a false success.",
        ],
      },
      {
        id: "review",
        title: "Review sequence",
        paragraphs: [
          "Open Finance Performance, confirm the definition, inspect the approved credits query, and then ask the supported reconciliation question. Save the period and filters with the investigation so another visit preserves its meaning.",
        ],
      },
    ],
    ["close", "month end", "membership", "September"],
  ),
  doc(
    "credits-policy",
    "Credits policy",
    "Four adjustment reasons and their role in the net-revenue calculation.",
    "SharePoint",
    "Revenue Accounting",
    [
      {
        id: "reasons",
        title: "Approved sample reasons",
        paragraphs: [
          "Pricing adjustment corrects a posted price difference. Product return reverses an eligible sale amount. Service allowance records a commercial service adjustment. Duplicate charge corrects a duplicate posting.",
          "These are original synthetic categories for this reference demo. They do not describe a real company policy.",
        ],
      },
      {
        id: "recognition",
        title: "Period recognition",
        paragraphs: [
          "The reference metric uses the period in which a credit is posted. A credit outside the selected month is excluded. Each selected record retains its ID, period, currency, region, product, reason, and amount.",
        ],
      },
      {
        id: "investigate",
        title: "Investigate a credit",
        paragraphs: [
          "Use Credits & Adjustments for the reason breakdown or run Credits by reason in Data Explorer. Partial results remain labeled partial; exporting a capped result does not turn it into a complete ledger.",
        ],
      },
    ],
    ["credits", "returns", "adjustment", "policy"],
  ),
  doc(
    "refresh-lineage",
    "Report ownership & refresh",
    "Sample source lineage, refresh timing, and freshness boundaries.",
    "Confluence",
    "Analytics Enablement",
    [
      {
        id: "lineage",
        title: "A shared synthetic origin",
        paragraphs: [
          "All five reports and the approved query templates use the same original public fixture records. Power BI, Looker, Snowflake, and Databricks identify intended source roles; no enterprise API is called.",
          "Finance Analytics owns the Finance view, Commercial Analytics owns the Sales and Regional views, and Operations Insights owns Product Mix.",
        ],
      },
      {
        id: "freshness",
        title: "Fixed sample clock",
        paragraphs: [
          "The fixture refresh is 1 October 2026 at 06:00 UTC. Evidence is evaluated at a fixed sample time of 3 October 2026 at 12:00 UTC, inside its recorded validity window. These dates are sample metadata, not a promise of a recent live refresh.",
        ],
      },
      {
        id: "stale",
        title: "Incomplete or stale evidence",
        paragraphs: [
          "The stale-evidence scenario expires the lineage confirmation. The missing-evidence scenario removes the ledger. Either change prevents a supported numerical reconciliation. A live service would need source-specific freshness and revocation handling.",
        ],
      },
    ],
    ["freshness", "refresh", "lineage", "owner", "source"],
  ),
  doc(
    "department-guide",
    "Working across departments",
    "A practical path through reports, context, and shared investigations.",
    "Confluence",
    "Analytics Enablement",
    [
      {
        id: "finance",
        title: "Finance",
        paragraphs: [
          "Start with net revenue and the close scope. Read the metric definition before comparing with a Sales measure. Keep credit evidence and close membership together.",
        ],
      },
      {
        id: "sales",
        title: "Sales",
        paragraphs: [
          "Start with gross revenue, then compare product and regional contribution. Gross and net answer different questions. If the current simulated persona cannot use credit evidence, Ask IQ withholds the numerical reconciliation.",
        ],
      },
      {
        id: "operations",
        title: "Operations",
        paragraphs: [
          "Use Product Mix and region filters to see how the synthetic business is distributed. Saved views capture the period and filters. Personal collections organize resources without changing source access.",
        ],
      },
    ],
    ["guidance", "department", "help", "workspace"],
    "Operations",
  ),
]);

export const QUERY_DEFINITIONS = Object.freeze([
  {
    id: "revenue-reconciliation",
    title: "Revenue reconciliation",
    description: "Gross, credits, and net by region and product.",
    department: "Finance",
    source: "Snowflake",
    kind: "query",
    owner: "Finance Analytics",
    aliases: ["net", "gross", "reconcile"],
  },
  {
    id: "credits-by-period",
    title: "Credits by reason",
    description: "Posted credit rows with reason, region, and product.",
    department: "Finance",
    source: "Snowflake",
    kind: "query",
    owner: "Revenue Accounting",
    aliases: ["credits", "ledger", "adjustments"],
  },
  {
    id: "sales-by-region",
    title: "Sales by region and month",
    description:
      "Gross revenue and units, grouped by region in the selected month.",
    department: "Sales",
    source: "Databricks",
    kind: "query",
    owner: "Commercial Analytics",
    aliases: ["sales", "regional", "units"],
  },
  {
    id: "dataset-freshness",
    title: "Dataset freshness",
    description:
      "The sample refresh, validity, and row count for each measured dataset.",
    department: "Operations",
    source: "Databricks",
    kind: "query",
    owner: "Analytics Enablement",
    aliases: ["freshness", "lineage", "refresh"],
  },
]);

export function normalizePersona(persona = "finance") {
  return (
    {
      "finance-analyst": "finance",
      "sales-analyst": "sales",
      administrator: "admin",
      "operations-analyst": "operations",
    }[persona] ?? persona
  );
}

/** Local persona presentation is not authentication; all bundled data is public. */
export function canAccess(id, persona = "finance") {
  const role = normalizePersona(persona);
  if (!["finance", "sales", "operations", "admin"].includes(role)) return false;
  if (
    !REPORTS.concat(DOCUMENTS, QUERY_DEFINITIONS).some((item) => item.id === id)
  )
    return false;
  return (
    ["finance", "admin"].includes(role) ||
    ![
      "credits-report",
      "credits-by-period",
      "revenue-reconciliation",
      "close-note",
      "credits-policy",
    ].includes(id)
  );
}

export function getResource(id, persona = "finance") {
  if (!canAccess(id, persona)) return null;
  return (
    REPORTS.concat(DOCUMENTS, QUERY_DEFINITIONS).find(
      (item) => item.id === id,
    ) ?? null
  );
}

export function searchCatalog(
  text = "",
  {
    persona = "finance",
    department = "All",
    source = "All",
    kind = "All",
    aliases = {},
  } = {},
) {
  const terms = String(text)
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  return REPORTS.concat(DOCUMENTS, QUERY_DEFINITIONS).filter((item) => {
    if (
      !canAccess(item.id, persona) ||
      (department !== "All" && item.department !== department) ||
      (source !== "All" && item.source !== source) ||
      (kind !== "All" && item.kind !== kind)
    )
      return false;
    const haystack = [
      item.title,
      item.description,
      item.owner,
      item.source,
      ...item.aliases,
      ...(aliases[item.id] ?? []),
    ]
      .join(" ")
      .normalize("NFKC")
      .toLocaleLowerCase("en-US");
    return terms.every((term) => haystack.includes(term));
  });
}
