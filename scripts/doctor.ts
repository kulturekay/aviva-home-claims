// npm run doctor - preflight. Checks Node, keys, that the Mastra instance
// constructs, and that every case's fixtures (and golden run) are present.
// Exits 0 when the demo can run (golden mode needs no keys); warns otherwise.
import '../src/mastra/lib/env.ts'; // load .env before anything reads process.env
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, GOLDEN_DIR } from '../src/mastra/lib/paths.ts';
import { loadCases, loadWording, loadWeather, loadReport, loadCustomer } from '../src/mastra/lib/loader.ts';
import { hasAgentKey, hasJudgeKey, AGENT_MODEL, JUDGE_MODEL } from '../src/mastra/lib/model.ts';

let warns = 0;
let fails = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const warn = (m: string) => { console.log(`  warn ${m}`); warns++; };
const fail = (m: string) => { console.log(`  FAIL ${m}`); fails++; };

console.log('storm-review doctor\n');

console.log('runtime:');
const major = Number(process.versions.node.split('.')[0]);
major >= 22 ? ok(`node ${process.versions.node}`) : fail(`node ${process.versions.node} (need >= 22)`);

console.log('\nkeys (per the command-to-key table in .env.example):');
hasAgentKey()
  ? ok(`ANTHROPIC_API_KEY set - live runs use ${AGENT_MODEL}`)
  : warn(`ANTHROPIC_API_KEY not set - dev/serve/demo run from the cached golden run (zero-key). Set it for live runs.`);
hasJudgeKey()
  ? ok(`judge key set - evals grade decisive-fact recall with ${JUDGE_MODEL}`)
  : warn('no judge key - evals run the deterministic scorers and skip the LLM judge line.');

console.log('\nfixtures (each case needs wording, weather, report, customer, golden):');
const cases = loadCases();
if (!cases.length) fail('no cases in data/cases.json');
for (const c of cases) {
  const problems: string[] = [];
  if (!loadWording(c.policyId)) problems.push(`wording ${c.policyId}`);
  const w = loadWeather(c.postcodeDistrict, c.dateOfLoss);
  if (!w) problems.push(`weather ${c.postcodeDistrict}/${c.dateOfLoss}`);
  if (!loadReport(c.claimId)) problems.push(`report ${c.claimId}`);
  if (!loadCustomer(c.customerId)) problems.push(`customer ${c.customerId}`);
  if (!fs.existsSync(path.join(GOLDEN_DIR, `case${c.id}.json`))) problems.push(`golden case${c.id}.json`);
  problems.length ? fail(`Case ${c.id}: missing ${problems.join(', ')}`) : ok(`Case ${c.id} (${c.claimId}) complete`);
}

console.log('\nprecedent store:');
try {
  const p = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'precedents.json'), 'utf8'));
  Array.isArray(p) && p.length === 17 ? ok(`17 precedents loaded`) : warn(`expected 17 precedents, found ${p.length}`);
} catch {
  fail('could not read data/precedents.json');
}

console.log('\nmastra instance:');
try {
  const { mastra } = await import('../src/mastra/index.ts');
  const wf = mastra.getWorkflow('stormReview');
  const agent = mastra.getAgent('reviewer');
  wf && agent ? ok('constructs; workflow "stormReview" and agent "reviewer" registered') : fail('workflow or agent missing');
} catch (e) {
  fail(`Mastra instance failed to construct: ${e instanceof Error ? e.message : String(e)}`);
}

console.log('');
if (fails) {
  console.log(`doctor: ${fails} failure(s), ${warns} warning(s). Fix the failures before running.`);
  process.exit(1);
}
console.log(`doctor: ready. ${warns} warning(s). Try: npm run demo, then npm run serve.`);
process.exit(0);
