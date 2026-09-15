import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mastra } from './index.ts';

// Runs in golden-cache mode (no key) so it is deterministic in CI. Covers the
// hero path: prefetch -> review -> guard -> gate(suspend) -> resume -> record.
test('Case A: suspends with disagree_decline, guards pass, resume writes an audit line', async () => {
  process.env.USE_GOLDEN = '1';
  const wf = mastra.getWorkflow('stormReview');
  const run = await wf.createRun();
  const res: any = await run.start({ inputData: { caseId: 'A' } });

  assert.equal(res.status, 'suspended');
  const p = res.suspendPayload.gate;
  assert.equal(p.review.verdict, 'disagree_decline');
  assert.equal(p.review.confidence, 'high');
  // Golden runs are recorded from a live (nondeterministic) model, so assert the
  // invariant, not exact DRNs: it cited at least one precedent and the guard
  // confirmed every cited DRN was actually returned this run (no fabrication).
  assert.ok(Array.isArray(p.review.citedDrns) && p.review.citedDrns.length > 0, 'cites at least one precedent');
  assert.equal(p.guard.precedent.ok, true, 'every cited DRN was returned this run');
  assert.equal(p.guard.blocked, false);

  const res2: any = await run.resume({
    step: 'gate',
    resumeData: { decision: 'override', reason: 'burden not discharged', failureMode: 'reasoning' },
  });
  assert.equal(res2.status, 'success');
  assert.equal(res2.result.audit.audited, true);
  assert.equal(res2.result.audit.decision, 'override');
});

test('Case E: abstains (cannot_determine) with Q1 unknown and no invented wind', async () => {
  process.env.USE_GOLDEN = '1';
  const wf = mastra.getWorkflow('stormReview');
  const run = await wf.createRun();
  const res: any = await run.start({ inputData: { caseId: 'E' } });
  assert.equal(res.status, 'suspended');
  const rev = res.suspendPayload.gate.review;
  assert.equal(rev.verdict, 'cannot_determine');
  assert.equal(rev.q1_stormConditions.finding, 'unknown');
});
