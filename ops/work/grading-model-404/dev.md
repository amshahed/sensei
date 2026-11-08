# Dev: AI grading model no longer available

Branch `fix/grading-model-404`, PR #69, worktree `.claude/worktrees/wt-grading`.

## What changed

All under `apps/api/`, all files `tech.md` names, plus specs.

| File | Change |
|---|---|
| `src/llm/model-defaults.ts` | `DEFAULT_GEMINI_GRADING_MODEL = 'gemini-3.5-flash-lite'` |
| `src/llm/llm-client.ts` | `LlmFailureReason`, `LlmCallError` |
| `src/llm/gemini-llm-client.ts` | `modelOrDefault`, 15-second SDK timeout, classified errors, `checkModel()`, `onApplicationBootstrap()` |
| `src/grading/grading.service.ts` | `GRADING_DEGRADED` line with a reason |
| `src/checks/checks.service.ts` | A fallback "wrong" records no verdict in FSRS. The item is still scheduled (round 2, below) |
| `src/grading/grading.prompts.ts`, `.env.example` | Comments name the new model. `.env.example` also no longer says the free tier covers early beta |

## Deviations from tech.md

1. **Abort errors are matched by class, not by name.** `tech.md` says `err.name === 'GoogleGenerativeAIAbortError'`. In SDK 0.24.1 that class never sets `name`, so `new GoogleGenerativeAIAbortError('x').name` is `'Error'` (checked by running it). The planned check would have logged every timeout as `provider_error`. It uses `instanceof`, and a spec drives the real SDK with a stubbed `fetch` to pin it.
2. **A blank answer stays a real miss in lessons.** The planned one-liner would also have stopped scoring blank answers, because `GradingService` returns those as `gradedBy: 'fallback'`, `correct: false` without calling the model. `RecallGrader` returns early on blank and keeps them scored, so the guard adds `answer.trim().length > 0` to match. Spec added.
3. **Two log messages made safe.** `tech.md` says the learner's answer is never logged, but two existing messages could carry it. `JSON.parse` errors quote the reply, and the off-enum error printed the rating value. Both are now fixed strings.
4. **Branch name** is `fix/grading-model-404`, as the Lead's task said, not `fix/grading-model`.

## Tester note N2 (thinking shares the 512-token budget)

Doesn't apply to the new default, so no code change. On `gemini-3.5-flash-lite` thinking tokens were 0 on all 52 of the Tech Lead's successful probes and on the 17 eval grades I could read usage for. The largest reply was 36 tokens, well under 512.

It can come back with an env override: `gemini-3.6-flash` spent 173 thinking tokens on its one probe, which still fits. If a cut-off ever happens it now logs `GRADING_DEGRADED reason=bad_response` containing "512-token limit", and a spec pins that line. `checkModel()` reads no reply text, so its 5-token cap can't produce a false failure on a thinking model.

## Verification

`pnpm typecheck && pnpm lint && pnpm test`: all pass, 49 suites, 622 tests.

**Live, all on this project's key. Under $0.01 at paid rates, about 25 Gemini calls, nothing billed (free tier). No Anthropic calls.**

| Check | Result |
|---|---|
| Real client + `GradingService` over `eval-set.json`, paced at 5 s, no env override | 18 of 18 right verdicts, 10 of 10 paraphrases accepted. 17 graded by AI |
| The 18th, `f08-wrong-phrase` | **Hit the 12-second cap** and fell back, logged `GRADING_DEGRADED reason=timeout`. Verdict was still right, because fallback said wrong. Re-run alone: AI, Again, 4.2 s |
| Real `ChecksService` + client, database stubbed, `gemini-2.5-flash`, "kitty cat" | `GRADING_DEGRADED reason=model_unavailable`, marked wrong, **0 FSRS writes** |
| Same on the default model | Marked right, AI feedback, 1 FSRS write rated Good |
| Built API booted with `LLM_GRADING_MODEL=gemini-2.5-flash` | `GRADING_MODEL_UNAVAILABLE` with no learner action. `/health` 200 |
| Built API booted on the default | `GRADING_MODEL_OK requested=gemini-3.5-flash-lite served=gemini-3.5-flash-lite`. `/health` 200 |

## Not verified

**A paraphrase through the running HTTP API (P1 and M2 live proof in `tech.md`).** No route reaches AI grading on the live database without seeding it: it holds 5 multiple-choice checks and one lesson, and a new user has nothing to practise. I tried to create a throwaway Neon branch (`test-grading-404`) to insert an open check. The permission system denied it, so I stopped there and did not write to the live database or try another way of creating a branch. No branch exists. The stubbed-database rows above are the substitute: everything real except Prisma and HTTP.

