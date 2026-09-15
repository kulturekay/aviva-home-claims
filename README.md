# storm-review

**A second pair of eyes on home-insurance storm-claim declines.**
When a loss adjuster recommends refusing a storm claim, this reviews the recommendation the way the Financial Ombudsman would, before the letter goes out, and hands a technical handler the evidence, a verdict, and an honest "how sure". It cannot decline anything itself.

---

## Run it: about 14 seconds from a cold clone, no API key

```bash
git clone https://github.com/kulturekay/aviva-home-claims.git && cd aviva-home-claims
npm ci
npm run doctor     # node version, keys, fixtures, precedent store, Mastra instance
npm run demo       # replays Case A from a recorded model run and prints the trace
npm run serve      # review screen at http://localhost:8787
```

Measured at 14s on this machine (clone 6s, `npm ci` 5s, `demo` 1s) with a warm npm cache; a cold cache makes the install the long pole.

With no key, every run replays a recorded run from `golden/`. Set `ANTHROPIC_API_KEY` in `.env` and the same commands call the model for real, roughly 15 to 30 seconds a case. `USE_GOLDEN=1` forces the recording back on for a rehearsed demo; `USE_GOLDEN=0` forces live. There is no toggle in the screen: the mode is shown in the header and chosen by the environment.

`npm run dev` opens Mastra Studio (traces, workflow state) at http://localhost:4111. `npm run evals` prints the eval table. `npm test` runs the 22 unit and integration tests.

---

## The problem, in numbers

The FCA reviewed 118,890 home storm claims from fifteen insurers in 2024. **32% were paid. 49% were refused.** Four of the fifteen had no written criteria for cash settlements; five had "limited control" over the outsourced firms handling their claims. The Ombudsman upholds **33%** of complaints against Aviva Insurance and **29%** against Direct Line's insurer, against a 27% industry average, and its own analysis found 80% of buildings complaints involved a third-party adjuster or surveyor. Since then the FCA has asked thirteen of the fifteen firms to re-examine their storm and cash-settlement handling, and a House of Lords committee has Aviva on its witness list.

