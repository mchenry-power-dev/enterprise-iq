import { createQuerySession } from "../../../examples/governed-query.mjs";
import { currentWindow } from "../../../examples/authorized-context.mjs";
import {
  DEFAULT_FILTERS,
  PERIODS,
  REGIONS,
  PRODUCTS,
  RECORDS,
  SAMPLE_AS_OF,
  REFRESHED_AT,
  VALID_UNTIL,
  selectRecords,
  metricScope,
  groupRecords,
} from "./data.mjs";
import { canAccess, normalizePersona, QUERY_DEFINITIONS } from "./catalog.mjs";

const textColumn = (name) => ({
  name,
  label: name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
  type: "string",
});
const amountColumn = (name) => ({
  ...textColumn(name),
  label: name.replace("Cents", "").replace(/^./, (c) => c.toUpperCase()),
  type: "integer",
  unit: "currency-minor-unit",
  currency: "USD",
  definition: {
    id:
      name === "grossCents"
        ? "gross-revenue"
        : name === "netCents"
          ? "net-revenue"
          : "period-credits",
    version: name === "netCents" ? "2" : "1",
  },
});
export const QUERY_COLUMNS = Object.freeze({
  "revenue-reconciliation": [
    textColumn("region"),
    textColumn("product"),
    amountColumn("grossCents"),
    amountColumn("creditsCents"),
    amountColumn("netCents"),
  ],
  "credits-by-period": [
    textColumn("creditId"),
    textColumn("period"),
    textColumn("region"),
    textColumn("product"),
    textColumn("reason"),
    amountColumn("amountCents"),
  ],
  "sales-by-region": [
    textColumn("period"),
    textColumn("region"),
    amountColumn("grossCents"),
    { name: "units", label: "Units", type: "integer" },
  ],
  "dataset-freshness": [
    textColumn("dataset"),
    textColumn("period"),
    textColumn("refreshedAt"),
    textColumn("validUntil"),
    { name: "records", label: "Records", type: "integer" },
  ],
});
const TEMPLATE_IDS = Object.freeze(QUERY_DEFINITIONS.map((item) => item.id));
const PARAMETER_KEYS = [
  "period",
  "entity",
  "region",
  "product",
  "source",
  "scenario",
  "limit",
];
const reject = (code) => ({ status: "rejected", error: { code } });

export function queryParameters(parameters = {}) {
  return {
    ...DEFAULT_FILTERS,
    source: "Snowflake",
    scenario: "complete",
    limit: 100,
    ...parameters,
  };
}
function validParameters(p) {
  return (
    p &&
    Object.keys(p).length === PARAMETER_KEYS.length &&
    PARAMETER_KEYS.every((key) => Object.hasOwn(p, key)) &&
    PERIODS.includes(p.period) &&
    p.entity === "aster-us" &&
    ["All", ...REGIONS].includes(p.region) &&
    ["All", ...PRODUCTS].includes(p.product) &&
    ["Snowflake", "Databricks"].includes(p.source) &&
    ["complete", "partial", "failed", "empty"].includes(p.scenario) &&
    Number.isInteger(p.limit) &&
    p.limit >= 1 &&
    p.limit <= 100
  );
}

export function sqlPreview(templateId, parameters = {}) {
  const p = queryParameters(parameters);
  if (!TEMPLATE_IDS.includes(templateId) || !validParameters(p))
    return "-- Choose valid approved template parameters.";
  const where =
    `period = '${p.period}' AND entity = 'aster-us'\n  AND country = 'US' AND status = 'posted'` +
    (p.region === "All" ? "" : `\n  AND region = '${p.region}'`) +
    (p.product === "All" ? "" : `\n  AND product = '${p.product}'`);
  const queries = {
    "revenue-reconciliation": `SELECT region, product, SUM(gross_cents) AS gross_cents,\n  SUM(credits_cents) AS credits_cents,\n  SUM(gross_cents - credits_cents) AS net_cents\nFROM sample_sales\nWHERE ${where}\nGROUP BY region, product\nORDER BY region, product`,
    "credits-by-period": `SELECT credit_id, period, region, product, reason, amount_cents\nFROM sample_credits\nWHERE ${where}\nORDER BY credit_id`,
    "sales-by-region": `SELECT period, region, SUM(gross_cents) AS gross_cents,\n  SUM(units) AS units\nFROM sample_sales\nWHERE ${where}\nGROUP BY period, region\nORDER BY period, region`,
    "dataset-freshness": `SELECT dataset, period, refreshed_at, valid_until,\n  COUNT(*) AS records\nFROM sample_dataset_metadata\nWHERE ${where}\nGROUP BY dataset, period, refreshed_at, valid_until\nORDER BY dataset`,
  };
  return `-- ${p.source} sample adapter · approved local template\n${queries[templateId]}\nLIMIT ${p.limit};`;
}

