// precedentGuard (output check): every cited DRN must be one that was actually
// RETURNED to this run by findFosPrecedents, not merely present in the store.
// ENG4: a store-membership check would pass a real-but-unretrieved DRN, which
// still violates "never cite a DRN you have not received from the tool".

export type PrecedentCheck = { ok: boolean; offending: string[]; returned: string[] };

export function checkPrecedents(citedDrns: string[], returnedDrns: string[]): PrecedentCheck {
  const returned = new Set(returnedDrns);
  const offending = citedDrns.filter((drn) => !returned.has(drn));
  return { ok: offending.length === 0, offending, returned: [...returned] };
}
