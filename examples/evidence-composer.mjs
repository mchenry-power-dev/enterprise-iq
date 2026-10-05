import { pathToFileURL } from 'node:url';
import { makeFixture, SCENARIOS } from './fixtures.mjs';
import { composeAnswer } from './evidence-composer-core.mjs';
export { composeAnswer } from './evidence-composer-core.mjs';

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const scenario = process.argv[2] ?? 'baseline';
  if (scenario === '--help') {
    console.log(`Usage: node examples/evidence-composer.mjs [${SCENARIOS.join('|')}]`);
  } else if (!SCENARIOS.includes(scenario)) {
    console.error('Unknown scenario. Run with --help for the supported synthetic scenarios.');
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(composeAnswer(makeFixture(scenario)), null, 2));
  }
}