[FCA multi-firm review, Jul 2025](https://www.fca.org.uk/publications/good-and-poor-practice/home-travel-claims-handling-arrangements) · [FOS firm data H2 2025](https://www.financial-ombudsman.org.uk/businesses/resolving-complaint/our-insight/half-yearly-complaints-data-h2-2025) · [FOS buildings complaints, Aug 2024](https://www.financial-ombudsman.org.uk/news/buildings-insurance-complaints-hit-10-year-high) · [FCA response to Which? super-complaint, Dec 2025](https://www.fca.org.uk/publication/corporate/fca-response-which-super-complaint.pdf)

A wrong "no" today is caught months later, by a complaint. This catches it at the last cheap moment: after the adjuster recommends, before the handler signs.

## Who it's for

The **technical claims handler** who signs off declines recommended by desk, field or outsourced adjusters. Aviva's own job adverts describe the role: desk adjusters handle building claims to £10k and £50k; a Home Claims Technical Consultant supports them and must know "the FOS approach". This is built for the person at that sign-off.

## What it does

On an event (*adjuster recommends decline*) the workflow:

1. **Prefetches** the policy wording in force and a postcode-level weather report. No model involved; these are always needed. The adjuster's narrative is sanitised here, before the agent ever sees it.
2. **Investigates.** One agent decides what else it needs and calls tools: the adjuster's report and photo metadata; the customer's vulnerability flag (a yes/no, never the notes); and Ombudsman precedents from a closed store. In the recorded runs it makes two calls for a straightforward case and three when the customer's circumstances matter. The agent is told to call one tool at a time and let each result decide the next; that sequencing is a prompt instruction, not a model-level setting (disabling parallel tool calls is provider-specific and is not wired here).
3. **Answers the Ombudsman's three questions** with quoted evidence: Did storm conditions occur under *this* wording? Is this storm-type damage? Was the storm the main cause, or was it already failing?
4. **Returns a structured review**: a verdict from five review values (the kept cases produce `agree_decline`, `disagree_decline` and `cannot_determine`; `agree_cash` and `disagree_cash` exist for the deferred cash-settlement case), confidence as a word (`high` / `medium` / `low`) with its drivers, what would change its mind, carve-outs (temporary repairs, accidental damage), Consumer Duty checks, and who to escalate to.
5. **Suspends for a human.** Every case. The handler approves, overrides with a reason and a failure mode, or escalates. The run is persisted in LibSQL: kill the server mid-review, start a new process, and `POST /resume` completes it and writes the audit line. Verified with two different PIDs.
6. **Records** an audit row: inputs, tool calls, review, decision, model, prompt version.

## The three cases

| Case | Situation | What the reviewer does (recorded runs) | What it proves |
|---|---|---|---|
| **A** | Storm Bram, Dec 2025, Wolverhampton. TPA declines: "38 mph, mortar deterioration." Two undated ground photos. | Finds the 38 was a mean and the gust was 61 with a named storm; finds the report never photographed the mortar it blames. Q1 yes · Q2 yes · Q3 unknown. `disagree_decline`, **high**. Flags the temporary-repair carve-out. | It catches a wrong no on **evidence quality**, not wind speed alone. |
| **B** | Storm Chandra, Jan 2026, Exeter. Flat roof; six dated photos of ponding, sagging, old patches, moss. | Calls Q1 *borderline* (44 mph gusts, 27 mm/hr rain under a "normally 55 mph" wording), Q3 pre-existing. `agree_decline`, **high**, and notes the £680 emergency repair is likely payable anyway. | Not a machine for paying claims. Same brain, opposite answer, plus what a tired handler forgets. |
| **E** | Storm Bram, Dec 2025, mid-Wales. Same shape as A, but the weather source returns *unavailable*. | Says it cannot answer Q1 and why. `cannot_determine`, **low**. Does not infer wind speed from the storm's name. Escalates to the technical lead. | It knows when to stop. An evidence gap is a finding. |

Each review cites between one and five Ombudsman decisions from the store. Which ones it cites varies from run to run; the verdict and confidence have not. Every citation is checked against what the precedent tool actually returned in that run: a cited decision that was not returned is stripped, the run is blocked from the clean path, and it goes to a human with the reason shown on screen.

## What is real and what is mocked

**Real:** the four storm definitions, quoted from Aviva's current and legacy wordings and Direct Line's September 2025 booklet. Three say "normally exceeding 55 mph", one says "minimum", and which one applies changes the answer; the 17 Ombudsman decisions in `data/precedents.json`, with their reference numbers; the Met Office storm names and dates; every regulatory figure above.

**Mocked:** the weather reports (shaped like a WeatherNet postcode report, which is what the Ombudsman and most UK insurers use); the adjuster reports; the customer records; the claims system. There are no network calls in `src/`.

**Assumed, to validate with the client:** who signs off at what value bands; which weather vendor they use; where the vulnerability flag lives and who may read it; which wording versions are live across the two books; the written rules for cash settlements.

## Evals

The exam is written already: the Ombudsman publishes reasoned decisions. Each golden case holds out its own controlling decision from what the precedent tool can return (`src/mastra/evals/run.ts`), so the reviewer has to reason to the outcome rather than look it up. The holdout only applies to live runs, which is where it means anything.

Scorers: **verdict agreement** (deterministic) and **citation faithfulness** (every cited decision exists and was returned this run). A third, **decisive-fact recall**, uses a judge from a different model family (`openai/gpt-4.1-mini`) and is wired but has never been run: there was no judge key in the build environment, so it prints "skipped" and the two deterministic scorers carry the result.

**North-star metric: wrongly upheld declines.** The review said "defensible" and the Ombudsman would have said otherwise. A second line's worst failure is missing the thing it exists to catch. Tracked separately so it cannot hide inside an average.

```
mode: live model anthropic/claude-sonnet-4-5 | holdout: active
| case | expected          | actual            | agreement | faithful |
| A    | disagree_decline  | disagree_decline  | 1         | yes      |
| B    | agree_decline     | agree_decline     | 1         | yes      |
| E    | cannot_determine  | cannot_determine  | 1         | yes      |
verdict-class agreement : 3/3     citation faithfulness : 3/3
confidence buckets      : high n=2 (2/2) · low n=1 (1/1)
abstentions             : 1
NORTH STAR: wrongly upheld declines: 0
```

n=3. These are real model runs on a small set: a starting point, not a claim. The merge rule: no prompt or model change ships if the north-star count worsens.

## What it deliberately does not do

- **No memory.** Each review is stateless, so one case cannot contaminate the next, and the audit log is the only history.
- **No vector database.** Seventeen decisions need a filter, not embeddings. At thousands, semantic search becomes a tool the agent can call.
- **No multi-agent.** The escalation targets (counter-fraud, the technical lead) are people.
- **No outbound channel.** The agent has private data and reads untrusted text (a claimant could write "ignore your instructions" in a narrative; an adjuster's report is third-party content). So the third leg of the trifecta is removed: it cannot email, browse or send. Its only writes are a note and an audit row.
- **No confidence scores.** Models are better at words than numbers. `high / medium / low` with named drivers is what a handler can act on; the numbers live in the eval.

Guards are named after what they stop: *injection guard* and *privacy guard* on narratives (regex, best-effort, and genuinely weak on their own; the no-outbound rule is what actually holds); *precedent guard* (every cited decision must have been returned by the tool this run); *scope guard* (the verdict is one of five review values, never an action).

## Where it would plug in

Aviva's home claims run on Guidewire ClaimCenter, moved to Guidewire Cloud in 2026; Direct Line's claims consolidate onto the same platform in H1 2027. The reviewer listens for a "recommend decline" activity, writes a note and a task back, and logs to audit. It is an API conversation, not a re-platform. The model call goes through the enterprise endpoint with names removed; handlers approve under their own login.

## What I'd test next

Silent mode on ~500 historic declinatures with known outcomes: agreement, harmful-error rate, abstention rate. Then live on one outsourced adjuster's recommendations with a technical lead reviewing every flag. Go/no-go on the north star and on whether handlers keep using it, not on volume.

## Deferred from this build

Cut to keep three hours honest: **Case C** (52 mph gusts declined under a hard-threshold wording superseded at renewal); **Case D** (cash settlement offered to a customer flagged vulnerable, with a photo of uncertain provenance; the reviewer stops and escalates); image provenance; live streaming of tool calls; the cross-family judge run; the diagrams and screen recording. Case D carries the responsible-AI story and would be the first thing back in.

## How the recordings were made

`golden/case*.json` are recordings of live runs against `anthropic/claude-sonnet-4-5`, produced with `npm run golden <case>` on 15 Sep 2026, including the tool-call sequence. They exist so the demo never depends on a live call landing. The recordings carry the model id and a timestamp but not the run id. A second live run of each case is in the eval output; verdict and confidence matched, cited decisions varied.

## Layout

```
src/mastra/        agent, tools, workflow, schema, guards, evals
data/              wordings · weather · reports · customers · precedents · cases
golden/            recorded runs (real model output)
audit/             append-only log written by the record step
ui/                the review screen
```

## Built with

[Mastra](https://mastra.ai) (agents, workflows with suspend/resume, scorers, tracing), TypeScript, LibSQL, Hono. Claude Code was used for the build, with the scope, the domain rules and every cut decided by hand. The research is in the accompanying document.
