import path from 'node:path';
import { PROJECT_ROOT } from './paths.ts';

// Load .env from the project root into process.env. tsx does NOT auto-load .env,
// so serve/demo/evals/doctor (which run under tsx) would otherwise ignore it and
// stay in golden-cache mode even after you set ANTHROPIC_API_KEY. `mastra dev`
// loads .env on its own, but this makes every entry point behave the same.
// A missing .env is expected and fine: that is zero-key golden mode.
try {
  process.loadEnvFile(path.join(PROJECT_ROOT, '.env'));
} catch {
  /* no .env present: golden-cache mode */
}
