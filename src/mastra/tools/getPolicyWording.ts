import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { loadWording } from '../lib/loader.ts';
import { Unavailable } from './common.ts';

const WordingOut = z.object({
  wordingId: z.string(),
  brand: z.string(),
  version: z.string(),
  discretionary: z.boolean(),
  stormDefinition: z.string(),
  exclusions: z.array(z.string()),
  cashSettlementClause: z.string(),
  previousVersion: z.string().optional(),
});

export const getPolicyWording = createTool({
  id: 'getPolicyWording',
  description:
    'Returns the storm definition, exclusions and cash-settlement clause of the wording in force at the last renewal. Always called first by the workflow; you will not need to call it.',
  inputSchema: z.object({ policyId: z.string() }),
  outputSchema: z.union([WordingOut, Unavailable]),
  execute: async (inputData) => {
    const w = loadWording(inputData.policyId);
    if (!w) {
      return { status: 'unavailable' as const, reason: `no wording on file for policyId ${inputData.policyId}` };
    }
    return {
      wordingId: w.id,
      brand: w.brand,
      version: w.version,
      discretionary: w.discretionary,
      stormDefinition: w.stormDefinition,
      exclusions: w.exclusions,
      cashSettlementClause: w.cashSettlementClause,
      ...(w.previousVersion ? { previousVersion: w.previousVersion } : {}),
    };
  },
});
