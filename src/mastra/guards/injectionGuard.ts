// injectionGuard: best-effort removal of instruction-shaped text from untrusted
// narratives (adjuster report, customer text). This is defence-in-depth, NOT the
// primary control. The primary control is that the agent has no outbound channel
// (the third leg of the lethal trifecta is removed), so even a successful injection
// cannot exfiltrate or act. See README. Honest framing per CEO decision 8.

const INJECTION_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /ignore\s+(all\s+)?(your\s+)?(previous|prior|above|earlier)\s+instructions/i, label: 'ignore-previous-instructions' },
  { re: /disregard\s+(all\s+)?(the\s+)?(previous|prior)?\s*(instructions|rules|guidance|guidelines)/i, label: 'disregard-instructions' },
  { re: /\byou must\b/i, label: 'imperative-you-must' },
  { re: /recommend\s+(payment|approval|approve|paying|to pay|settlement in full|in full)/i, label: 'recommend-payment' },
  { re: /\bapprove\s+(my|the|this)\s+claim\b/i, label: 'approve-claim' },
  { re: /\bsystem\s*:/i, label: 'fake-system-prompt' },
  { re: /\bnew instructions\b/i, label: 'new-instructions' },
];

export type InjectionRemoval = { fragment: string; label: string };
export type InjectionResult = { clean: string; removed: InjectionRemoval[] };

// Split on sentence boundaries so a single injected sentence embedded in an
// otherwise legitimate paragraph can be excised without discarding the rest.
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/);
}

export function sanitizeNarrative(text: string): InjectionResult {
  if (!text) return { clean: text, removed: [] };
  const removed: InjectionRemoval[] = [];
  const kept = splitSentences(text).filter((sentence) => {
    const hit = INJECTION_PATTERNS.find((p) => p.re.test(sentence));
    if (hit) {
      removed.push({ fragment: sentence.trim(), label: hit.label });
      return false;
    }
    return true;
  });
  let clean = kept.join(' ').replace(/\s+/g, ' ').trim();
  if (removed.length > 0) {
    clean = `${clean} [${removed.length} instruction-shaped fragment(s) removed by injectionGuard]`.trim();
  }
  return { clean, removed };
}
