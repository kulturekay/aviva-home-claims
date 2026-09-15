import type { AdjusterReport, CaseRecord, Customer, Wording, WeatherReport } from './loader.ts';
import type { Unavailable } from '../tools/common.ts';

export type WordingResult = Wording | null;
export type WeatherResult = WeatherReport | { status: 'unavailable'; reason: string };

// Build the structured context block appended to the user turn (spec section 5:
// goal / returnFormat / warnings / wording / weather / case). Prefetched so the
// deterministic facts do not depend on the agent choosing to call a tool. Hyphens
// and colons only (house style).
export function buildContextBlock(args: {
  caseRecord: CaseRecord;
  wording: WordingResult;
  weather: WeatherResult;
  report: Pick<AdjusterReport, 'claimId' | 'recommendation' | 'statedReason'>;
  customer: Customer | null;
}): string {
  const { caseRecord, wording, weather, report, customer } = args;

  const wordingLine = wording
    ? `${wording.stormDefinition} | discretionary=${wording.discretionary} | exclusions: ${wording.exclusions.join('; ')} | cash: ${wording.cashSettlementClause}${wording.previousVersion ? ` | previousVersion: ${wording.previousVersion}` : ''}`
    : 'unavailable: no wording on file';

  let weatherLine: string;
  if ('status' in weather && weather.status === 'unavailable') {
    weatherLine = `status: unavailable - ${weather.reason}. No station data for this postcode. Do not infer wind speed from the named-storm list alone.`;
  } else {
    const w = weather as WeatherReport;
    const stations = w.stations
      .map(
        (s) =>
          `${s.name} (${s.distanceKm}km): meanWind ${s.meanWindMph}mph, maxGust ${s.maxGustMph}mph, maxRain ${s.maxRainMmPerHr}mm/hr, snow ${s.snowCm}cm`,
      )
      .join(' | ');
    weatherLine = `namedStorm: ${w.namedStorm ?? 'none'} | status: ok | stations: ${stations}`;
  }

  const wordingId = wording ? wording.id : 'unknown';
  const discretionary = wording ? wording.discretionary : 'unknown';

  return [
    `<goal>Review adjuster recommendation for claim ${report.claimId}: ${report.recommendation} - "${report.statedReason}".</goal>`,
    `<returnFormat>Answer Q1, Q2, Q3 in order, each with quoted evidence and any gaps, then produce the structured verdict.</returnFormat>`,
    `<warnings>1. Use gusts, not means. 2. The wording in force governs: it is ${wordingId}, discretionary=${discretionary}. 3. Stage 2 burden: the insurer must prove any exclusion it relies on; a bare deterioration assertion without dated photos does not discharge it.</warnings>`,
    `<wording>${wordingLine}</wording>`,
    `<weather>${weatherLine}</weather>`,
    `<case>book=${caseRecord.brand}, postcodeDistrict=${caseRecord.postcodeDistrict}, dateOfLoss=${caseRecord.dateOfLoss}, customerId=${caseRecord.customerId}, claimId=${report.claimId}, vulnerabilityFlag=${customer ? customer.vulnerabilityFlag : 'unknown'}</case>`,
  ].join('\n');
}
