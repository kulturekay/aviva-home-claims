import fs from 'node:fs';
import path from 'node:path';
import { AUDIT_LOG, NOTES_DIR } from './paths.ts';

// mkdir -p the audit directories so appending on a clean clone never throws
// ENOENT (DX X6). Creating NOTES_DIR creates AUDIT_DIR too.
export function ensureAuditDirs(): void {
  fs.mkdirSync(NOTES_DIR, { recursive: true });
}

export type AuditEntry = {
  ts: string;
  runId: string;
  caseId: string;
  claimId: string;
  inputs: { wordingId: string; weatherStatus: string };
  toolCalls: unknown[];
  review: unknown;
  decision: string;
  reason: string;
  failureMode?: string;
  domainNote?: string;
  model: string;
  promptVersion: string;
  guard: unknown;
};

export function appendAudit(entry: AuditEntry): void {
  ensureAuditDirs();
  fs.appendFileSync(AUDIT_LOG, `${JSON.stringify(entry)}\n`, 'utf8');
}

export function writeClaimNote(claimId: string, runId: string, text: string): string {
  ensureAuditDirs();
  // Named by claim AND run so a re-run never overwrites an earlier note (ENG9).
  const p = path.join(NOTES_DIR, `${claimId}-${runId}.txt`);
  fs.writeFileSync(p, text, 'utf8');
  return p;
}

export function readAudit(): AuditEntry[] {
  try {
    return fs
      .readFileSync(AUDIT_LOG, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as AuditEntry);
  } catch {
    return [];
  }
}
