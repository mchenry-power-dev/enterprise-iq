import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExperienceFixture } from '../examples/experience-fixtures.mjs';
import { resolveExperience } from '../examples/experience-configuration.mjs';

test('department fixtures resolve different tasks, report collections and context, with provenance', () => {
  const finance = resolveExperience(makeExperienceFixture());
  const sales = resolveExperience(makeExperienceFixture('sales'));
  assert.equal(finance.status, 'resolved');
  assert.equal(sales.status, 'resolved');
  assert.equal(finance.effective.defaultReport, 'finance-report');
  assert.equal(sales.effective.defaultReport, 'sales-report');
  assert.equal(finance.effective.dataExplorerEnabled, true);
  assert.equal(sales.effective.dataExplorerEnabled, false);
  assert.notDeepEqual(finance.effective.contextualDocumentIds, sales.effective.contextualDocumentIds);
  assert.notDeepEqual(finance.effective.navigation, sales.effective.navigation);
  assert.equal(finance.provenance.brandName.source, 'organization');
  assert.equal(finance.provenance.defaultReport.source, 'team');
  assert.equal(finance.provenance.themeDensity.source, 'individual');
  assert.equal(Object.keys(finance.effective).length, Object.keys(finance.provenance).length);
  assert.notEqual(finance.experience_config_version, sales.experience_config_version);
});

test('unlocked settings follow organization, team, individual precedence without mutating inputs', () => {
  const fixture = makeExperienceFixture();
  fixture.team.settings.themeAccent = 'teal';
  fixture.individual.settings.themeAccent = 'plum';
  fixture.individual.settings.layout = 'balanced';
  const before = structuredClone(fixture);
  const result = resolveExperience(fixture);
  assert.equal(result.effective.themeAccent, 'plum');
  assert.equal(result.effective.layout, 'balanced');
  assert.deepEqual(fixture, before);
  result.effective.navigation[0].label = 'Changed output';
  assert.equal(fixture.organization.settings.navigation[0].label, 'Home');
});

test('organization and team locks retain values and report deterministic conflicts without attempted payloads', () => {
  const fixture = makeExperienceFixture('sales');
  fixture.team.settings.brandName = 'Attempted team brand';
  fixture.team.locks.push('brandName');
  fixture.individual.settings.brandName = 'Attempted personal brand';
  fixture.individual.settings.dataExplorerEnabled = true;
  fixture.individual.settings.collectionResourceIds = ['finance-report'];
  const result = resolveExperience(fixture);
  assert.equal(result.effective.brandName, 'Aster · Enterprise IQ');
  assert.equal(result.effective.dataExplorerEnabled, false);
  assert.deepEqual(result.effective.collectionResourceIds, ['sales-report']);
  assert.equal(result.provenance.brandName.lockedBy, 'organization');
  assert.equal(result.provenance.dataExplorerEnabled.lockedBy, 'team');
  assert.deepEqual(result.conflicts.map(conflict => conflict.setting),
    ['brandName', 'brandName', 'collectionResourceIds', 'dataExplorerEnabled']);
  assert.ok(!JSON.stringify(result).includes('Attempted'));
  assert.ok(!JSON.stringify(result).includes('finance-report'));
});

test('equivalent attempts on locked settings preserve original provenance without a conflict', () => {
  const fixture = makeExperienceFixture();
  fixture.individual.settings.brandName = fixture.organization.settings.brandName;
  const result = resolveExperience(fixture);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.provenance.brandName, {
    source: 'organization', version: 'synthetic-org-v1', lockedBy: 'organization',
  });
});

test('resource preferences cannot make inaccessible reports or documents visible', () => {
  const fixture = makeExperienceFixture('sales');
  fixture.individual.settings.defaultReport = 'restricted-report';
  fixture.individual.settings.favorites = ['sales-report', 'restricted-report', 'restricted-document'];
  fixture.individual.settings.contextualDocumentIds = ['revenue-definition', 'restricted-document'];
  const result = resolveExperience(fixture);
  assert.equal(result.effective.defaultReport, null);
  assert.deepEqual(result.effective.favorites, ['sales-report']);
  assert.deepEqual(result.effective.contextualDocumentIds, ['revenue-definition']);
  assert.equal(result.provenance.defaultReport.restrictedBy, 'access');
  assert.ok(!JSON.stringify(result).includes('restricted-report'));
  assert.ok(!JSON.stringify(result).includes('restricted-document'));
});

test('changed access removes previously visible resources, actions and Data Explorer despite locked preferences', () => {
  const fixture = makeExperienceFixture();
  assert.equal(resolveExperience(fixture).effective.dataExplorerEnabled, true);
  fixture.access.reportIds = [];
  fixture.access.documentIds = [];
  fixture.access.actionIds = ['expand'];
  fixture.access.moduleIds = ['home', 'reports'];
  const result = resolveExperience(fixture);
  assert.equal(result.effective.dataExplorerEnabled, false);
  assert.equal(result.provenance.dataExplorerEnabled.lockedBy, 'team');
  assert.equal(result.provenance.dataExplorerEnabled.restrictedBy, 'access');
  assert.deepEqual(result.effective.approvedActions, ['expand']);
  assert.deepEqual(result.effective.favorites, []);
  assert.deepEqual(result.effective.collectionResourceIds, []);
  assert.deepEqual(result.effective.contextualDocumentIds, []);
  assert.equal(result.effective.defaultReport, null);
  assert.ok(!result.effective.reportPanels.includes('ask-iq'));
  assert.ok(!result.effective.navigation.some(item => item.module === 'data-explorer'));
});