function computeRows(templateId, p, records) {
  const selected = selectRecords(p, records);
  if (templateId === "credits-by-period")
    return selected
      .map((row) => ({
        creditId: row.creditId,
        period: row.period,
        region: row.region,
        product: row.product,
        reason: row.creditReason,
        amountCents: row.creditsCents,
      }))
      .sort((a, b) => a.creditId.localeCompare(b.creditId));
  if (templateId === "revenue-reconciliation") {
    return REGIONS.flatMap((region) =>
      PRODUCTS.map((product) => {
        const rows = selected.filter(
          (row) => row.region === region && row.product === product,
        );
        return rows.length
          ? {
              region,
              product,
              ...rows.reduce(
                (sum, row) => ({
                  grossCents: sum.grossCents + row.grossCents,
                  creditsCents: sum.creditsCents + row.creditsCents,
                  netCents: sum.netCents + row.netCents,
                }),
                { grossCents: 0, creditsCents: 0, netCents: 0 },
              ),
            }
          : null;
      }),
    )
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.region.localeCompare(b.region) ||
          a.product.localeCompare(b.product),
      );
  }
  if (templateId === "sales-by-region")
    return groupRecords(p, "region", records)
      .map((row) => ({
        period: p.period,
        region: row.name,
        grossCents: row.grossCents,
        units: row.units,
      }))
      .sort((a, b) => a.region.localeCompare(b.region));
  return ["Finance net revenue", "Sales gross revenue", "Posted credits"].map(
    (dataset) => ({
      dataset,
      period: p.period,
      refreshedAt: REFRESHED_AT,
      validUntil: VALID_UNTIL,
      records: selected.length,
    }),
  );
}

/** Browser-only sample adapter. The reference session owns state and rechecks permissions.
 * @param {{getPersona?:()=>string, records?:typeof RECORDS, maxRows?:number, maxPageSize?:number, allowExport?:()=>boolean, clock?:()=>number}} [options]
 */
export function createDemoQuerySession({
  getPersona = () => "finance",
  records = RECORDS,
  maxRows = 100,
  maxPageSize = 100,
  allowExport = () => true,
  clock = () => Date.parse(SAMPLE_AS_OF),
} = {}) {
  const jobs = new Map();
  const executor = {
    start({ templateId, parameters }) {
      const handle = crypto.randomUUID();
      let rows = computeRows(templateId, parameters, records);
      if (parameters.scenario === "empty") rows = [];
      if (parameters.scenario === "partial")
        rows = rows.slice(0, Math.ceil(rows.length / 2));
      jobs.set(handle, {
        polls: 0,
        cancelled: false,
        parameters,
        result: {
          rows,
          coverage: parameters.scenario === "partial" ? "partial" : "complete",
          contract: {
            ...metricScope(parameters),
            definition: { id: templateId, version: "1" },
            freshness: { refreshedAt: REFRESHED_AT, validUntil: VALID_UNTIL },
            provenance: {
              fixtureId: templateId,
              platform: parameters.source,
              version: "synthetic-2026-10-01",
            },
          },
        },
      });
      return handle;
    },
    poll(handle) {
      const job = jobs.get(handle);
      if (!job) return { status: "failed" };
      if (job.cancelled) return { status: "cancelled" };
      if (++job.polls === 1) return { status: "running" };
      return job.parameters.scenario === "failed"
        ? { status: "failed" }
        : { status: "succeeded", result: job.result };
    },
    cancel(handle) {
      if (jobs.has(handle)) jobs.get(handle).cancelled = true;
    },
  };
  const session = createQuerySession({
    templates: TEMPLATE_IDS,
    validateRequestParameters: validParameters,
    requiredColumns: (templateId) =>
      QUERY_COLUMNS[templateId].map((column) => column.name),
    getTrustedContext: () => ({
      tenantId: "synthetic-aster",
      subjectId: normalizePersona(getPersona()),
    }),
    getPolicy: () => ({
      checkedAt: "2026-10-03T00:00:00Z",
      expiresAt: VALID_UNTIL,
      grants: TEMPLATE_IDS.filter((id) => canAccess(id, getPersona())).map(
        (id) => ({
          tenantId: "synthetic-aster",
          subjectId: normalizePersona(getPersona()),
          templateIds: [id],
          entities: ["aster-us"],
          periods: PERIODS,
          columns: QUERY_COLUMNS[id].map((column) => column.name),
          allowExport: allowExport() === true,
        }),
      ),
    }),
    clock,
    executor,
    maxRows,
    maxPageSize,
    projectSourceResult(result, p, sessionLimit, now, templateId) {
      const columns = QUERY_COLUMNS[templateId];
      if (
        !Array.isArray(result.rows) ||
        !["complete", "partial"].includes(result.coverage) ||
        !currentWindow(
          result.contract?.freshness?.refreshedAt,
          result.contract?.freshness?.validUntil,
          new Date(now).toISOString(),
        ) ||
        JSON.stringify(result.contract.period) !==
          JSON.stringify(metricScope(p).period) ||
        result.contract.provenance.platform !== p.source ||
        result.contract.definition.id !== templateId
      )
        throw new Error("Invalid sample result.");
      for (const row of result.rows)
        for (const column of columns) {
          if (
            column.type === "integer"
              ? !Number.isSafeInteger(row[column.name]) || row[column.name] < 0
              : typeof row[column.name] !== "string" ||
                row[column.name].length > 256
          )
            throw new Error("Invalid typed result.");
        }
      const limit = Math.min(p.limit, sessionLimit);
      const truncated = result.rows.length > limit;
      const rows = result.rows
        .slice(0, limit)
        .map((row) =>
          Object.fromEntries(columns.map((c) => [c.name, row[c.name]])),
        );
      return {
        columns,
        rows,
        rowCount: rows.length,
        coverage: truncated ? "partial" : result.coverage,
        truncated,
        partialReasons: [
          ...(result.coverage === "partial" ? ["source_partial"] : []),
          ...(truncated ? ["row_limit"] : []),
        ],
        contract: {
          ...result.contract,
          provenance: {
            ...result.contract.provenance,
            execution: "synthetic-mock",
          },
        },
      };
    },
  });
  return {
    ...session,
    submit(request) {
      if (
        !request ||
        typeof request !== "object" ||
        Array.isArray(request) ||
        Object.keys(request).some(
          (key) => !["requestId", "templateId", "parameters"].includes(key),
        ) ||
        !request.parameters ||
        typeof request.parameters !== "object" ||
        Array.isArray(request.parameters) ||
        Object.keys(request.parameters).some(
          (key) => !PARAMETER_KEYS.includes(key),
        )
      )
        return reject("invalid_request");
      return session.submit({
        ...request,
        parameters: queryParameters(request.parameters),
      });
    },
  };
}

