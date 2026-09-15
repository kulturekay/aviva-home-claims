import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve every path from THIS file's location, never from process.cwd(). A
// cwd-relative data/ or file:./mastra.db breaks when the server, the CLI, and a
// resume process are launched from different directories (DX X6, ENG E2).
const here = path.dirname(fileURLToPath(import.meta.url)); // <root>/src/mastra/lib
export const PROJECT_ROOT = path.resolve(here, '..', '..', '..'); // <root>

export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const AUDIT_DIR = path.join(PROJECT_ROOT, 'audit');
export const NOTES_DIR = path.join(AUDIT_DIR, 'notes');
export const AUDIT_LOG = path.join(AUDIT_DIR, 'log.jsonl');
export const GOLDEN_DIR = path.join(PROJECT_ROOT, 'golden');

// Absolute libsql url so the serve process and any resume process open the SAME
// sqlite file (the restart-resume acceptance test depends on this).
export const DB_PATH = path.join(PROJECT_ROOT, 'mastra.db');
export const DB_URL = `file:${DB_PATH}`;
