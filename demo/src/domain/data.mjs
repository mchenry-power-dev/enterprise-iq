/** Original public synthetic records. Money is stored only as integer USD cents. */
export const SAMPLE_AS_OF = "2026-10-03T12:00:00Z";
export const REFRESHED_AT = "2026-10-01T06:00:00Z";
export const VALID_UNTIL = "2026-10-04T00:00:00Z";
export const PERIODS = Object.freeze([
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
]);
export const REGIONS = Object.freeze(["Northeast", "South", "Midwest", "West"]);
export const PRODUCTS = Object.freeze(["Equipment", "Components", "Services"]);
export const DEFAULT_FILTERS = Object.freeze({
  period: "2026-09",
  entity: "aster-us",
  region: "All",
  product: "All",
});
export const CREDIT_REASONS = Object.freeze([
  "Pricing adjustment",
  "Product return",
  "Service allowance",
  "Duplicate charge",
]);
const regionGross = [64_000_000, 56_000_000, 44_000_000, 36_000_000];
const regionCredits = [4_000_000, 4_000_000, 5_000_000, 3_000_000];
const productWeights = [50, 30, 20];
const creditWeights = [40, 35, 25];
const orderWeights = [10, 20, 30, 40];
const monthWeights = [80, 86, 93, 100];

export const RECORDS = Object.freeze(
  PERIODS.flatMap((period, m) =>
    REGIONS.flatMap((region, r) =>
      PRODUCTS.flatMap((product, p) =>
        orderWeights.map((weight, o) => {
          const grossCents =
            (regionGross[r] * productWeights[p] * weight * monthWeights[m]) /
            1_000_000;
          const creditsCents =
            (regionCredits[r] * creditWeights[p] * weight * monthWeights[m]) /
            1_000_000;
          const id = `${period}-${r + 1}-${p + 1}-${o + 1}`;
          return Object.freeze({
            id: `sale-${id}`,
            invoiceId: `INV-${id}`,
            creditId: `credit-${id}`,
            period,
            entity: "aster-us",
            entityLabel: "Aster Manufacturing US",
            currency: "USD",
            country: "US",
            status: "posted",
            region,
            product,
            channel: o % 2 === 0 ? "Direct" : "Distribution",
            creditReason: CREDIT_REASONS[o],
            grossCents,
            creditsCents,
            netCents: grossCents - creditsCents,
            units: Math.round(
              grossCents / (p === 0 ? 250_000 : p === 1 ? 25_000 : 100_000),
            ),
          });
        }),
      ),
    ),
  ),
);

export function normalizeFilters(filters = {}) {
  return { ...DEFAULT_FILTERS, ...filters };
}

export function selectRecords(filters = {}, records = RECORDS) {
  const f = normalizeFilters(filters);
  return records.filter(
    (row) =>
      row.entity === f.entity &&
      (f.period === "All" || row.period === f.period) &&
      (f.region === "All" || row.region === f.region) &&
      (f.product === "All" || row.product === f.product),
  );
}

export function summarize(filters = {}, records = RECORDS) {
  const rows = selectRecords(filters, records);
  const result = rows.reduce(
    (sum, row) => {
      for (const key of ["grossCents", "creditsCents", "netCents", "units"]) {
        if (!Number.isSafeInteger(row[key]) || row[key] < 0)
          throw new TypeError("Invalid synthetic measurement.");
        sum[key] += row[key];
        if (!Number.isSafeInteger(sum[key]))
          throw new RangeError("Measurement exceeds the supported range.");
      }
      return sum;
    },
    { grossCents: 0, creditsCents: 0, netCents: 0, units: 0 },
  );
  return {
    ...result,
    rowCount: rows.length,
    creditRate: result.grossCents
      ? result.creditsCents / result.grossCents
      : null,
    coverage: rows.length ? "complete" : "empty",
    currency: "USD",
    filters: normalizeFilters(filters),
  };
}

export function groupRecords(
  filters = {},
  dimension = "region",
  records = RECORDS,
) {
  if (
    !["period", "region", "product", "creditReason", "channel"].includes(
      dimension,
    )
  )
    throw new TypeError("Unsupported grouping.");
  const groups = new Map();
  for (const row of selectRecords(filters, records)) {
    const group = groups.get(row[dimension]) ?? {
      name: row[dimension],
      [dimension]: row[dimension],
      grossCents: 0,
      creditsCents: 0,
      netCents: 0,
      units: 0,
      rowCount: 0,
    };
    for (const key of ["grossCents", "creditsCents", "netCents", "units"])
      group[key] += row[key];
    group.rowCount += 1;
    groups.set(row[dimension], group);
  }
  return [...groups.values()];
}

export function money(cents, compact = false) {
  if (cents === null || cents === undefined || !Number.isFinite(cents))
    return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact || cents % 100 === 0 ? 0 : 2,
    ...(compact ? { notation: "compact" } : {}),
  }).format(cents / 100);
}

export function periodLabel(period) {
  if (!PERIODS.includes(period))
    return period === "All" ? "June–September 2026" : "Unavailable period";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${period}-01T12:00:00Z`));
}

export function monthWindow(period) {
  const [year, month] = period.split("-").map(Number);
  return {
    start: `${period}-01`,
    end: `${period}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`,
  };
}

/** Explicit matched comparison context, reused by composer and query evidence. */
export function metricScope(filters = {}) {
  const f = normalizeFilters(filters);
  return {
    period: monthWindow(f.period),
    currency: "USD",
    entity: "Aster Manufacturing US",
    grain: "entity-month",
    aggregation: "SUM",
    filters: [
      "country=US",
      "status=posted",
      ...(f.region === "All" ? [] : [`region=${f.region}`]),
      ...(f.product === "All" ? [] : [`product=${f.product}`]),
    ],
  };
}
