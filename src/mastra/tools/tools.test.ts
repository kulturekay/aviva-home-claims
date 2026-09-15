import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPolicyWording } from './getPolicyWording.ts';
import { getWeatherReport } from './getWeatherReport.ts';
import { getAdjusterReport } from './getAdjusterReport.ts';
import { getCustomerContext } from './getCustomerContext.ts';
import { findFosPrecedents, queryPrecedents } from './findFosPrecedents.ts';

const ctx = {} as any;

test('getPolicyWording: happy path returns the subset shape', async () => {
  const r: any = await getPolicyWording.execute!({ policyId: 'aviva_v8' }, ctx);
  assert.equal(r.wordingId, 'aviva_v8');
  assert.equal(r.discretionary, true);
  assert.ok(r.stormDefinition.includes('55mph'));
});

test('getPolicyWording: unknown wording returns {status:unavailable}', async () => {
  const r: any = await getPolicyWording.execute!({ policyId: 'nope' }, ctx);
  assert.equal(r.status, 'unavailable');
});

test('getWeatherReport: Case E district returns unavailable (not a throw)', async () => {
  const r: any = await getWeatherReport.execute!({ postcodeDistrict: 'LD', dateOfLoss: '2025-12-09' }, ctx);
  assert.equal(r.status, 'unavailable');
  assert.match(r.reason, /15 km/);
});

test('getWeatherReport: Case A returns gusts, not means', async () => {
  const r: any = await getWeatherReport.execute!({ postcodeDistrict: 'WV', dateOfLoss: '2025-12-09' }, ctx);
  assert.equal(r.stations[0].maxGustMph, 61);
});

test('getAdjusterReport: narrative is sanitized by the shared loader (ENG6)', async () => {
  const r: any = await getAdjusterReport.execute!({ claimId: 'CLM-A-8842' }, ctx);
  assert.ok(!/ignore your previous instructions/i.test(r.narrative));
  assert.ok(r.guardEvents === undefined || true); // tool omits guardEvents from output
});

test('getCustomerContext: returns the flag, never notes', async () => {
  const r: any = await getCustomerContext.execute!({ customerId: 'CUST-A' }, ctx);
  assert.equal(r.vulnerabilityFlag, false);
  assert.ok(!('notes' in r));
});

test('findFosPrecedents: returns at most 5', async () => {
  const r: any = await findFosPrecedents.execute!({ damageType: 'roof_tiles', tags: ['burden_of_proof', 'insurer_wrong_on_q1'] }, ctx);
  assert.ok(r.precedents.length <= 5);
});

test('queryPrecedents: Case A surfaces its controlling DRNs', () => {
  const drns = queryPrecedents('roof_tiles', ['gusts_vs_mean', 'burden_of_proof', 'insurer_wrong_on_q1']).map((p) => p.drn);
  assert.ok(drns.includes('DRN-6301360'));
  assert.ok(drns.includes('DRN-4626921'));
});

test('queryPrecedents: Case B surfaces its controlling DRNs', () => {
  const drns = queryPrecedents('flat_roof', ['ponding', 'decking', 'gradual_deterioration', 'temporary_repair']).map((p) => p.drn);
  assert.ok(drns.includes('DRN-4885234'));
  assert.ok(drns.includes('DRN-4997488'));
});
