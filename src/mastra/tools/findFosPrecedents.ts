import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { loadPrecedents, type Precedent } from '../lib/loader.ts';

export type PrecedentSummary = {
  drn: string;
  insurer: string;
  damageType: string;
  outcome: Precedent['outcome'];
  weatherCited: string;
  decisiveFact: string;
  tags: string[];
};

// Eval holdout (T2/ENG9): the citation-faithfulness eval removes each case's
// controlling DRN from what the tool can return for that run, so the eval measures
// whether the reviewer reasons from what it was actually given rather than copying
// the answer key. Module-level because eval runs are sequential; the server path
// leaves it empty.
let HOLDOUT = new Set<string>();
export function setPrecedentHoldout(drns: string[]): void {
  HOLDOUT = new Set(drns);
}
export function clearPrecedentHoldout(): void {
  HOLDOUT = new Set();
}

// Shared, deterministic ranking used by BOTH the tool and the eval. A precedent
// matches on exact damage type (strong), a damage-family substring (weak), and tag
// overlap; ties break by DRN so the returned set is stable run to run.
export function queryPrecedents(
  damageType: string,
  tags: string[],
  opts: { holdout?: Set<string>; limit?: number } = {},
): PrecedentSummary[] {
  const holdout = opts.holdout ?? HOLDOUT;
  const limit = opts.limit ?? 5;
  const wantTags = new Set((tags ?? []).map((t) => t.toLowerCase()));
  const dt = (damageType ?? '').toLowerCase();

  return loadPrecedents()
    .filter((p) => !holdout.has(p.drn))
    .map((p) => {
      const pdt = p.damageType.toLowerCase();
      // Dispute pattern (tags) is weighted as heavily as damage type: an
      // Ombudsman decision on the same reasoning but different damage is more
      // relevant than one on the same damage with unrelated reasoning.
      const exact = pdt === dt ? 2 : 0;
      const family = !exact && dt && (pdt.includes(dt) || dt.includes(pdt)) ? 1 : 0;
      const overlap = p.tags.filter((t) => wantTags.has(t.toLowerCase())).length * 2;
      return { p, score: exact + family + overlap };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.drn.localeCompare(b.p.drn))
    .slice(0, limit)
    .map((x) => ({
      drn: x.p.drn,
      insurer: x.p.insurer,
      damageType: x.p.damageType,
      outcome: x.p.outcome,
      weatherCited: x.p.weatherCited,
      decisiveFact: x.p.decisiveFact,
      tags: x.p.tags,
    }));
}

const PrecedentSummaryOut = z.object({
  drn: z.string(),
  insurer: z.string(),
  damageType: z.string(),
  outcome: z.enum(['upheld', 'not_upheld', 'upheld_in_part']),
  weatherCited: z.string(),
  decisiveFact: z.string(),
  tags: z.array(z.string()),
});

export const findFosPrecedents = createTool({
  id: 'findFosPrecedents',
  description:
    'Returns up to 5 summarised Ombudsman decisions matching a damage type and dispute pattern (tags). Call after you have drafted Q1 to Q3, to test them against how the Ombudsman has ruled. This is the only source of DRNs: never cite a DRN you did not receive from this tool. It does not accept a free-text DRN lookup.',
  inputSchema: z.object({
    damageType: z.string().describe('e.g. roof_tiles, flat_roof, wall, cash_settlement'),
    tags: z.array(z.string()).describe('dispute-pattern tags, e.g. burden_of_proof, gusts_vs_mean, patch_repairs'),
  }),
  outputSchema: z.object({ precedents: z.array(PrecedentSummaryOut) }),
  execute: async (inputData) => {
    return { precedents: queryPrecedents(inputData.damageType, inputData.tags ?? []) };
  },
});
