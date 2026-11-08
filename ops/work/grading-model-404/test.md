# Test: AI grading model no longer available

**Verdict: PASS** on commit `eccdfbd2f9bc06e2366f4bf5a9230368197a08bf` (PR #69, branch `fix/grading-model-404`). Round 2, scoped to the F1 fix. Round 1 was FAIL on `d33a444`.

F1 is fixed. During a real outage, an item met for the first time now reaches the review schedule, no false "Again" is recorded, and a learner with an existing row is untouched. CI is green on this exact commit.

**One thing for the Tech Lead, not blocking.** The stability cost in `dev.md` is right for the first step but leaves out what happens after it. The seed also raises the card's difficulty, so the gap widens at every later review (F7). In practice that is about one extra review in the first year, it errs towards reviewing sooner, and it still beats `main` today. The Developer accepted it on the smaller numbers, so the owner of the data approach should see the real ones.

Any new commit voids this PASS. The diff from round 1 touches only `checks.service.ts` and its spec, so a new commit that stays inside those two files needs the full verification and the F1 harness again, not the 54-grade eval.

## Evidence on `eccdfbd`

| What | Result |
|---|---|
| `pnpm typecheck --force && pnpm lint --force && pnpm test --force`, own worktree, Node 26 | Exit 0. 0 of 7 tasks cached. 49 suites, 625 tests |
| CI on this SHA, Node 22 (`gh api .../commits/eccdfbd.../check-runs`) | `verify` success, run 42496689652, attempt 1 |
| PR state | Head is `eccdfbd`, mergeable, clean. The 2 commits on `main` it lacks change only `ops/`, `decisions.md` and `progress.md` |
| Diff `d33a444..eccdfbd`, read line by line | `checks.service.ts` and its spec only. Scored path unchanged, and only moved under the shared `try` |
| `/code-review high` on the whole PR | 10 candidates, each settled under Findings. One new point became F7 and F8 |
| Round 1's F1 reproduction, unchanged | Failed on `d33a444`. Passes here |
| 10 mutations of the fix against `checks.service.spec.ts`: no upsert, no seed, seed before upsert, Good seed, write Again instead, seed only when wrong, failed write reaches the learner, also seed when scored, blank counted as outage, seed overwrites a row | All 10 caught. `dev.md`'s claim holds: no upsert fails 1 spec, no seed fails 3 |

**The F1 path, run for real.** Built `dist`, real `AppModule` over real HTTP, dev-stub auth, real SDK, real 404 from `gemini-2.5-flash`, real `ChecksService`, `GradingService` and `MasteryService`. Only `PrismaService` was replaced, by an adapter on a real SQL engine (in-memory SQLite) with the foreign keys and unique index copied from `prisma/migrations/0_init`.

| Case | Result |
|---|---|
| Engine control: insert with an unknown user or item, `skipDuplicates` on | Both rejected, `FOREIGN KEY constraint failed` |
| **New learner, no `User` row, no item row, "kitty cat" for "cat"** | 201, `correct: false`. `User` row created. 1 mastery row: Hard seed, stability 1.29, `lapses` 0, due in 2.0 days, mastery 0.042, all three per-skill scores 0. `GRADING_DEGRADED reason=model_unavailable model=gemini-2.5-flash` at ERROR. No write-back error |
| Answer resubmitted during the outage | 201, still 1 row, byte-identical |
| Does it reach the learner's schedule? | `GET /reviews/due` empty today, as intended. `getDue` 2.2 days out returns it. Due within a year: 1. Practice pool: 1. `GET /progress`: mastered 0 |
| **Control: `enterSchedule` with the upsert removed** | 201, but `Mastery write-back failed ... FOREIGN KEY constraint failed`, no user, no row. The upsert is what makes it work, as `dev.md` says |
| **Learner with an existing row, already due** | 201. Row byte-identical (FSRS state, due, last review, scores). Still due |
| A real Good, then a fallback on the same item | Row byte-identical |
| Exact match during the outage | 1 model call, `correct: true`, real Good, stability 2.31, `recall` 0.4 |
| Blank answer during the outage | 0 model calls, real Again, stability 0.21. Still a real miss |
| Open check with no exemplar during the outage | `correct: true`, "Answer recorded", Hard seed. Behaviour change, declared in `dev.md` (F8) |
| Database throws on the user upsert | 201, grade returned, error logged, no row |
| Default model, "kitty cat", 1 served grade | 201, `correct: true`, AI feedback, real Good, stability 2.31. Normal path intact |
| Log scan, 96 lines | API key in none. Learner answer in none |

**Spend:** 11 Gemini calls: 10 returned 404, 1 served. About $0.0002 at paid rates, $0 billed. The limit was $0.02. No Anthropic calls from the harness. No Neon branch created. The live database was unreachable: `DATABASE_URL` was a placeholder and only Google was contacted.

## The accepted cost: is it what `dev.md` says?

Partly. FSRS is the spaced-repetition scheduler. *Difficulty* is its per-card estimate of how hard the item is, from 1 to 10. It scales every later interval and barely recovers: 5.10 only falls to 5.02 after eight straight Goods.

| Path for one item | Stability | Difficulty | Due (days) | Next gaps if every review is Good (days) | Reviews in year one |
|---|---|---|---|---|---|
| Real Good first, nothing fell back | 2.31 | 2.12 | 3 | 14, 57, 196, 586 | 4 |
| **Seed, then a real Good in the same lesson** | 1.29 | 5.10 | 3 | 8, 26, 74, 190 | 5 |
| Seed only, then reviews | 1.29 | 5.11 | 2 | 7, 23, 66, 171 | 5 |
| Real Again first | 0.21 | 6.41 | 1 | 3, 8, 22, 54 | 6 |
| **Seed, then a real Again in the same lesson** | 0.33 | 8.38 | 1 | 3, 5, 10, 20 | 8 |
| `main` today: fallback Again, then a real Good | 0.21 | 6.40 | 3 | 3, 9, 24, 60 | 6 |
| `main` today: fallback Again, then a real Again | 0.07 | 8.81 | 1 | 3, 3, 5, 10 | Over 8 |

| `dev.md` claim | Measured |
|---|---|
| Hard seed: 1.29, 2 days, 0.042. Again: 0.21, 1 day, 0.007. Good: 2.31, 3 days, 0.074 | **True** |
| Real Good after a seed: due in 3 days, stability 1.29 not 2.31 | **True** |
| Next interval 7 days rather than 14 | **Close.** 8 rather than 14. The 7 belongs to the seed-only path |
| Real Again after a seed: due in 1 day as normal | **True, but incomplete.** Difficulty 8.38 not 6.41, and `lapses` 1 not 0. Nothing reads `lapses` today |
| "Errs towards reviewing sooner" | **True** |
| "Only on items that fall back during an outage" | **Understated.** A 429 or the 12-second cap also falls back, about 1% of grades in round 1. It also needs the fallback to come first: a real result first costs nothing (row above) |
| Not stated | **The cost compounds.** Gaps of 190 days against 586 by the fifth review, not one short interval |

## Promises

Only `checks.service.ts` changed, so everything not exercised above is carried from round 1.

| Promise | Status | How checked |
|---|---|---|
| **P1.** A right answer in my own words is graded right | **Holds when the model answers within 12 s.** About 1% of grades won't (F2) | One live paraphrase on this commit. 54 of 54 eval grades carried from round 1 |
| **M1.** Lost model visible at startup | **Holds** | Carried from round 1. The client is unchanged |
| **M2.** Lost model visible while running | **Holds** | Real 404 over HTTP on this commit, ERROR line with reason and model |
| **Support.** An outage isn't a learner's miss in lessons | **Holds** (was Partly) | No false Again, first contact scheduled, existing rows untouched. Table above |
| Rollback by env var | **Holds** | Carried from round 1 |

## Findings

**F1. Medium. Fixed and verified.** `apps/api/src/checks/checks.service.ts:99-101`, `:121-128`. A first-contact item that fell back never reached the schedule. It now gets a Hard seed after the user upsert, inside the `try`.

**F2. Medium. Justified, needs a PM decision.** `checks.service.ts:108-113`, `packages/types` `CheckResultDto`, `apps/mobile/src/lesson/LessonPlayer.tsx:296`. During a fallback or a cap hit, a right paraphrase shows as wrong in a lesson and lowers the end score. Reconfirmed: `correct: false` is unchanged by this fix. `tech.md` section 5 accepts it as a PM call, and `dev.md` routes it.

**F3. Low. Justified here.** `apps/api/src/llm/gemini-llm-client.ts:50-56`, `:201-205`. A 400 or 403 (bad key) logs a WARN `UNCONFIRMED`, like a 503. The line carries the provider's reason, every grade still logs at ERROR, and the brief is about a model disappearing. Worth a distinct reason when alerting is added.

**F4. Low. Justified by `tech.md`.** `apps/api/src/grading/grading.service.ts:98`. With no key, a grade falls back with no tagged line. `tech.md` scopes the tag to grades "after a model call failed".

**F5. Low. Justified by `tech.md`.** `grading.service.ts:146`. Timeouts and bad replies log `model=unknown`. The contract allows it, and the boot line names the model.

**F6. Low. Justified by `tech.md` and `dev.md`.** `gemini-llm-client.ts:186`. `REROUTED` compares exact strings, so a dated name would warn falsely.

**F7. Low. New. Justified here, Tech Lead to note.** `dev.md` round 2 "Known cost"; behaviour at `checks.service.ts:127` through `mastery.service.ts:169`. The acceptance understates the cost, as the tables above show.
- Scenario: an open check falls back, then a multiple-choice check on the same item is graded right in the same lesson. The item gets 8, 26, 74, 190 day gaps instead of 14, 57, 196, 586, so 5 reviews in year one instead of 4.
- Why it doesn't block: it errs towards more practice, not less. It never records a false miss. Every seeded path is better than the matching path on `main` today. The cost is only against the round 1 commit, which didn't schedule the item in the F1 case at all. No real learners exist.
- Optional, Tech Lead's call: a card with no rating dated 2 days out removes the cost entirely. On the real scheduler a real Good after it gives 2.31, 2.12, 3 days, and a real Again gives 0.21, 6.41, 1 day, identical to first contact. `dev.md` rejected a New card "due now" for flooding Reviews, which a future date avoids. It would still need the new write path `dev.md` objected to.

**F8. Low. New. Justified: comments only.** `grading.service.ts:41-42` still says the caller "must NOT feed an unscored result into FSRS, or the schedule fills with fake passes", and `checks.service.ts:99-101` now writes a Hard seed for exactly that result. The `seedInferred` doc at `mastery.service.ts:157-161` names only assessment and placement. The no-exemplar case was deliberately kept out of FSRS before. It now gets a low-credit seed (mastery 0.042 against a 0.7 "mastered" line), for the same reason as F1, and `dev.md` declares it. Specs pin the new behaviour, so a future reader can't quietly undo it. Fix the comments the next time either file is touched. It isn't worth voiding this PASS.

**Review candidates dropped, no action:**
- The seed counts in `recentRate.thisWeek` on `/progress`. True (measured 1), and the old Again write did the same on `main`. The learner did meet the item.
- The startup check sends no schema, so a model that rejects JSON mode would pass it. `tech.md` specifies no schema, and each grade would still log `GRADING_DEGRADED`.
- `enterSchedule` repeats the user upsert. It is the pattern at 8 other call sites, so a refactor preference. Moving it into `MasteryService` can wait.
- An abort while reading the body is labelled `provider_error`, and the fallback-miss rule is duplicated. Both dropped in round 1, unchanged.

**Noticed, outside this unit:**
- `LessonPlayer` never shows the AI's `feedback`. For the PM.
- `answer` has no length limit on `/checks/:id/answer`, only Express's default body limit. For the Tech Lead.
- PR #70 merges cleanly with this one (`git merge-tree`, no conflicts) and leaves `seedInferred` unchanged. A seed row fits G.4.e's "a row means a lesson Check". The combined tree was not built. Whichever PR merges second gets its own CI run. #70 is also what brings open checks, so it makes this path live.

## Carried forward from round 1 (`d33a444`, not re-run)

Valid because the diff between the two commits touches neither the client, the prompt, the model default nor `GradingService`.

| What | Round 1 result |
|---|---|
| Real client and `GradingService`, `eval-set.json` × 3, default model | 54 of 54 right verdicts, all by AI. 30 of 30 paraphrases accepted, 24 of 24 wrong answers rejected. Median 785 ms, max 1.86 s. "Easy" on 3 of 30 right answers |
| 11 mutations of the client, log and guard code | All caught |
| Real `RecallGraderService` (Reviews and Practice), default model | "kitty cat": `correct: true`, `scored: true` |
| Built app, default model | `GRADING_MODEL_OK requested=gemini-3.5-flash-lite served=gemini-3.5-flash-lite`, `/health` 200 |
| Built app, `gemini-2.5-flash` | `GRADING_MODEL_UNAVAILABLE` at ERROR with no learner action, `/health` 200, boot not delayed |
| Built app, `gemini-3.1-flash-lite` (rollback switch) | `GRADING_MODEL_OK` |
| Built app, `gemini-3.5-flash` | `GRADING_MODEL_REROUTED requested=gemini-3.5-flash served=gemini-3.6-flash` |
| Built app, invalid key / no key | `UNCONFIRMED reason=provider_error` / untagged WARN. `/health` 200 |
| Real SDK with `fetch` stubbed: 404, 429, 503, 400, 403, network down, non-JSON, off-enum, `MAX_TOKENS`, safety block, rerouted | Each gets the contracted tag and reason. A sentinel answer never reached a log |
| Hung `fetch`, real timers | Grade gives up at 12,002 ms, `reason=timeout`. Startup check `UNCONFIRMED` at 15,001 ms. No unhandled rejection |

**The four deviations in `dev.md`, checked in round 1:** abort matched by class is correct (the SDK class never sets `name`). Blank stays a real miss is correct (reconfirmed above). Two log messages made safe is correct. The branch name is harmless.

**The 12-second cap:** 1 hit in 124 served grades, roughly 1%, and on that sample could be as high as about 4%. The mobile client aborts at 15 s (`apps/mobile/src/api.ts:36`), so raising the cap means changing the client too.

**Is a lost model visible?** Yes, in logs only. Nothing alerts, because hosting doesn't exist yet (`tech.md` section 5).

## Not verified

- **The new path on real Postgres through real Prisma.** Neon branches are with the founder, and the live database must not be written to. No local Postgres exists on this machine. The foreign keys were enforced by SQLite with the constraints copied from the migration. What that leaves untested is the SQL Prisma generates. `user.upsert` and `seedInferred` are the same calls `assessments.service.ts` already makes, so I rate this low.
- **A paraphrase through the HTTP API against a real database** (P1 and M2 live proof in `tech.md`). Same reason. The Alpha run closes it once #22a content is published.
- **Real 429, 503 and 12-second timeouts from Google.** Carried from round 1, forced through the real SDK with a stubbed `fetch`.
- **The mobile screens.** No mobile code changed. What a learner sees on a fallback was read from source, not run.
- **The 54-grade eval and the boot checks on this commit.** Not repeated, for the reason above. One live grade on the default model served as the spot check.

## State left behind

Worktree `.claude/worktrees/test-69`, detached at `eccdfbd`, clean (`dist` rebuilt, gitignored). The harness scripts were in the session scratchpad and aren't kept. All mutations and the temporary reproduction spec were removed.
