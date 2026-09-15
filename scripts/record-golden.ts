// npm run golden <caseId> - record a canonical golden run from a LIVE model call
// and write it to golden/case<caseId>.json. Needs ANTHROPIC_API_KEY. The demo
// then replays this cached run with zero keys, so it never depends on a live call.
import fs from 'node:fs';
import path from 'node:path';
import { GOLDEN_DIR } from '../src/mastra/lib/paths.ts';
import { hasAgentKey, AGENT_MODEL } from '../src/mastra/lib/model.ts';

const caseId = process.argv[2] ?? 'A';

if (!hasAgentKey()) {
  console.error('record-golden needs ANTHROPIC_API_KEY (this records a LIVE model call).');
  console.error('Set it in .env, then: npm run golden ' + caseId);
  process.exit(1);
}

// Force the live path even though a golden file already exists.
process.env.USE_GOLDEN = '0';
const { mastra } = await import('../src/mastra/index.ts');

const wf = mastra.getWorkflow('stormReview');
const run = await wf.createRun();
const res: any = await run.start({ inputData: { caseId } });
const p = res.status === 'suspended' ? res.suspendPayload?.gate : res.result;
if (!p?.review) {
  console.error(`no review produced for case ${caseId} (status ${res.status}). Not overwriting the golden file.`);
  console.error(p?.guard?.blockReason ?? '');
  process.exit(1);
}

const out = {
  caseId,
  claimId: p.claimId,
  recordedFrom: `live ${AGENT_MODEL} at ${new Date().toISOString()}`,
  returnedDrns: p.returnedDrns ?? [],
  toolCalls: p.toolCalls ?? [],
  review: p.review,
};
const file = path.join(GOLDEN_DIR, `case${caseId}.json`);
fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(`recorded golden run for Case ${caseId} -> ${file}`);
console.log(`verdict ${p.review.verdict} (${p.review.confidence}); cited ${JSON.stringify(p.review.citedDrns)}`);
process.exit(0);
