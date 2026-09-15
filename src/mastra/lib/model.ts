// Model configuration. IDs are Mastra provider/model strings; the exact suffix
// moves over time, so both are overridable via env and confirmed by `npm run doctor`.
//
// The agent + verdict stay in the Anthropic family so `dev`/`serve`/`demo` need
// only ONE key (ANTHROPIC_API_KEY). The eval judge is deliberately a DIFFERENT
// family (OpenAI) so decisive-fact recall is not graded by the same model that
// produced the review.

export const AGENT_MODEL = process.env.AGENT_MODEL || 'anthropic/claude-sonnet-4-5';
export const JUDGE_MODEL = process.env.JUDGE_MODEL || 'openai/gpt-4.1-mini';

export function hasAgentKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Mastra's model router reads OPENAI_API_KEY for openai/* strings. We also accept
// JUDGE_API_KEY as a friendlier name and bridge it across.
export function hasJudgeKey(): boolean {
  return Boolean(process.env.JUDGE_API_KEY || process.env.OPENAI_API_KEY);
}

export function bridgeJudgeKey(): void {
  if (process.env.JUDGE_API_KEY && !process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = process.env.JUDGE_API_KEY;
  }
}
