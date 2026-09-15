import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { mastra } from './mastra/index.ts';
import { PROJECT_ROOT } from './mastra/lib/paths.ts';
import { loadCases, loadCase, loadReport, loadCustomer, loadWording, loadWeather } from './mastra/lib/loader.ts';
import { readAudit } from './mastra/lib/audit.ts';
import { shouldUseGolden } from './mastra/lib/golden.ts';

const app = new Hono();
const UI_FILE = path.join(PROJECT_ROOT, 'ui', 'index.html');

// Deterministic left-column payload, built straight from the fixtures (no model).
function buildLeft(caseId: string) {
  const caseRecord = loadCase(caseId);
  if (!caseRecord) return null;
  const report = loadReport(caseRecord.claimId);
  const customer = loadCustomer(caseRecord.customerId);
  const wording = loadWording(caseRecord.policyId);
  const weatherRaw = loadWeather(caseRecord.postcodeDistrict, caseRecord.dateOfLoss);
  return {
    caseRecord,
    report: report && {
      claimId: report.claimId,
      author: report.author,
      recommendation: report.recommendation,
      statedReason: report.statedReason,
      narrative: report.narrative,
      photos: report.photos,
      priorRepairsObserved: report.priorRepairsObserved,
      causationReasoned: report.causationReasoned,
      customerEmergencyRepairCost: report.customerEmergencyRepairCost,
      guardEvents: report.guardEvents,
    },
    customer: customer && {
      vulnerabilityFlag: customer.vulnerabilityFlag,
      vulnerabilityCategory: customer.vulnerabilityCategory,
      tenureYears: customer.tenureYears,
      priorClaims: customer.priorClaims,
      ageBand: customer.ageBand,
    },
    wording: wording && { version: wording.version, discretionary: wording.discretionary, brand: wording.brand },
    weather: weatherRaw && {
      status: weatherRaw.status,
      reason: weatherRaw.reason,
      namedStorm: weatherRaw.namedStorm,
      stations: weatherRaw.stations,
    },
  };
}

app.get('/', (c) => {
  try {
    return c.html(fs.readFileSync(UI_FILE, 'utf8'));
  } catch {
    return c.text('ui/index.html not found', 500);
  }
});

app.get('/cases', (c) => c.json({ cases: loadCases(), mode: shouldUseGolden() ? 'golden-cache' : 'live' }));

app.post('/run/:caseId', async (c) => {
  const caseId = c.req.param('caseId');
  const left = buildLeft(caseId);
  if (!left) return c.json({ error: `unknown case ${caseId}` }, 404);

  const wf = mastra.getWorkflow('stormReview');
  const run = await wf.createRun();
  let res: any;
  try {
    res = await run.start({ inputData: { caseId } });
  } catch (err) {
    return c.json({ runId: run.runId, status: 'failed', error: err instanceof Error ? err.message : String(err), left }, 200);
  }

  if (res.status === 'suspended') {
    const p = res.suspendPayload?.gate ?? {};
    return c.json({
      runId: run.runId,
      status: 'suspended',
      caseId,
      claimId: p.claimId ?? left.caseRecord?.claimId,
      left,
      review: p.review ?? null,
      guard: p.guard ?? null,
      gateFacts: p.gateFacts ?? null,
      toolCalls: p.toolCalls ?? [],
      returnedDrns: p.returnedDrns ?? [],
      modelUsed: p.modelUsed ?? null,
      suspendReason: p.reason ?? '',
    });
  }

  // Auto-filed (not reached in the demo, where every case gates).
  const r = res.result ?? {};
  return c.json({
    runId: run.runId,
    status: res.status,
    caseId,
    claimId: left.caseRecord?.claimId,
    left,
    review: r.review ?? null,
    guard: r.guard ?? null,
    gateFacts: r.gateFacts ?? null,
    toolCalls: r.toolCalls ?? [],
    returnedDrns: r.returnedDrns ?? [],
    modelUsed: r.modelUsed ?? null,
    autoFiled: true,
    audit: r.audit ?? null,
  });
});

// Best-effort rehydrate for a page reload; the live UI keeps runId + payload in JS,
// so the resume flow does not depend on this.
app.get('/run/:runId', async (c) => {
  const runId = c.req.param('runId');
  const wf = mastra.getWorkflow('stormReview');
  const state = await wf.getWorkflowRunById(runId);
  if (!state) return c.json({ error: 'run not found', runId }, 404);
  return c.json({ runId, state });
});

app.post('/resume/:runId', async (c) => {
  const runId = c.req.param('runId');
  const body = await c.req.json().catch(() => ({}));
  const decision = body?.decision;
  if (!['approve', 'override', 'escalate'].includes(decision)) {
    return c.json({ error: "decision must be one of 'approve', 'override', 'escalate'" }, 400);
  }
  if ((decision === 'override' || decision === 'escalate') && !body?.reason) {
    return c.json({ error: `a reason is required to ${decision}` }, 400);
  }
  if (decision === 'override' && !body?.failureMode) {
    return c.json({ error: 'override requires a failureMode (extraction | reasoning | rules)' }, 400);
  }

  const wf = mastra.getWorkflow('stormReview');
  // Rehydrate purely from LibSQL by runId; NEVER an in-memory handle (ENG 1.2).
  // This is why the resume survives a server restart.
  const run = await wf.createRun({ runId });
  let res: any;
  try {
    res = await run.resume({
      step: 'gate',
      resumeData: {
        decision,
        reason: body.reason ?? '',
        failureMode: body.failureMode,
        domainNote: body.domainNote,
      },
    });
  } catch (err) {
    return c.json({ runId, status: 'error', error: err instanceof Error ? err.message : String(err) }, 500);
  }
  return c.json({
    runId,
    status: res.status,
    decision,
    audit: res.result?.audit ?? null,
  });
});

app.get('/audit', (c) => {
  const entries = readAudit();
  return c.json({ entries: entries.slice(-25).reverse() });
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
const mode = shouldUseGolden() ? 'golden-cache (zero-key)' : 'live model';
console.log(`storm-review UI on http://localhost:${port}  [mode: ${mode}]`);
console.log(`  cases: A (wrongful decline), B (defensible decline), E (source unavailable)`);
