import { makeFixture } from './fixtures.mjs';

/** Synthetic source data and server-owned policy; neither is browser-supplied identity. */
export function makeQueryFixture() {
  const original = makeFixture();
  const ledger = original.evidence.find(item => item.role === 'credits');
  return {
    synthetic: true,
    now: original.now,
    context: { tenantId: 'synthetic-aster', subjectId: original.identity },
    policy: {
      checkedAt: original.permissionSnapshot.checkedAt,
      expiresAt: original.permissionSnapshot.expiresAt,
      grants: [{
        tenantId: 'synthetic-aster', subjectId: original.identity,
        templateIds: ['credits-by-period'], entities: ['aster-us'], periods: ['2026-09'],
        columns: ['creditId', 'amountCents'], allowExport: true,
      }],
    },
    source: {
      tenantId: 'synthetic-aster', entityId: 'aster-us',
      contract: structuredClone(ledger.payload.contract),
      rows: ledger.payload.rows.map(row => ({ creditId: row.id, amountCents: row.amountCents })),
    },
  };
}
