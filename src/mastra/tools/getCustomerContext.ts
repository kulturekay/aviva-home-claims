import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { loadCustomer } from '../lib/loader.ts';
import { Unavailable } from './common.ts';

const CustomerOut = z.object({
  vulnerabilityFlag: z.boolean(),
  vulnerabilityCategory: z.enum(['health', 'life_event', 'resilience', 'capability']).optional(),
  tenureYears: z.number(),
  priorClaims: z.number(),
  ageBand: z.string(),
});

export const getCustomerContext = createTool({
  id: 'getCustomerContext',
  description:
    'Returns the vulnerability flag and category, tenure and prior claims. Never returns free-text notes. Call whenever the recommendation is a cash settlement or the narrative mentions the customer circumstances.',
  inputSchema: z.object({ customerId: z.string() }),
  outputSchema: z.union([CustomerOut, Unavailable]),
  execute: async (inputData) => {
    const c = loadCustomer(inputData.customerId);
    if (!c) {
      return { status: 'unavailable' as const, reason: `no customer record on file for ${inputData.customerId}` };
    }
    return {
      vulnerabilityFlag: c.vulnerabilityFlag,
      ...(c.vulnerabilityCategory ? { vulnerabilityCategory: c.vulnerabilityCategory } : {}),
      tenureYears: c.tenureYears,
      priorClaims: c.priorClaims,
      ageBand: c.ageBand,
    };
  },
});