export function queryResultIsStale(previousParameters, currentParameters) {
  const before = queryParameters(previousParameters),
    after = queryParameters(currentParameters);
  return PARAMETER_KEYS.some((key) => before[key] !== after[key]);
}

export function safeFilename(name, extension = "csv") {
  const base =
    String(name)
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "enterprise-iq-export";
  return `${base}.${["csv", "json"].includes(extension) ? extension : "csv"}`;
}

/** Quoted cells plus formula prefix protection, including leading whitespace controls. */
export function createCsv(rows, columns) {
  const names =
    columns?.map((column) =>
      typeof column === "string" ? column : column.name,
    ) ?? Object.keys(rows[0] ?? {});
  const cell = (value) => {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text))
      text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    names.map(cell).join(","),
    ...rows.map((row) => names.map((name) => cell(row[name])).join(",")),
  ].join("\r\n");
}

/** Keep metric meaning with exported rows; monetary field names retain their cents unit. */
export function createQueryCsv(result) {
  if (
    result?.status !== "available" ||
    !result.contract ||
    !Array.isArray(result.rows)
  )
    throw new TypeError("A currently permitted result is required.");
  const contract = result.contract;
  const context = {
    reportingPeriodStart: contract.period.start,
    reportingPeriodEnd: contract.period.end,
    currency: contract.currency,
    entity: contract.entity,
    grain: contract.grain,
    aggregation: contract.aggregation,
    scopeFilters: JSON.stringify(contract.filters),
    definitionId: contract.definition.id,
    definitionVersion: contract.definition.version,
    metricDefinitions: JSON.stringify(
      Object.fromEntries(
        result.columns
          .filter((column) => column.definition)
          .map((column) => [column.name, column.definition]),
      ),
    ),
    refreshedAt: contract.freshness.refreshedAt,
    validUntil: contract.freshness.validUntil,
    sampleSource: contract.provenance.platform,
    fixtureVersion: contract.provenance.version,
    coverage: result.coverage,
    truncated: result.truncated,
  };
  const contextColumns = Object.keys(context).filter(
    (name) => !result.columns.some((column) => column.name === name),
  );
  const columns = [
    ...result.columns,
    ...contextColumns.map((name) => ({ name })),
  ];
  return createCsv(
    result.rows.map((row) => ({ ...context, ...row })),
    columns,
  );
}
