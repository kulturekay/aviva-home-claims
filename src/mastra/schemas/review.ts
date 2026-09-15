import { z } from 'zod';

// Where a quoted piece of evidence came from. `ref` points into the source
// (a wording clause, a station name, a photo id, a DRN) so the UI can link the
// quote back to what it is quoting.
export const Evidence = z.object({
  source: z.enum(['wording', 'weather', 'report', 'customer', 'provenance', 'precedent']),
  ref: z.string(),
  quote: z.string(),
});
export type Evidence = z.infer<typeof Evidence>;

const Finding = z.object({
  finding: z.string(),
  evidence: z.array(Evidence),
  gaps: z.array(z.string()),
});

// The reviewer's structured output. Enums are kept strict (they carry the
// decision meaning and drive the gate and the guards). Free-text and array
// bounds are deliberately NOT hard-capped here: the verdict step truncates
// over-long prose and trims over-long arrays in code, so one extra list item
// or a 610-character paragraph never aborts a live run (eng review E6).
export const ReviewSchema = z.object({
  wordingVersion: z.string(),
  // Which version applied and why; mention previousVersion if the outcome would differ.
  wordingNote: z.string(),

  q1_stormConditions: Finding.extend({
    finding: z.enum(['yes', 'no', 'borderline', 'unknown']),
  }),
  q2_damageConsistent: Finding.extend({
    finding: z.enum(['yes', 'no', 'unknown']),
  }),
  q3_mainCause: Finding.extend({
    finding: z.enum(['storm', 'pre_existing', 'mixed', 'unknown']),
  }),

  adjusterReportQuality: z.object({
    photosOfCorrectProperty: z.boolean(),
    photosDated: z.boolean(),
    priorRepairsDocumented: z.boolean(),
    causationReasoned: z.boolean(),
    note: z.string(),
  }),

  // The verdict is a REVIEW value, never an action. There is no 'decline' here:
  // the reviewer reviews a recommendation, it cannot emit one. scopeGuard asserts
  // membership of this enum as its hard, non-prose check (T1 / ENG3).
  verdict: z.enum([
    'agree_decline',
    'disagree_decline',
    'agree_cash',
    'disagree_cash',
    'cannot_determine',
  ]),
  confidence: z.enum(['high', 'medium', 'low']),
  confidenceDrivers: z.array(z.string()),
  wouldChangeMind: z.array(z.string()),

  carveOuts: z.object({
    temporaryRepairPayable: z.enum(['likely', 'unlikely', 'n/a']),
    accidentalDamageInternal: z.enum(['consider', 'n/a']),
  }),
  consumerDutyChecks: z.object({
    vulnerabilityConsidered: z.boolean(),
    cashCriteriaMet: z.enum(['yes', 'no', 'n/a']),
    reasonsExplainable: z.boolean(),
  }),
  escalate: z.object({
    required: z.boolean(),
    to: z.array(z.enum(['counter_fraud', 'technical_lead', 'complaints'])),
    why: z.string(),
  }),

  // Cite only DRNs returned by findFosPrecedents this run. precedentGuard enforces this.
  citedDrns: z.array(z.string()),
  // Plain-English paragraph a handler could reuse in a letter. Soft-capped at ~600
  // chars by the verdict step (truncated, not rejected).
  draftParagraph: z.string(),
});

export type Review = z.infer<typeof ReviewSchema>;

// The set of verdict values that are review conclusions (used by scopeGuard).
export const REVIEW_VERDICTS = [
  'agree_decline',
  'disagree_decline',
  'agree_cash',
  'disagree_cash',
  'cannot_determine',
] as const;

export const DRAFT_PARAGRAPH_MAX = 600;
export const CONFIDENCE_DRIVERS_MAX = 4;
export const WOULD_CHANGE_MIND_MAX = 3;
