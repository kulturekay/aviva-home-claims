// ENG2 spike (throwaway): verify Mastra restart-resume across a real process boundary.
// Not part of the demo. Kept in-tree as executable proof that the API works as the
// build depends on. Run with:  npm run spike:suspend  then  npm run spike:resume
import path from 'node:path';
import { Mastra } from '@mastra/core';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

// Absolute DB path so the suspend process and the (separate) resume process
// resolve file:./... to the SAME sqlite file regardless of how they are launched.
// This is ENG2's core hazard: a relative url + two cwds = two different files.
export const DB_PATH = path.join(process.cwd(), 'spike.db');
export const RUNID_FILE = path.join(process.cwd(), '.spike-runid');

// A gate step that models ENG1: branch on validated resumeData FIRST and return;
// only suspend when there is no resume payload. Re-checking a "needsHuman"
// condition before this branch is what makes a resumed run suspend forever.
const gate = createStep({
  id: 'gate',
  inputSchema: z.object({ claimId: z.string() }),
  suspendSchema: z.object({ reason: z.string() }),
  resumeSchema: z.object({
    decision: z.enum(['approve', 'override', 'escalate']),
    reason: z.string(),
  }),
  outputSchema: z.object({
    claimId: z.string(),
    decision: z.string(),
    reason: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (resumeData) {
      return {
        claimId: inputData.claimId,
        decision: resumeData.decision,
        reason: resumeData.reason,
      };
    }
    return await suspend({ reason: `Human sign-off required for ${inputData.claimId}` });
  },
});

export const spikeWorkflow = createWorkflow({
  id: 'spike',
  inputSchema: z.object({ claimId: z.string() }),
  outputSchema: z.object({
    claimId: z.string(),
    decision: z.string(),
    reason: z.string(),
  }),
})
  .then(gate)
  .commit();

export const mastra = new Mastra({
  storage: new LibSQLStore({ id: 'spike-store', url: `file:${DB_PATH}` }),
  workflows: { spike: spikeWorkflow },
});
