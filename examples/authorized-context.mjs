/**
 * Synthetic authorization performed before context assembly. This is not authentication,
 * vendor authorization, row/column security, or a production isolation boundary.
 */

/** Validity requires an ordered, current window; an invalid clock also fails closed. */
export function currentWindow(start, end, now) {
  if (![start, end, now].every(value => typeof value === 'string')) return false;
  const values = [start, end, now].map(Date.parse);
  if (!values.every(Number.isFinite)) return false;
  if ([start, end, now].some((value, index) => {
    const canonical = new Date(values[index]).toISOString();
    return value !== canonical && value !== canonical.replace('.000Z', 'Z');
  })) return false;
  const [from, until, at] = values;
  return from < until && from <= at && at < until;
}

const string = value => typeof value === 'string' ? value : undefined;
const strings = value => Array.isArray(value) ? value.map(string) : undefined;
const definition = value => ({ id: string(value?.id), version: string(value?.version) });
const freshness = value => ({ refreshedAt: string(value?.refreshedAt), validUntil: string(value?.validUntil) });
const scope = value => ({
  period: { start: string(value?.period?.start), end: string(value?.period?.end) },
  currency: string(value?.currency), entity: string(value?.entity), grain: string(value?.grain),
  filters: strings(value?.filters), aggregation: string(value?.aggregation),
});

/** Project the declared role schema; unexpected nested catalog metadata is never context. */
function projectPayload(item) {
  const value = item.payload;
  if (!value || typeof value !== 'object') return undefined;
  if (['finance', 'sales', 'credits'].includes(item.role)) {
    const contract = value.contract;
    return {
      contract: {
        ...scope(contract), definition: definition(contract?.definition),
        freshness: freshness(contract?.freshness),
        provenance: {
          fixtureId: contract?.provenance?.fixtureId === item.id ? item.id : undefined,
          platform: contract?.provenance?.platform === item.platform ? item.platform : undefined,
          version: contract?.provenance?.version === item.version ? item.version : undefined,
        },
      },
      rows: Array.isArray(value.rows) ? value.rows.map(row => row ? ({
        id: string(row.id), amountCents: typeof row.amountCents === 'number' ? row.amountCents : undefined,
      }) : null) : undefined,
      ...(item.role === 'credits' ? { creditSetId: string(value.creditSetId) } : {}),
    };
  }
  if (item.role === 'definition') return {
    scope: scope(value.scope), output: definition(value.output), gross: definition(value.gross),
    credits: definition(value.credits), operation: string(value.operation), creditScope: string(value.creditScope),
  };
  if (item.role === 'close') return {
    scope: scope(value.scope), creditSetId: string(value.creditSetId), creditRecordIds: strings(value.creditRecordIds),
  };
  if (item.role === 'lineage') return {
    completedAt: string(value.completedAt), validUntil: string(value.validUntil), sourceIds: strings(value.sourceIds),
  };
  return undefined;
}

/**
 * Read the current identity registry and each current ACL on every call. Missing, expired,
 * future, or invalid permission metadata excludes the evidence. No denied metadata,
 * source counts, or reasons naming denied objects are returned.
 *
 * Emitted objects omit ACLs. Passing this context back as raw evidence therefore cannot
 * turn an earlier authorization decision into a new one.
 */
export function selectAuthorizedContext({ identity, evidence, permissionSnapshot, now } = {}) {
  const known = permissionSnapshot?.knownIdentities;
  if (typeof identity !== 'string' || !identity || !Array.isArray(known) ||
      !known.includes(identity) ||
      !currentWindow(permissionSnapshot.checkedAt, permissionSnapshot.expiresAt, now)) {
    return { status: 'unavailable', evidence: [] };
  }
  if (!Array.isArray(evidence)) return { status: 'unavailable', evidence: [] };

  const selected = [];
  for (const item of evidence) {
    const acl = item?.acl;
    if (!Array.isArray(acl?.subjects) || !acl.subjects.includes(identity) ||
        !currentWindow(acl.checkedAt, acl.expiresAt, now)) continue;
    if (!['finance', 'sales', 'credits', 'definition', 'close', 'lineage'].includes(item.role) ||
        typeof item.id !== 'string' || !item.id) continue;
    // Copy only the documented evidence schema, after authorization has succeeded.
    selected.push(structuredClone({
      id: item.id, title: string(item.title), platform: string(item.platform), role: item.role,
      text: string(item.text), payload: projectPayload(item), version: string(item.version),
      freshness: freshness(item.freshness), reference: string(item.reference),
    }));
  }
  const visibleIds = new Set(selected.map(item => item.id));
  for (const item of selected) {
    // Lineage links are catalog metadata too: retain only currently permitted targets.
    if (Array.isArray(item.payload?.sourceIds)) {
      item.payload.sourceIds = item.payload.sourceIds.filter(id => visibleIds.has(id));
    }
  }
  return { status: 'selected', evidence: selected };
}
