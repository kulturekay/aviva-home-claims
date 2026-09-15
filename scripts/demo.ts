// npm run demo - the hello-world moment. Fires the hero case (A) end to end,
// prints the verdict and the suspend reason, and points at the trace + UI.
import { mastra } from '../src/mastra/index.ts';
import { shouldUseGolden } from '../src/mastra/lib/golden.ts';

const caseId = process.argv[2] ?? 'A';
console.log(`storm-review demo - Case ${caseId} [${shouldUseGolden() ? 'golden-cache, zero-key' : 'live model'}]\n`);

const wf = mastra.getWorkflow('stormReview');
const run = await wf.createRun();
const res: any = await run.start({ inputData: { caseId } });

if (res.status === 'suspended') {
  const p = res.suspendPayload?.gate ?? {};
  const rev = p.review;
  console.log(`verdict     : ${rev?.verdict}  (confidence ${rev?.confidence})`);
  console.log(`Q1/Q2/Q3    : ${rev?.q1_stormConditions?.finding} / ${rev?.q2_damageConsistent?.finding} / ${rev?.q3_mainCause?.finding}`);
  console.log(`cited DRNs  : ${(rev?.citedDrns ?? []).join(', ') || 'none'}`);
  console.log(`guards      : precedent=${p.guard?.precedent?.ok ? 'ok' : 'BLOCKED'} scope=${p.guard?.scope?.ok ? 'ok' : 'BLOCKED'}`);
  console.log(`tool calls  : ${(p.toolCalls ?? []).map((t: any) => t.tool).join(' -> ')}`);
  console.log(`\nSUSPENDED for a human: ${p.reason}`);
  console.log(`run id      : ${run.runId}`);
  console.log('\nnext:');
  console.log('  - open the UI:      npm run serve   then  http://localhost:8787');
  console.log('  - see the trace:    npm run dev     then  http://localhost:4111  (Mastra Studio, Observability tab)');
  console.log('  - the audit line is written after a human approves/overrides in the UI.');
} else {
  console.log(`status: ${res.status}`);
  console.log(JSON.stringify(res.result ?? res, null, 2).slice(0, 800));
}
process.exit(0);
