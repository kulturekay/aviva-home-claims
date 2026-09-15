import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths.ts';
import { sanitizeNarrative, type InjectionRemoval } from '../guards/injectionGuard.ts';
import { pseudonymise } from '../guards/privacyGuard.ts';

// ----- raw fixture types (shape of the JSON on disk) -----

export type Wording = {
  id: string;
  brand: string;
  version: string;
  effectiveFrom: string;
  discretionary: boolean;
  stormDefinition: string;
  exclusions: string[];
  cashSettlementClause: string;
  previousVersion?: string;
};

export type WeatherStation = {
  name: string;
  distanceKm: number;
  meanWindMph: number;
  maxGustMph: number;
  maxRainMmPerHr: number;
  snowCm: number;
};

export type WeatherReport = {
  postcodeDistrict: string;
  dateOfLoss: string;
  window: { from: string; to: string };
  namedStorm: string | null;
  status: 'ok' | 'unavailable';
  reason?: string;
  stations: WeatherStation[];
};

export type Photo = {
  id: string;
  description: string;
  taken: 'ground' | 'roof' | 'customer';
  dated: boolean;
  exifPresent: boolean;
  showsPriorRepair: boolean;
};

export type AdjusterReport = {
  claimId: string;
  author: { type: 'desk' | 'field' | 'tpa'; firm: string };
  recommendation: 'decline' | 'cash_settle';
  statedReason: string;
  narrative: string;
  photos: Photo[];
  priorRepairsObserved: boolean;
  causationReasoned: boolean;
  cashAmount?: number;
  cashBasis?: 'network_rates' | 'customer_quotes';
  customerEmergencyRepairCost?: number;
  // Populated by the loader after guards run; never on disk.
  guardEvents?: { injectionRemoved: InjectionRemoval[]; privacyRedactions: number };
};

export type Customer = {
  customerId: string;
  vulnerabilityFlag: boolean;
  vulnerabilityCategory?: 'health' | 'life_event' | 'resilience' | 'capability';
  tenureYears: number;
  priorClaims: number;
  ageBand: string;
};

export type CaseRecord = {
  id: string;
  title: string;
  claimId: string;
  customerId: string;
  policyId: string;
  postcodeDistrict: string;
  dateOfLoss: string;
  damageType: string;
  brand: string;
  summary: string;
};

export type Precedent = {
  drn: string;
  insurer: string;
  damageType: string;
  facts: string;
  weatherCited: string;
  outcome: 'upheld' | 'not_upheld' | 'upheld_in_part';
  decisiveFact: string;
  tags: string[];
};

function readJsonAbs<T>(abs: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function readJson<T>(relFromData: string): T | null {
  return readJsonAbs<T>(path.join(DATA_DIR, relFromData));
}

export function loadCases(): CaseRecord[] {
  return readJson<CaseRecord[]>('cases.json') ?? [];
}

export function loadCase(caseId: string): CaseRecord | undefined {
  return loadCases().find((c) => c.id === caseId);
}

export function loadWording(policyId: string): Wording | null {
  return readJson<Wording>(path.join('wordings', `${policyId}.json`));
}

export function loadCustomer(customerId: string): Customer | null {
  return readJson<Customer>(path.join('customers', `${customerId}.json`));
}

export function loadPrecedents(): Precedent[] {
  return readJson<Precedent[]>('precedents.json') ?? [];
}

// Weather is looked up by (postcodeDistrict, dateOfLoss). The fixture files are
// small so we scan them; each case's district+date pair is unique.
export function loadWeather(postcodeDistrict: string, dateOfLoss: string): WeatherReport | null {
  const dir = path.join(DATA_DIR, 'weather');
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return null;
  }
  for (const f of files) {
    const w = readJsonAbs<WeatherReport>(path.join(dir, f));
    if (w && w.postcodeDistrict === postcodeDistrict && w.dateOfLoss === dateOfLoss) return w;
  }
  return null;
}

// THE shared loader for the adjuster report. injectionGuard + privacyGuard run
// HERE so the narrative is sanitized no matter which path reaches it (ENG6/E3):
// the input-processor approach never sees the narrative because it arrives via a
// tool call after the processors have run.
export function loadReport(claimId: string): AdjusterReport | null {
  const report = readJson<AdjusterReport>(path.join('reports', `${claimId}.json`));
  if (!report) return null;
  const injection = sanitizeNarrative(report.narrative);
  const privacy = pseudonymise(injection.clean);
  return {
    ...report,
    narrative: privacy.clean,
    guardEvents: {
      injectionRemoved: injection.removed,
      privacyRedactions: privacy.redactions,
    },
  };
}
