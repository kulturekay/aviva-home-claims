// ENG2 spike, phase 1: start a run, drive it to `suspended`, persist the runId,
// then HARD-EXIT the process. All in-memory run state is destroyed on exit; only
// what Mastra wrote to LibSQL survives into the resume process.
import { writeFileSync } from 'node:fs';
import { mastra, DB_PATH, RUNID_FILE } from './shared.ts';

const wf = mastra.getWorkflow('spike');
const run = await wf.createRun();
const res = await run.start({ inputData: { claimId: 'CLAIM-A' } });

console.log(`[suspend] db          : ${DB_PATH}`);
console.log(`[suspend] runId       : ${run.runId}`);
console.log(`[suspend] status      : ${res.status}`);

if (res.status !== 'suspended') {
  console.error(`[suspend] FAIL: expected 'suspended', got '${res.status}'`);
  process.exit(1);
}

console.log(`[suspend] suspendPayload:`, JSON.stringify((res as any).suspendPayload));
writeFileSync(RUNID_FILE, run.runId, 'utf8');
console.log(`[suspend] runId written to ${RUNID_FILE}`);
console.log(`[suspend] hard-exiting to simulate a killed server ->`);
process.exit(0);