To close it, the Tester needs a Neon branch with one open check (`data: {"exemplar":"cat"}`, no `answer`), and `POST /checks/:id/answer` in dev-stub mode. Or wait until open checks are published.

## For the Tester to look at hard

- **The 12-second cap is reachable.** One grade in 18 went past it, where the Tech Lead's slowest was 9.1 s. In a lesson the learner sees "Not quite" on that answer. `tech.md` lists this as "watch it", and one sample doesn't show a rate.
- **`REROUTED` compares strings exactly.** A dated or suffixed version name such as `gemini-x-001` would warn. All 3.x probes returned the exact requested name, so I left it strict as planned.
- **The SDK doesn't clear its timeout timer** after a successful call, so each grade leaves a 15-second timer that aborts nothing. Harmless on a server, and the reason my scratch scripts end with `process.exit`.

## Round 2: Tester F1 (commit `eccdfbd`)

**Finding accepted.** A fallback miss wrote nothing, and `recordCheckResult` is the only lesson path that creates an FSRS row, so a first-contact item never reached Reviews or Practice.

**Fix.** When an open result is unscored, `ChecksService` puts the item on the schedule with `mastery.seedInferred`. F3 to F6 left as they are.

**Is `seedInferred` right? Yes, but the patch as suggested was incomplete.**

Measured on the real scheduler, `enable_short_term: false`:

| First event | Stability | Due | Mastery |
|---|---|---|---|
| Again (the old behaviour, and a false verdict) | 0.21 | 1 day | 0.007 |
| **Hard seed (this fix)** | 1.29 | 2 days | 0.042 |
| Good | 2.31 | 3 days | 0.074 |

- **Enters the schedule:** one row, due in 2 days, so it reaches Reviews and Practice.
- **No false "Again":** `lapses` 0, a passing grade on the card, no `recall` breadcrumb (the per-skill score).
- **No false credit that matters:** mastery 0.042 against the 0.7 "mastered" threshold in `progress.service.ts`. The first real review makes the judgement.
- **Existing rows untouched:** `seed()` skips items that already have a row, so a review already scheduled keeps its date.
- **Rejected, a New card due now with no rating:** it carries no verdict at all, but needs a new write path and puts the item in Reviews minutes after the lesson, which `fsrs.ts` says Reviews must not do.

**The gap in the Tester's patch.** `seedInferred` doesn't create the `User` row, unlike `recordCheckResult`, and `ItemMasteryState.userId` is a foreign key. If an outage hit a learner's first write, the insert would fail, the catch would log it, and F1 would still happen. The Tester's fake didn't enforce the key, so the repro passed. `ChecksService.enterSchedule` upserts the user first, as `assessments.service.ts` does. The new spec's fake enforces the key, and removing the upsert fails it.

**Known cost.** If one check on an item falls back and a later one in the same lesson is graded for real, the seed comes first and FSRS gives same-day re-reviews no stability gain. Real Good: due 3 days as normal, stability 1.29 rather than 2.31, so the next interval is 7 days rather than 14. Real Again: due 1 day as normal. It errs towards reviewing sooner, and only on items that fall back during an outage. Accepted.

**Also changed:** the write now sits inside the existing try/catch for both branches, so a failed seed can't block the learner's response. This also covers the older no-model, no-exemplar case.

**Verification on `eccdfbd`.** `pnpm typecheck && pnpm lint && pnpm test --force`: pass, 49 suites, 625 tests. Mutations: no upsert fails 1 spec, no seed fails 3. Real 404 from `gemini-2.5-flash` through real `ChecksService`, `GradingService` and `MasteryService`, in-memory Prisma enforcing the key: marked wrong, 1 row, `lapses` 0, due in 2.0 days, stability 1.29, no breadcrumb. No Neon branch, no live database contact. One more Gemini call, $0.

**Not verified, unchanged:** a paraphrase through the HTTP API against a real database.

## For the Project Manager (outside this plan)

The learner-facing "Not quite" during an outage or a timeout, already listed in `tech.md` as a PM call. The 12-second observation above adds weight to it.

## State left behind

- Worktree `.claude/worktrees/wt-grading`, on the branch, clean.
- No live data changed. The real API boots only received `GET /health`.
- Live-proof scripts are in the session scratchpad and are not part of the PR.
