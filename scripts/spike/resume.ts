// ENG2 spike, phase 2: a BRAND NEW process. It has never seen the run object.
// It rehydrates the run purely from LibSQL by runId (createRun({ runId })), then
// resumes it. Success here is the proof the demo's restart-resume story rests on.
import { readFileSync } from 'node:fs';
import { mastra, RUNID_FILE } from './shared.ts';

const runId = readFileSync(RUNID_FILE, 'utf8').trim();
console.log(`[resume] rehydrating runId: ${runId}`);

const wf = mastra.getWorkflow('spike');
// createRun with an existing runId loads the persisted snapshot from storage.
const run = await wf.createRun({ runId });
const res = await run.resume({
  step: 'gate',
  resumeData: { decision: 'override', reason: 'Decline not defensible; burden not discharged.' },
});

console.log(`[resume] status: ${res.status}`);
if (res.status !== 'success') {
  console.error(`[resume] FAIL: expected 'success', got '${res.status}'`);
  console.error(JSON.stringify(res, null, 2));
  process.exit(1);
}
console.log(`[resume] result:`, JSON.stringify((res as any).result));
console.log(`[resume] PASS: run resumed to completion in a separate process.`);
process.exit(0);
