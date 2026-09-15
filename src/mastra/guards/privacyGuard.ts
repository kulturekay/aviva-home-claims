// privacyGuard: pseudonymise personal data in untrusted narrative before it
// reaches the agent. Best-effort, defence-in-depth (the data is already local).
// Truncates full UK postcodes to their outward district and redacts titled names.

const FULL_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/g;
const TITLED_NAME_RE = /\b(Mr|Mrs|Ms|Miss|Dr|Mx)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g;

export type PrivacyResult = { clean: string; redactions: number };

export function pseudonymise(text: string): PrivacyResult {
  if (!text) return { clean: text, redactions: 0 };
  let redactions = 0;
  let clean = text.replace(FULL_POSTCODE_RE, (_m, district: string) => {
    redactions++;
    return district;
  });
  clean = clean.replace(TITLED_NAME_RE, () => {
    redactions++;
    return '[customer]';
  });
  return { clean, redactions };
}
