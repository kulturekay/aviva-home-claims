import '../lib/env.ts'; // load .env before anything reads process.env
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent } from '@mastra/core/agent';
import { mastra } from '../index.ts';
import type { Review } from '../schemas/review.ts';
import { setPrecedentHoldout, clearPrecedentHoldout } from '../tools/findFosPrecedents.ts';
import { outcomeAgreement, citationFaithfulness, decisiveFactRecall } from './scorers.ts';
import { AGENT_MODEL, JUDGE_MODEL, hasAgentKey, hasJudgeKey, bridgeJudgeKey } from '../lib/model.ts';

const fixtures = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures.json'), 'utf8'),
);

type CaseFixture = {
  caseId: string;
  expected: { verdict: string; decisiveFactKeywords: string[] };
  metadata: { controllingDrns: string[]; damageType: string; wordingDiscretionary: boolean; borderline: boolean };
};

bridgeJudgeKey();
const live = hasAgentKey(); // holdout is only meaningful when the model runs live
const judgeOn = hasJudgeKey();

const judge = judgeOn
  ? (() => {
      const a = new Agent({ id: 'judge', name: 'judge', instructions: 'You are a strict grader. Follow the rubric exactly.', model: JUDGE_MODEL });
      return { generate: async (prompt: string) => (await a.generate(prompt)).text ?? '' };
    })()
  : null;

async function runCase(fx: CaseFixture): Promise<{ review: Review | null; returnedDrns: string[] }> {
  const wf = mastra.getWorkflow('stormReview');
  const run = await wf.createRun();
  if (live && fx.metadata.controllingDrns.length) setPrecedentHoldout(fx.metadata.controllingDrns);
  try {
    const res: any = await run.start({ inputData: { caseId: fx.caseId } });
    const p = res.status === 'suspended' ? res.suspendPayload?.gate : res.result;
    return { review: (p?.review as Review) ?? null, returnedDrns: p?.returnedDrns ?? [] };
  } finally {
    clearPrecedentHoldout();
  }
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${Math.round((100 * n) / d)}%`;
}

async function main() {
  const cases = (fixtures as any).cases as CaseFixture[];
  console.log('storm-review evals (citation-faithfulness reframe)');
  console.log(`mode: ${live ? 'live model ' + AGENT_MODEL : 'golden-cache (no ANTHROPIC_API_KEY; leakage holdout is a live-mode check)'}`);
  console.log(`judge: ${judgeOn ? JUDGE_MODEL : 'skipped (no judge key)'}`);
  console.log('');

  const rows: any[] = [];
  const confBuckets: Record<string, { n: number; agree: number }> = { high: { n: 0, agree: 0 }, medium: { n: 0, agree: 0 }, low: { n: 0, agree: 0 } };
  let agreeSum = 0;
  let faithSum = 0;
  let judgePass = 0;
  let judgeScored = 0;
  let abstentions = 0;
  let wronglyUpheld = 0;
  const verdicts: Record<string, string> = {};

  for (const fx of cases) {
    const { review, returnedDrns } = await runCase(fx);
    const actual = review?.verdict;
    verdicts[fx.caseId] = actual ?? 'none';
    const agree = outcomeAgreement(fx.expected.verdict, actual, fx.metadata.borderline);
    const faith = review ? citationFaithfulness(review.citedDrns ?? [], returnedDrns) : { score: 0, offending: [] };
    agreeSum += agree;
    faithSum += faith.score;
    if (actual === 'cannot_determine') abstentions++;
    if (fx.expected.verdict === 'disagree_decline' && actual === 'agree_decline') wronglyUpheld++;

    const conf = review?.confidence;
    if (conf && confBuckets[conf]) {
      confBuckets[conf].n++;
      if (agree === 1) confBuckets[conf].agree++;
    }

    let judgeResult: { pass: boolean; note: string } | null = null;
    if (review) judgeResult = await decisiveFactRecall(review, fx.expected.decisiveFactKeywords, judge);
    if (judgeResult) {
      judgeScored++;
      if (judgeResult.pass) judgePass++;
    }

    rows.push({
      case: fx.caseId,
      expected: fx.expected.verdict,
      actual: actual ?? 'none',
      agreement: agree,
      faithful: faith.score === 1 ? 'yes' : `NO (${faith.offending.join(',')})`,
      decisiveFact: judgeResult ? (judgeResult.pass ? 'PASS' : 'FAIL') : 'skipped',
    });
  }

  console.table(rows);

  const n = cases.length;
  console.log('');
  console.log(`verdict-class agreement : ${pct(agreeSum, n)} (${agreeSum}/${n})`);
  console.log(`citation faithfulness   : ${pct(faithSum, n)} (${faithSum}/${n})`);
  console.log(`decisive-fact recall    : ${judgeScored ? `${pct(judgePass, judgeScored)} (${judgePass}/${judgeScored})` : 'skipped (no judge key)'}`);
  console.log(`abstentions             : ${abstentions}`);
  console.log('confidence buckets      :');
  for (const k of ['high', 'medium', 'low']) {
    const b = confBuckets[k];
    console.log(`  ${k.padEnd(6)} n=${b.n} agreement=${pct(b.agree, b.n)}`);
  }

  // Paired-variant regression: the source-unavailable variant of A must abstain.
  const pr = (fixtures as any).pairedRegression;
  const prPass = verdicts[pr.base] === 'disagree_decline' && verdicts[pr.variant] === 'cannot_determine';
  console.log('');
  console.log(`paired regression (${pr.base} vs ${pr.variant}): ${prPass ? 'PASS' : 'FAIL'} (${pr.base}=${verdicts[pr.base]}, ${pr.variant}=${verdicts[pr.variant]})`);
  console.log('');
  console.log(`NORTH STAR - wrongly upheld declines: ${wronglyUpheld}`);
  console.log('Merge rule: no prompt or model change ships if the north-star count rises on this suite.');

  process.exit(0);
}

main().catch((e) => {
  console.error('eval run failed:', e);
  process.exit(1);
});
