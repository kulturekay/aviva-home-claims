# Storm-claim second-line reviewer

A second-line reviewer for UK home-insurance storm claims. When a loss adjuster recommends declining a storm claim, this tool independently assembles the evidence the Financial Ombudsman would look at, answers the Ombudsman's three questions with quoted evidence, and tells the technical handler whether the recommendation is defensible, not defensible, or cannot be judged from the file. A human then approves, overrides with a reason, or escalates.

It reviews a recommendation. It never issues one: the reviewer can emit a review verdict, never a "decline" action.

House style in this repo: hyphens and colons only, no em or en dashes (a commit hook enforces it).

## Quickstart (zero keys)

```
npm ci
npm run doctor      # preflight: node, keys, fixtures, mastra instance
npm run demo        # fires the hero case (A) end to end from the cached golden run
npm run serve       # UI at http://localhost:8787
```

Look at this first:
1. `npm run demo` prints Case A: verdict `disagree_decline`, high confidence, cited real Ombudsman DRNs, and the reason it suspended for a human.
2. `npm run serve` then open Case A: the decision banner, the three Ombudsman questions with quoted evidence, the tool-call trace, and the human action bar.
3. After you Accept or Override in the UI, an audit line is appended to `audit/log.jsonl` and a ClaimCenter note stub to `audit/notes/`.

The hero demo runs with NO API keys because the review step serves a cached golden run (`golden/caseA.json`). It never depends on a live model call landing on an expected output. Set a key (below) for live runs.

## Reduced scope

This build is the reviewed, reduced slice: Cases A, B and E. Cases C and D, image provenance (`checkImageProvenance`), and live SSE streaming are deferred by design (see the capability whiteboard below).

- Case A - wrongful decline (hero). Ridge tiles, WV district, Storm Bram. Adjuster cites 38 mph and mortar deterioration on two undated ground-level photos. Verdict: decline not defensible.
- Case B - defensible decline. Kitchen flat roof, EX district, Storm Chandra. Field surveyor, six dated photos of ponding, sagging decking, a prior patch and moss. Verdict: decline defensible, with carve-outs.
- Case E - source unavailable. Rural district with no weather station within 15 km. Verdict: cannot determine; the evidence gap is named and no wind speed is inferred from the named storm alone.

## The three Ombudsman questions

1. Did storm conditions occur on or around the date of loss, under the wording in force?
2. Is the damage of a kind a storm causes?
3. Was the storm the main cause, or was the damage already happening and merely revealed?

Burden of proof, in two correctly separated stages (the reviewer applies this, and it is a common thing adjusters get wrong):
- Stage 1 is on the policyholder: show, on the balance of probabilities, that a storm occurred (Q1) and that the damage is of a storm-consistent kind (Q2). That is a prima facie storm claim.
- Stage 2 shifts to the insurer: to decline on an exclusion (wear and tear, gradual deterioration, lack of maintenance) it must prove that exclusion applies. Asserting deterioration without dated photographs of the blamed defect does not discharge that burden.

## What is real, and what is mocked

Real (checkable):
- The policy wordings are quoted from public Aviva and Direct Line documents.
- The DRNs are real published Financial Ombudsman decisions, summarised in `data/precedents.json`.
- The storm names and dates and the Ombudsman's three questions are real.
- The authorities cited by the reviewer are real and correctly named: the FCA Consumer Duty (PRIN 2A), the FCA guidance on the fair treatment of vulnerable customers (FG21/1), and FCA claims-handling rules (ICOBS 8). There is deliberately no "ABI principle 4"; that phrasing does not name a real principle and is not used.

Mocked (shaped like the real thing, but synthetic):
- Weather reports are shaped like a WeatherNet feed (`data/weather/`).
- The adjuster reports, customer records, and the five seeded cases are synthetic (`data/reports`, `data/customers`, `data/cases.json`).

## How the pipeline works

```
cases.json -> pick a case
  [prefetch]   getPolicyWording + getWeatherReport (direct, no model); loads the
               report metadata and customer flag into typed state so the gate is
               deterministic; builds the goal/returnFormat/warnings/context block.
  [review]     one agent call: tool-using investigation AND the structured verdict
               together. Tools: getAdjusterReport, getCustomerContext,
               findFosPrecedents (called one at a time). Golden-cache in zero-key mode.
  [guard]      precedentGuard (every cited DRN was returned THIS run) and scopeGuard
               (verdict is a review value). A block routes to a human, never a crash.
  [gate]       needsHuman? suspend for a human. In this demo every case is gated
               (no auto-file of a customer-adverse outcome). Resume with the decision.
  [record]     append one line to audit/log.jsonl and a ClaimCenter note stub.
LibSQLStore at file:<abs>/mastra.db  ->  a suspended run survives a process restart.
```

## The four guards, and what each stops

- injectionGuard (input): removes instruction-shaped fragments from the untrusted narrative (for example "ignore previous instructions", "you must", "recommend payment"). Best-effort defence-in-depth. It runs in the shared report loader, because the narrative reaches the agent through a tool call, not through an input processor.
- privacyGuard (input): pseudonymises titled names and truncates full postcodes to their district. Best-effort; the data here is already local.
- precedentGuard (output): every cited DRN must be one that findFosPrecedents actually returned this run. This is the honest anti-fabrication control: it catches a real-but-unretrieved DRN, not just an obviously fake one.
- scopeGuard (output): the verdict must be one of the review enum values. The reviewer reviews a recommendation and can never emit a decline as an action. The prose check for a decline directive is non-fatal: a paragraph that legitimately discusses a decline (as every real one does) must pass.

