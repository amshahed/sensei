# Tech: AI grading model no longer available

Author: Tech Lead, 2026-11-08. Based on `fix/authoring-live-api` at `b6a8960` (PR #66), which is still open. The lasting decision is L.4.b in `decisions.md`.

## Verdict

Replace the default with **`gemini-3.5-flash-lite`**, add tagged logs plus a check at startup, and stop an outage from counting as a learner's mistake in lessons. No schema change and no new dependency.

**Works for development and the agent Alpha. Not usable for real learners until billing is on** (see "Free tier" below).

## What I measured

All calls used this project's key, through the real grading prompt and schema. Raw results are in `probe-results.jsonl`, and the 18 labelled answers are in `eval-set.json`. The ledger came to $0.0136 at paid rates. The key is on the free tier, so the actual charge was $0.

**The finding is confirmed, and is slightly different from the brief.**

| Check | Result |
|---|---|
| `generateContent` on `gemini-2.5-flash` | 404, "no longer available to new users" |
| `GET` that model's metadata, and the model list | 200, and it is still listed |
| Real `GeminiLlmClient` + `GradingService`, answer "kitty cat", expected "cat" | Fallback, marked wrong, "Not quite" |
| Same code, `LLM_GRADING_MODEL=gemini-3.5-flash-lite` | `gradedBy: ai`, Good, marked right, 657 ms |

- P1 is broken today, and the last two rows are its before and after. No code change was needed to prove the swap.
- The brief says nothing would report this. In fact `GradingService` already logs an ERROR on each failed call. The gap is narrower: the line appears only after a learner answers, it looks like any other failure, and nothing checks at startup.
- Asking Google whether a model exists doesn't work. It says yes for the model that 404s. Only a real `generateContent` call tells the truth.

**Candidates.** A grade is about 420 tokens in and 30 out.

| Model | Served | Right verdict | Median / max | Cost per 1,000 grades | Shutdown | Verdict |
|---|---|---|---|---|---|---|
| `gemini-3.5-flash-lite` | 52 of 56, the 4 misses being 429s I caused | 52 of 52, all 18 cases | 743 ms / 9.1 s | $0.19 | None announced | **Chosen** |
| `gemini-3.1-flash-lite` | 19 of 19 | 19 of 19, all 18 cases | 679 ms / 7.5 s | $0.14 | 7 May 2027 | Named fallback |
| `gemini-3.6-flash` | 1 of 1 | 1 of 1 | 1.9 s | about $1.02, doubling 1 Jan 2027 | None announced | Rejected |
| `gemini-3.8-flash` | **0 of 6** (two 503s, four 15-second timeouts) | Not measurable | No reply | Same list price as 3.6 | None announced | Rejected |
| `gemini-2.5-flash-lite` | 404 | Not measurable | n/a | $0.05 | None announced | Unavailable to this key |
| `claude-haiku-4-5` | Not called | Not measured | n/a | about $0.56 (at $1/$5) | n/a | Rejected, see below |

`gemini-3.8-flash` is the model Google's 404 message tells us to move to. The 3.6 cost comes from one call, which spent 173 thinking tokens.

**Why `gemini-3.5-flash-lite`**

- **Availability.** It answered this key at a median of 743 ms, inside the 12-second grading cap. It is also what Google's deprecation table names as the successor to `gemini-2.5-flash`, and it has no shutdown date.
- **Cost.** $0.30 / $2.50 per million tokens, the same as the price L.4.a was approved on, so the economics that decision relied on still hold. It used no thinking tokens (hidden reasoning, billed as output) on any call, so the 512-token cap is safe. It is about 3× cheaper than Haiku and about 5× cheaper than the full Flash models, rising to about 11× in January.
- **Grading quality.** All 10 right-but-not-exact answers were accepted: synonym, description, rōmaji, other wording, kanji, typo, dropped topic, own-words explanation, inflection. All 8 wrong answers got "Again", including an attempt to instruct the grader from inside the answer. This is a small set, and neither I nor the founder can vouch for fine Japanese judgement. It shows the model is above the bar for these beginner cases, not that it is linguistically reliable.
- **Rating drift, the one weakness.** It gave "Easy" on 7 of 39 right answers, where `gemini-3.1-flash-lite` gave none of 11. The first full run had 0 of 10 and the second 3 of 10, and my stability test deliberately re-ran the three answers that had drifted, so 7 of 39 overstates the true rate. "Easy" lengthens the next review interval. Temperature 0 did not fix it, so I am not adding that setting.

**Why not `gemini-3.1-flash-lite`,** despite being slightly cheaper and steadier. It has a published shutdown six months out, so this work would need repeating. It stays as the tested manual switch, and it has its own quota because limits are per model.

**Free tier**

| Fact | Source |
|---|---|
| 15 requests per minute per model on this key | The 429 body: `GenerateRequestsPerMinutePerProjectPerModel-FreeTier`, `quotaValue: 15` |
| Daily limit | Not published. Google's docs send you to the AI Studio dashboard, which I can't read. L.4.a's "about 1,500 a day" is unverified |
| Free tier input may train Google's models and be read by human reviewers, and Google advises against sending personal information | Gemini API terms and pricing page |
| Apps made available to users in the EEA, Switzerland or UK may use **only paid services** | Gemini API terms |
| The API can't be used in an app likely to be accessed by under-18s | Gemini API terms |

L.4.a treated the free tier as good for "dev and early beta". The terms make that wrong for any real learner in those regions, and free-text answers are what the tier would be training on.

Every vocabulary review answer also goes to the model (`recall-grader.service.ts`, `case 'meaning'`, which G.4.c made the only vocabulary question type). If a learner answers about every 7 seconds, which is my assumption and not a measurement, two people reviewing at once use up 15 per minute.

So the free tier is fine for development and the agent Alpha, and billing must be on before any real learner. That is stop-list item 2, and inviting users is already item 6. It doesn't block this unit. At an assumed 100 learners × 50 grades a day, paid use is about $28 a month.

## 1. Approach

Three changes, none of which alter the grading design.

**A. Change the default.** Add the model to `model-defaults.ts` and read it through `modelOrDefault`. This also fixes a blank or whitespace env value.

**B. Make a lost model visible, in two places, using a fixed set of log tags.**

1. **Startup check.** On boot, send one real 5-token `generateContent`, without delaying startup. A 404 logs an error before any learner is affected. Also compare the model Google says served the call with the one requested, because `gemini-3.5-flash` was silently served by `gemini-3.6-flash` in the Developer's probe.
2. **Every degraded grade** logs one tagged line with a reason. A 404 is told apart from a rate limit, a timeout or a provider error.

A 15-second request timeout goes on the SDK client. The Developer's 4-minute hang was on a call with no timeout of its own. The 12-second learner cap is unchanged and stays shorter.

**C. Stop counting an outage as a learner's miss in lessons.** `recall-grader.service.ts` already refuses to score a fallback "wrong". `checks.service.ts` does not, so a right paraphrase becomes an FSRS "Again" (a schedule entry saying the learner forgot). This is beyond the brief's literal wording. I'm including it because this decision keeps us on a 15-per-minute limit, which makes that path routine, and the fix is one line that copies an existing rule.

**Rejected**

| Option | Why not |
|---|---|
| `gemini-3.8-flash`, the one the 404 message recommends | 0 of 6 calls answered, and 5× the cost |
| A `-latest` alias | Changes the model under a tuned prompt without any record. The one probe of `gemini-flash-latest` hung for 4 minutes. It may be the same overload as 3.8, but I didn't verify that |
| Back to Haiku (L.4) | Works, but about 3× the cost and uses the tight Anthropic credit that content needs |
| Listing models as the health check | Proven useless, it reports the 404ing model as present |
| Refusing to start when the model is gone | Turns a degraded grader into a full outage. Grading is designed never to block a learner |
| Automatic second model on failure | Hides the very signal this unit is meant to create, and L.4.a left failover until after MVP. It can be added once the signal exists |
| Retrying on 429 | Google asked for a 7-second wait, and the learner cap is 12 |
| A status field on `/health` | Public endpoint, and a deploy platform that gates on it would take down the API over a grading problem |
| A table or metrics service | No reader for it yet. Tagged logs meet the brief |

## 2. Changes

Paths are under `apps/api/src/` unless stated.

| File | Change |
|---|---|
| `llm/model-defaults.ts` | Add `DEFAULT_GEMINI_GRADING_MODEL = 'gemini-3.5-flash-lite'`. Header comment no longer says only Claude. Note that `DEFAULT_GRADING_MODEL` is the Anthropic client's |
| `llm/llm-client.ts` | Add `LlmFailureReason` and `LlmCallError`. Fix the comment naming 2.5 Flash |
| `llm/gemini-llm-client.ts` | Remove the local default. Keep `modelName` on the instance. Pass `{ timeout: 15_000 }` to `getGenerativeModel`. Wrap `generateContent` to throw `LlmCallError`. Add `checkModel()` and `onApplicationBootstrap()`. `GeminiModelLike` response gains optional `modelVersion` |
| `grading/grading.service.ts` | Catch block logs the `GRADING_DEGRADED` line |
| `checks/checks.service.ts` | `gradeOpen`: `scored: result.scored && !(result.gradedBy === 'fallback' && !result.correct)` |
| `grading/grading.prompts.ts`, `apps/api/.env.example` | Comments name the new model |

**Contract**

```ts
export type LlmFailureReason = 'model_unavailable' | 'rate_limited' | 'timeout' | 'provider_error';

export class LlmCallError extends Error {
  constructor(message: string, readonly reason: LlmFailureReason, readonly model: string) { super(message); }
}
```

Mapping from the SDK error: `status === 404` is `model_unavailable`, `status === 429` is `rate_limited`, `err.name === 'GoogleGenerativeAIAbortError'` is `timeout`, and anything else is `provider_error`. Use the numeric `status` the SDK exposes and don't parse the message. Keep the provider's message on the error.

**Log lines.** These exact prefixes are the contract, so a Tester or a future alert can search for them. Never include the learner's answer.

| When | Level | Line |
|---|---|---|
| Startup, model answered | log | `GRADING_MODEL_OK requested=<m> served=<v or unknown>` |
| Startup, served by another model | warn | `GRADING_MODEL_REROUTED requested=<m> served=<v>` |
| Startup, 404 | error | `GRADING_MODEL_UNAVAILABLE model=<m>: <provider message>` |
| Startup, 429, 5xx or timeout | warn | `GRADING_MODEL_UNCONFIRMED reason=<r> model=<m>: <message>` |
| Any grade that fell back after a model call failed | error | `GRADING_DEGRADED reason=<r> model=<m or unknown>: <message>` |

- `GradingService` errors that aren't `LlmCallError` use `reason=timeout` when they are its own 12-second cap, otherwise `reason=bad_response` (off-enum rating, unparseable reply, token limit).
- `checkModel()` never throws, and sends no schema and no `maxOutputTokens` above 5.
- `onApplicationBootstrap()` starts it with `void` so boot isn't delayed, and returns early when there is no model or `process.env.NODE_ENV === 'test'`. `app.integration.spec.ts` boots the real `AppModule`, so without that guard it would make a network call on any machine holding a key.
- The startup check runs in tests by calling `checkModel()` directly on a fake.

No new dependency. Staying on `@google/generative-ai` 0.24.1, because moving SDKs is unrelated to this fix.

## 3. Data

None. No schema or live data change. Nothing to roll back in the database.

Rollback: set `LLM_GRADING_MODEL=gemini-3.1-flash-lite` with no deploy of code, or revert the PR.

No real learners exist yet, so no FSRS rows from the old fallback need correcting.

## 4. Promise map

| Promise | Implementation | Automated test | Live proof (Tester) |
|---|---|---|---|
| **P1.** An answer in my own words that is right but not exact is graded as right | New default in `model-defaults.ts`, used by `GeminiLlmClient` | `gemini-llm-client.spec.ts`, mocking the SDK: default model name, blank env falls back to it, override wins, timeout passed | Run the real `GradingService` over `eval-set.json`, paced under 15 per minute: all 10 "pass" cases `correct: true` and `gradedBy: ai`, all 8 "fail" cases `correct: false`. Then one paraphrase through the running API in dev-stub mode |
| **M1.** A vanished model is visible at startup | `checkModel()` | Fakes: 404 logs `GRADING_MODEL_UNAVAILABLE`; 429 and 503 log `UNCONFIRMED` and don't claim it's gone; different `modelVersion` logs `REROUTED`; rejection never escapes; hook is a no-op in test env | Boot with `LLM_GRADING_MODEL=gemini-2.5-flash`: the error appears with no learner action, and the API still serves |
| **M2.** A vanished model is visible while running | `LlmCallError` + tagged line | Client spec for each mapping using an error with `status`. `grading.service.spec.ts`: 404 logs `GRADING_DEGRADED reason=model_unavailable`, and the learner still gets a fallback result | Same boot, submit an answer, see the line |
| Support: an outage isn't a learner's miss in lessons | `checks.service.ts` guard | `checks.service.spec.ts`: fallback + wrong writes no mastery. Fallback + exact match still does. AI "Again" still does | Covered by the automated test |

The automated tests can't catch a model that is retired later, because CI has no key. That is what the startup check is for. Live proof needs the key and is the only proof that P1 holds.

## 5. Risks

| Risk | What would show it | Response |
|---|---|---|
| Real learners on the free tier breach the terms | Any invite before billing is on | Lead adds a blocker. Billing is a founder action, stop-list 2 |
| 15 per minute is exceeded | `GRADING_DEGRADED reason=rate_limited` | Learner sees exact-match grading. Billing raises the limit. Checking exact matches before calling the model would cut most calls, which I'm sending to the PM as a separate unit because it changes feedback |
| While degraded, a right paraphrase is still shown as "Not quite" | Same tag | Accepted. Change C protects the schedule, not the message. Wording during outages is a PM call |
| "Easy" inflates review intervals | Share of Easy ratings in Alpha, or a learner getting a word too rarely | Prompt tuning (F.5) or `LLM_GRADING_MODEL=gemini-3.1-flash-lite`. I didn't tune the prompt because P1 doesn't need it and any change means re-running the eval |
| The chosen model disappears too | `GRADING_MODEL_UNAVAILABLE` | Change the env var, no code. This is the point of the unit |
| Logs exist but nobody reads them | Railway isn't provisioned, so nothing alerts | The brief asks for logs and that's what this delivers. When hosting exists, an alert on `GRADING_MODEL_UNAVAILABLE` and `GRADING_DEGRADED` should be added. A scheduled CI check would need the key in GitHub, which `ops/PROJECT.md` rules out for now |
| Occasional slow replies (3 of 52 took over 5 s) | `reason=timeout` | Cap is 12 s and the slowest seen was 9.1 s. Watch it |
| Google quietly reroutes | `GRADING_MODEL_REROUTED` at the next boot | Re-run `eval-set.json` on the new model |
| App available to under-18s | Store age rating | The terms prohibit it, so the PM needs to set the beta to 18+ |

## 6. Tasks

Branch from `main` **after PR #66 merges**, as `fix/grading-model`. Don't stack on #66, and if it hasn't landed, wait.

1. **Default model.** `model-defaults.ts`, read it in `GeminiLlmClient` through `modelOrDefault`, add the 15-second SDK timeout, comments and `.env.example`. Spec with a mocked SDK.
2. **Classified errors.** `LlmCallError`, the wrap around `generateContent`, the `GRADING_DEGRADED` line. Specs for each reason.
3. **Startup check.** `checkModel()`, `onApplicationBootstrap()`, the four startup lines. Specs on fakes, including the test-env no-op.
4. **Lesson fallback guard.** `checks.service.ts` and its spec.
5. **Verify.** `pnpm typecheck && pnpm lint && pnpm test`, then run the live proof above before handing over, and record it in `dev.md`. Pace live calls under 15 per minute, because this key is rate-limited and a 429 would look like a failure.

**For the Lead, outside this plan and outside what I may edit:** update "Gemini 2.5 Flash" in `ops/PROJECT.md` and `progress.md`, and add the billing blocker to `ops/BLOCKERS.md`.