test('an inaccessible landing page falls back to observed navigation; empty access grants nothing', () => {
  const fixture = makeExperienceFixture();
  fixture.access.moduleIds = ['knowledge'];
  assert.equal(resolveExperience(fixture).effective.landingPage, 'knowledge');
  fixture.access = { moduleIds: [], actionIds: [], reportIds: [], documentIds: [] };
  const result = resolveExperience(fixture);
  assert.equal(result.effective.landingPage, null);
  assert.deepEqual(result.effective.navigation, []);
  assert.deepEqual(result.effective.approvedActions, []);
});

test('Data Explorer preferences cannot add an unavailable module or circumvent a department lock', () => {
  const fixture = makeExperienceFixture('sales');
  fixture.individual.settings.navigation = [
    { module: 'data-explorer', label: 'Run data' }, { module: 'home', label: 'Home' },
  ];
  fixture.individual.settings.landingPage = 'data-explorer';
  fixture.individual.settings.dataExplorerEnabled = true;
  const result = resolveExperience(fixture);
  assert.equal(result.effective.dataExplorerEnabled, false);
  assert.deepEqual(result.effective.navigation, [{ module: 'home', label: 'Home' }]);
  assert.equal(result.effective.landingPage, 'home');
});

test('administration, unknown modules and duplicate navigation are rejected', () => {
  for (const navigation of [
    [{ module: 'experience-settings', label: 'Admin' }],
    [{ module: 'usage-analytics', label: 'Usage' }],
    [{ module: 'unknown', label: 'Unknown' }],
    [{ module: 'home', label: 'Home' }, { module: 'home', label: 'Again' }],
    [{ module: 'home', label: '<script>' }], new Array(1),
  ]) {
    const fixture = makeExperienceFixture();
    fixture.individual.settings.navigation = navigation;
    assert.equal(resolveExperience(fixture).status, 'invalid');
  }
});

test('unsafe URL forms and markup are rejected even when an earlier lock would retain the safe value', () => {
  for (const helpRoute of [
    'javascript:alert(1)', 'data:text/html,hello', '//external.example', 'https://external.example/help',
    '/help?token=secret', '/help#private', '/%2e%2e/admin', '/help\\external', '/help/../admin',
  ]) {
    const fixture = makeExperienceFixture();
    fixture.individual.settings.helpRoute = helpRoute;
    const result = resolveExperience(fixture);
    assert.equal(result.status, 'invalid');
    assert.ok(!JSON.stringify(result).includes(helpRoute));
  }
});

test('access, identity, policy and scripts are never accepted as preference keys', () => {
  for (const key of ['access', 'roles', 'tenantId', 'authorization', 'disableServerChecks', 'scripts', '__proto__']) {
    const fixture = makeExperienceFixture();
    Object.defineProperty(fixture.individual.settings, key, { enumerable: true, value: 'private-sentinel' });
    const result = resolveExperience(fixture);
    assert.equal(result.status, 'invalid');
    assert.ok(!JSON.stringify(result).includes('private-sentinel'));
  }
});

test('malformed settings, locks and access contexts fail closed without effective output', () => {
  const mutations = [
    fixture => { delete fixture.organization.settings.layout; },
    fixture => { fixture.team.locks = ['themeAccent']; },
    fixture => { fixture.team.locks = ['dataExplorerEnabled', 'dataExplorerEnabled']; },
    fixture => { fixture.individual.locks = ['layout']; },
    fixture => { fixture.individual.settings.themeAccent = '#123456; url(evil)'; },
    fixture => { fixture.individual.settings.favorites = ['sales-report', 'sales-report']; },
    fixture => { fixture.individual.settings.favorites = new Array(1); },
    fixture => { fixture.individual.settings.dataExplorerEnabled = 'true'; },
    fixture => { fixture.individual.version = '<private>'; },
    fixture => { delete fixture.access; },
    fixture => { fixture.access = {}; },
    fixture => { fixture.access.moduleIds = ['admin']; },
    fixture => { fixture.access.reportIds = ['invalid/id']; },
    fixture => { fixture.access.extra = 'unexpected'; },
  ];
  for (const mutate of mutations) {
    const fixture = makeExperienceFixture();
    mutate(fixture);
    const result = resolveExperience(fixture);
    assert.equal(result.status, 'invalid');
    assert.equal(result.effective, undefined);
    assert.equal(result.experience_config_version, undefined);
  }
  for (const input of [undefined, null, [], {}, new Date()]) {
    assert.equal(resolveExperience(input).status, 'invalid');
  }
});

test('version is deterministic across object key order and changes with effective values or layer versions', () => {
  const fixture = makeExperienceFixture();
  const baseline = resolveExperience(fixture).experience_config_version;
  fixture.individual.settings = Object.fromEntries(Object.entries(fixture.individual.settings).reverse());
  assert.equal(resolveExperience(fixture).experience_config_version, baseline);
  fixture.individual.settings.layout = 'balanced';
  const changed = resolveExperience(fixture).experience_config_version;
  assert.notEqual(changed, baseline);
  fixture.individual.version = 'synthetic-preferences-v2';
  assert.notEqual(resolveExperience(fixture).experience_config_version, changed);
});

test('restoring a complete earlier configuration restores its version and output', () => {
  const fixture = makeExperienceFixture();
  const saved = structuredClone(fixture);
  const before = resolveExperience(fixture);
  fixture.team.version = 'synthetic-finance-v3';
  fixture.team.settings.landingPage = 'knowledge';
  assert.notEqual(resolveExperience(fixture).experience_config_version, before.experience_config_version);
  assert.deepEqual(resolveExperience(saved), before);
});

test('resolved presentation output cannot be reused as an access-bearing resolver input', () => {
  assert.equal(resolveExperience(resolveExperience(makeExperienceFixture())).status, 'invalid');
});
