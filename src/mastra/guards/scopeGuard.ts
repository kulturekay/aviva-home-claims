import { REVIEW_VERDICTS, type Review } from '../schemas/review.ts';

// scopeGuard (output check). The HARD guarantee is structural: the verdict must
// be one of the review enum values. The reviewer reviews a recommendation and can
// never emit "decline" as an action, so no action verdict can pass.
//
// T1 / ENG3: the original spec failed the step whenever the word "decline"
// appeared in draftParagraph. That is wrong: every legitimate paragraph about a
// decline recommendation contains "decline" (it breaks the hero case). The prose
// check here is NON-FATAL and narrow: it only warns on an imperative directive to
// decline the claim as an action, never on discussion of whether a decline holds.

const ACTION_DIRECTIVE_RE =
  /\b(?:i\s+)?(?:recommend|advise|instruct|direct|hereby)\b[^.?!]*\b(?:decline|reject|refuse)\b[^.?!]*\bclaim\b/i;

export type ScopeCheck = { ok: boolean; fatal: boolean; warnings: string[] };

export function checkScope(review: Pick<Review, 'verdict' | 'draftParagraph'>): ScopeCheck {
  const warnings: string[] = [];
  const verdictOk = (REVIEW_VERDICTS as readonly string[]).includes(review.verdict);
  if (!verdictOk) {
    return {
      ok: false,
      fatal: true,
      warnings: [`verdict "${review.verdict}" is not a review value; the reviewer never emits an action`],
    };
  }
  if (ACTION_DIRECTIVE_RE.test(review.draftParagraph ?? '')) {
    warnings.push(
      'draftParagraph reads as an imperative decline directive; the reviewer reviews recommendations, it does not issue them',
    );
  }
  return { ok: true, fatal: false, warnings };
}
