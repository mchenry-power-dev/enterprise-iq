import test from 'node:test';
import assert from 'node:assert/strict';
import { runWorkingExperience } from '../examples/working-experience.mjs';
import { makeQueryFixture } from '../examples/query-fixtures.mjs';
import { makeExperienceFixture } from '../examples/experience-fixtures.mjs';

test('integrated query supplies derived credits to separately authorized reconciliation', () => {
  const result = runWorkingExperience();
  assert.deepEqual(result.query.states, ['pending', 'running', 'succeeded']);
  assert.equal(result.query.starts, 1);
  assert.equal(result.query.pages.length, 2);
  assert.equal(result.query.displayedCreditsCents, 16_000_000);
  assert.equal(result.answer.status, 'reconciled');
  assert.ok(result.journey.events.every(event => event.experience_config_version === result.configuration.experience_config_version));
  assert.equal(result.journey.events.filter(event => event.event_name === 'query_completed').length, 1);
  assert.equal(result.journey.events.filter(event => event.event_name === 'query_results_viewed').length, 2);
  assert.equal(result.journey.collection.rejected, 0);
  assert.equal(result.journey.metrics.status, 'suppressed');
});

test('changed query records change both displayed amount and composer conclusion', () => {
  const queryFixture = makeQueryFixture();
  queryFixture.source.rows[1].amountCents = 2_000_000;
  const result = runWorkingExperience({ queryFixture });
  assert.equal(result.query.displayedCreditsCents, 12_000_000);
  assert.equal(result.answer.status, 'unreconciled');
  assert.equal(result.answer.calculation.amounts.creditsCents, 12_000_000);
});

test('revoked query entitlement produces neither viewed-result event nor reconciliation', () => {
  const queryFixture = makeQueryFixture();
  queryFixture.policy.grants = [];
  const result = runWorkingExperience({ queryFixture });
  assert.equal(result.query.starts, 0);
  assert.deepEqual(result.query.pages, []);
  assert.equal(result.answer.status, 'insufficient_support');
  assert.ok(!result.journey.events.some(event => ['query_completed', 'query_results_viewed'].includes(event.event_name)));
});

test('disabled telemetry leaves permitted query and answer available with no analytics emission', () => {
  const result = runWorkingExperience({ telemetryEnabled: false });
  assert.equal(result.answer.status, 'reconciled');
  assert.equal(result.query.displayedCreditsCents, 16_000_000);
  assert.deepEqual(result.journey.events, []);
  assert.equal(result.separateSyntheticCohort, null);
});

test('nonessential telemetry clock failure does not block permitted work', () => {
  const result = runWorkingExperience({ telemetryClock: () => { throw new Error('Unavailable analytics'); } });
  assert.equal(result.answer.status, 'reconciled');
  assert.equal(result.query.pages.length, 2);
  assert.deepEqual(result.journey.events, []);
  assert.ok(result.journey.collection.unavailable > 0);
});

test('changed experience configuration flows to all integrated event versions', () => {
  const original = runWorkingExperience();
  const experienceFixture = makeExperienceFixture();
  experienceFixture.individual.settings.themeDensity = 'comfortable';
  const changed = runWorkingExperience({ experienceFixture });
  assert.notEqual(changed.configuration.experience_config_version, original.configuration.experience_config_version);
  assert.ok(changed.journey.events.every(event => event.experience_config_version === changed.configuration.experience_config_version));
  assert.equal(changed.query.displayedCreditsCents, original.query.displayedCreditsCents);
});

test('query permission renewal does not revive expired document/context authorization', () => {
  const queryFixture = makeQueryFixture();
  queryFixture.now = '2026-10-03T14:00:00Z';
  queryFixture.policy.expiresAt = '2026-10-03T15:00:00Z';
  const result = runWorkingExperience({ queryFixture });
  assert.equal(result.query.displayedCreditsCents, 16_000_000);
  assert.equal(result.answer.status, 'insufficient_support');
  assert.deepEqual(result.answer.citations, []);
});

test('permitted task landing pages use compatible telemetry module IDs', () => {
  for (const landingPage of ['data-explorer', 'ask-iq']) {
    const experienceFixture = makeExperienceFixture();
    experienceFixture.individual.settings.landingPage = landingPage;
    const result = runWorkingExperience({ experienceFixture });
    assert.equal(result.journey.collection.rejected, 0);
    assert.equal(result.journey.events.find(event => event.event_name === 'workspace_viewed').parameters.module, landingPage);
  }
});