Honest framing: injectionGuard and privacyGuard are best-effort and trivially bypassable in general. The real control is that the agent has no outbound channel. It holds private data and reads untrusted text, so removing the ability to send removes the third leg of the lethal trifecta. That, not the regex guards, is the headline safety property.

## North-star metric and merge rule

North star: wrongly upheld declines, that is, cases where the review should have said the decline is not defensible (`disagree_decline`) but instead agreed with it (`agree_decline`). `npm run evals` prints this count.

Merge rule: no prompt or model change ships if the north-star count rises on this suite.

## Evals

`npm run evals` reframes the eval as citation faithfulness, not outcome accuracy (the spec's 17-outcome set leaked its own answer key and only the authored cases are runnable). It scores:
- verdict-class agreement on the authored cases (half credit for abstaining on a borderline case),
- citation faithfulness (cited DRNs are a subset of those actually returned; never fabricated),
- a paired-variant regression (the source-unavailable variant of A must flip to cannot_determine),
- the north-star count.

In live mode each case's controlling DRN is held out from findFosPrecedents, so the model cannot copy its own answer key. The decisive-fact recall scorer runs on a non-Anthropic judge model; without a judge key it prints "skipped (no judge key)" and the deterministic scorers still run.

## Capability whiteboard

Storm-decline review is the wedge, built first. The wider wish list, deferred:
- cash-settlement review (Case D territory: vulnerability, network vs customer rates, image provenance),
- the wrong-rulebook path (Case C: comparing the wording at inception vs renewal),
- TPA SLA-breach detection,
- complaint root-cause analysis,
- letter-quality review.

## Deliberate omissions, with reasons

- No memory. The reviewer is stateless so one case cannot poison the next. The audit log is the only history.
- No RAG or vector DB. Seventeen decisions need a filter, not embeddings.
- No multi-agent. The escalation targets are people, not agents.
- No outbound channel. This is the security keystone (see the guards section).
- No chat interface. This is a review artifact for a handler to sign, not a chatbot.

## Configuration and keys

Copy `.env.example` to `.env`. Command-to-key table:

| command | keys | notes |
| --- | --- | --- |
| `npm run doctor` | none | preflight |
| `npm run demo` | none (golden) or `ANTHROPIC_API_KEY` (live) | fires Case A |
| `npm run serve` | none (golden) or `ANTHROPIC_API_KEY` (live) | UI on `PORT` (default 8787) |
| `npm run dev` | none (golden) or `ANTHROPIC_API_KEY` (live) | Mastra Studio on 4111 |
| `npm run evals` | `ANTHROPIC_API_KEY` for live behaviour, plus a judge key for decisive-fact recall | degrades gracefully |
| `npm run golden A` | `ANTHROPIC_API_KEY` | re-records `golden/caseA.json` from a live call |

The agent and verdict stay in the Anthropic family so `dev`, `serve` and `demo` need only one key. The eval judge is deliberately a different family (OpenAI) so the review is not graded by its own model. Model IDs are Mastra provider/model strings; confirm the exact suffix against the account in use (the default `anthropic/claude-sonnet-4-5` is overridable via `AGENT_MODEL`).

`USE_GOLDEN=1` forces the cached run even with a key present (deterministic demo); `USE_GOLDEN=0` forces a live call.

## Restart-resume (the resilience story)

Start Case A in the UI, reach the suspended state, kill the server, restart it, then approve or override. The run completes. The resume rehydrates the run from LibSQL by runId (`createRun({ runId })`), never from an in-memory handle, so it survives the restart. This is verified by `scripts/spike/` and by `src/mastra/workflow.test.ts`.

## Stack and versions

Node 22+, TypeScript, Mastra. Pinned in `package.json` and `package-lock.json`: `@mastra/core` 1.67.0, `mastra` (CLI) 1.30.0, `@mastra/libsql` 1.23.0, `@mastra/evals` 1.10.2, `@mastra/observability` 1.17.8, `@mastra/loggers` 1.3.2, `zod` 4.6.5, `hono` 4.13.8. All Mastra API signatures used here (createTool `(inputData, context)`, createStep single-object execute, structuredOutput, LibSQLStore, createRun/resume) were verified against the installed type definitions.

Note on sequential tool calls: the reviewer prompt instructs one-tool-at-a-time, and the causal chain relies on it. Disabling parallel tool calls at the model level is provider-specific (`providerOptions`) and is not wired here; the prompt is the control.

## Assumptions to validate with the client

- Sign-off limits: which verdicts a handler may accept without a second signature.
- The weather data vendor and its station coverage and latency.
- Where the vulnerability flag lives, and who maintains it.
- Which wording versions are actually in force, and the renewal-versioning rules.
- The cash-settlement fairness rules and the customer-rate reference the business uses.

## Layout

```
data/            fixtures: wordings, weather, reports, customers, precedents (17), cases (A/B/E)
golden/          cached canonical runs (caseA/B/E.json) so the demo needs no keys
src/mastra/
  agents/reviewer.ts     the reviewer agent and its system prompt
  tools/                 5 tools, each returns {status:'unavailable'} instead of throwing
  guards/                injection, privacy, precedent, scope
  schemas/review.ts      the review zod schema
  workflows/stormReview  prefetch -> review -> guard -> gate -> record
  evals/                 fixtures, scorers, run.ts
  lib/                   loader, context builder, audit, paths, model, golden
src/server.ts    Hono server: /cases, /run/:caseId, /run/:runId, /resume/:runId, /audit
ui/index.html    single page, no framework
scripts/         doctor, demo, record-golden, spike/ (the restart-resume verification)
audit/           append-only log.jsonl and notes/ (created at runtime)
```
