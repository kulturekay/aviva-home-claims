import type { Review } from '../schemas/review.ts';

// Deterministic scorer 1: verdict-class agreement. Full credit on an exact match;
// half credit if the review abstained (cannot_determine) on a case flagged
// borderline. Returns a NUMBER (0, 0.5 or 1) so it aggregates cleanly (Codex E8).
export function outcomeAgreement(expected: string, actual: string | undefined, borderline: boolean): number {
  if (!actual) return 0;
  if (actual === expected) return 1;
  if (borderline && actual === 'cannot_determine') return 0.5;
  return 0;
}

// Deterministic scorer 2: citation faithfulness. Every cited DRN must be one that
// was actually returned to this run; a fabricated or held-out DRN fails it. This
// is the honest replacement for outcome accuracy (ENG4 / T2).
export function citationFaithfulness(citedDrns: string[], returnedDrns: string[]): { score: number; offending: string[] } {
  const returned = new Set(returnedDrns);
  const offending = (citedDrns ?? []).filter((d) => !returned.has(d));
  return { score: offending.length === 0 ? 1 : 0, offending };
}

// LLM-judge scorer 3: decisive-fact recall. Runs on a NON-Anthropic model so the
// review is not graded by its own family. Returns PASS/FAIL + one sentence, or
// null when no judge key is set (the run then prints "skipped").
export async function decisiveFactRecall(
  review: Review,
  decisiveFactKeywords: string[],
  judge: { generate: (prompt: string) => Promise<string> } | null,
): Promise<{ pass: boolean; note: string } | null> {
  if (!judge) return null;
  const rubric = [
    'You are grading a home-insurance claim review. Question: does the review quote or clearly reference the fact the Ombudsman decision turned on?',
    `The decisive fact concerns: ${decisiveFactKeywords.join(', ')}.`,
    'Answer with PASS or FAIL on the first line, then one sentence of justification.',
    '',
    'REVIEW:',
    JSON.stringify({
      q1: review.q1_stormConditions,
      q2: review.q2_damageConsistent,
      q3: review.q3_mainCause,
      draftParagraph: review.draftParagraph,
    }),
  ].join('\n');
  const out = await judge.generate(rubric);
  const pass = /^\s*PASS/i.test(out);
  return { pass, note: out.split('\n').slice(0, 2).join(' ').slice(0, 200) };
}
