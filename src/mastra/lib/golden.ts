import fs from 'node:fs';
import path from 'node:path';
import { GOLDEN_DIR } from './paths.ts';

export type GoldenRun = {
  caseId: string;
  claimId: string;
  review: unknown;
  toolCalls: Array<{ tool: string; args: unknown; resultSummary: string }>;
  returnedDrns: string[];
};

export function loadGolden(caseId: string): GoldenRun | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, `case${caseId}.json`), 'utf8')) as GoldenRun;
  } catch {
    return null;
  }
}

// Whether the review step should serve the cached golden run instead of calling
// the model. Default: golden when there is no agent key, so the hero demo runs
// with ZERO keys and never depends on a live call landing (CEO T6 / DX X1).
//   USE_GOLDEN=1  force cache (deterministic demo even with a key present)
//   USE_GOLDEN=0  force live model
export function shouldUseGolden(): boolean {
  if (process.env.USE_GOLDEN === '1') return true;
  if (process.env.USE_GOLDEN === '0') return false;
  return !process.env.ANTHROPIC_API_KEY;
}
