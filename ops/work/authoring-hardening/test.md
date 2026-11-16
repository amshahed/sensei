# Test: authoring pipeline hardening

Unit `authoring-hardening`. Tester, 2026-11-16. PR #82 (`feat/authoring-hardening`).

## Verdict: PASS on `89722a5`

Every brief item is delivered, or deferred with a reason as the plan allows. Each item has tests that fail on `main` and pass on the branch. A lost reply is saved, costed against `--max-cost` and recovered at $0 through the real CLI. Lesson 67 is recovered with `--recheck` at $0. The gate adds no new error on approved or published content. The swap matches `content-review.md` §3 step 1 exactly, and the rebuilt outline differs only in the two ch07 lessons and the one sound stage. Nothing found blocks the merge. T1 (stale README) should be fixed as a docs-only change before wave 3 (justified below).

A new commit voids this PASS.

---

# 1. Evidence

All of it ran in my own detached worktrees (`.claude/worktrees/test-82` at `89722a5`, `.claude/worktrees/test-82-main` at `main` `1499a2d`). Scripts were throwaway, in the scratchpad. I read the main checkout's `tools/authoring/` but never wrote to it. The only database access was read-only: `SELECT`s on the throwaway branch `test-78-check-explanation` (`br-red-forest-baxm7pzr`), one `SELECT slug FROM "Lesson"` on live, and two `findMany` reads on live by the real `--recheck` CLI. No model call was made.

| What | Result |
|---|---|
| `pnpm typecheck && pnpm lint && pnpm test` at `89722a5` | Exit 0. API 61 suites, **1438 tests passed** |
| CI on PR #82 | `verify` SUCCESS on `89722a5` |
| PR's changed and new specs run against `main`'s source (spec files and `typed-answers.ts` overlaid on main) | **51 tests fail**, plus 2 suites fail to load: `item-refs.spec` (no module) and `publish.spec` (main's `publish.ts` runs `main()` on import). Per item in section 2 |
| Swap check: `main`'s outline with `content-review.md` §3 step 1 applied by hand, compared with the PR's outline (keys sorted) | **Identical.** Only `f142305` touches `apps/api/data/` |
| Rebuild check: `compile()` on both outlines with the same rows and clock | `main` compiles to the live `skeleton.json` exactly (apart from `generatedAt`). Diff `main`→PR: **only** `chapters[6].lessons[5]`, `chapters[6].lessons[6]`, `soundStages[5].lessonId` |
| Item rows for the validator: all 342 item ids named by the outline or any draft, on the throwaway branch | 342 of 342 exist, 0 with a type unlike the id's kind |
| Live database: `Lesson` slugs for ch07 | l01 to l05 only, so neither swapped lesson is published |
| Acceptance scan (tech.md §4 check 1): 100 files (61 drafts, 2 rejected, 37 `published/`), gated by `main`'s rules on `main`'s skeleton and by the PR's `publishRefusals` and the recheck path (repoint, transform, validator, rules) on the swapped skeleton. ch07-l06 and l07 were gated under their post-rename ids | See section 3 |
| Real CLI, failed reply (section 4) | Saved, costed, skipped, recovered at $0 |
| Pre-edit lesson 13 from `corrections.jsonl` | `main`: 0 errors. PR: **5 I-Reading Teach errors** (`yama`, `tori`, `wani`, `nori`, `hon`) |
| Code review | Done by hand, line by line, over the non-spec diff. I didn't run `/code-review high`, because the Lead said usage is tight and to start no sub-agents. The Developer's `/code-review high` findings are judged in section 6 |

---

# 2. Brief items

| # | Item | Status | How checked |
|---|---|---|---|
| 1 | A paid draft is never thrown away | **Delivered** | Fails on main: 15 tests (14 `draft.spec` failed-reply tests, plus `lesson-prompter.spec` non-JSON). Real run: section 4 |
| 2 | A harmless slip doesn't cost a draft | **Delivered** | Fails on main: 6 `lesson-prompter.spec` tests in "a reply that is not quite a draft". Real run: a reply with `grading: "ai"` and no rubric was recovered as a draft with no `grading` (section 4 c) |
| 3 | P5 stops rejecting fair drafts (F1, F2, F5, H.2.d wording) | **Delivered** | Fails on main: 16 `course-rules.spec` tests (English probes, lesson 67, F2 catches, F5 `tei`, `gakko`). Lesson 67's real rejected file passes the PR gate (section 3). The H.2.e pin passes on main by design (wording only) |
| 4 | An undeclared item is fixed or refused | **Delivered** | Fails on main: 2 `draft.spec` tests, plus `item-refs.spec` and `publish.spec`. Real data: in lesson 22 (`ch05-l02`) I garbled two checks. q3, whose answer is ありがとうございます, was repointed. q1, whose answer is "thank you", was refused by `publishRefusals` and written to `.rejected.json` with a `structure:` error, at $0. `authoring:publish` still runs `main()` under ts-node |
| 5 | I-Reading gives no answers away | **Delivered** | Fails on main: `course-rules.spec` lesson 13 pattern, and the `lesson-prompter.spec` I-Reading line. The real pre-edit lesson 13 gives 5 errors. Approved lessons 4, 8, 13, 32 and the café menu pass |
| 6.1 | Open check only where the note asks | **Delivered** | Fails on main: `course-rules.spec` lesson 47, `outline-compiler.spec` (only `ch17-l07`), `lesson-prompter.spec` prompt line. Scan: exactly lessons 47 and 75, q4 |
| 6.2 | A typed check doesn't answer itself | **Delivered**, with T2 | Fails on main: `course-rules.spec` `'ka'` and `konnichiwa`, `typed-reading.spec` F4 |
| 6.3 | Practice templates in `production` mode | Deferred (tech.md 1.8) | Accepted. The publisher doesn't store templates |
| 7 | Swap 38 and 39 | **Delivered** | Fails on main: 2 `outline-compiler.spec`, 1 `typed-reading.spec`, 1 `course-rules.spec` (ー at 38). Swap and rebuild checks in section 1 |
| 8 | Particle phrases and critic `example-feel` | Deferred (tech.md 1.8) | Accepted |

**Acceptance criteria**

- *Each item has a test that fails on main and passes after:* met (H.2.e pin excepted, as planned).
- *Lessons 44, 53, 54, 55, 74 and 77 recoverable for at most one redraft each, and lesson 67 by `--recheck` at $0:* met. Any failure after the paid call is now saved and recoverable at $0 (section 4). Lesson 67 was recovered with the real CLI: "rechecked 1 … ~$0.0000", and the saved draft is byte-identical to the rejected file minus `courseRuleErrors`.
- *The gate passes on every approved or published lesson:* no new rule hits approved content. Lesson 20 (`ch04-l06`, live) still fails the **existing** F.2.d particle rule, identically on `main`. That is already recorded in `ops/CHECKPOINT.md` ("republishing it is refused until its passage drops と and の").
- *After the swap, the rebuild changes only the two ch07 entries and the one sound stage:* met, checked before the merge with `compile()` (section 1).

---

# 3. Acceptance scan

| File | `main` gate | PR (`publishRefusals` and recheck path) |
|---|---|---|
| `output/ch08-l07.json` (lesson 47) | 0 | **NEW** `check q4: an open check is only allowed where the outline's author note asks for one` |
| `output/ch12-l04.json` (lesson 75) | 0 | **NEW**, same, q4 |
| `output/ch11-l03.rejected.json` (lesson 67) | `spells out "zero"` | **0** |
| `output/ch12-l05.rejected.json` (lesson 76) | 2 kanji 木 | same 2 |
| `output/ch04-l06.json` and `published/ch04-l06.json` (lesson 20) | 3 particle | same 3 (pre-existing) |
| `output/ch07-l06.json`, the reading draft, gated as l07 | 44 untaught-kana errors (the draft was edited for the post-swap order) | **0** |
| The other 93 files, including the sounds draft gated as l06 | 0 | 0 |

0 `structure:` errors and 0 repoints anywhere. This matches `dev.md` section 4.

---

# 4. Failed-reply lifecycle, exercised

`runDrafts` (the real function) was driven with a fake model client and a scratch output directory. Then the real CLI was run from the worktree with the main `.env`:

1. Lesson 67 content with q1 `grading: "ai"` plus a rubric, 20000 in / 4000 out, `--max-cost 0.15`. It printed `[reply] FAILED — check.questions.0.grading: Invalid input: expected "open"  (… (~$0.2000)) → …failed.json`, then `stopping before "foundation-ja-ch11-l04"`. Summary `failed 1, costUsd 0.2`, **1 model call**. The file holds `reply` (the JSON), tokens, `costUsd`, `stopReason` and `error`.
2. A plain rerun printed `skipping … .failed.json exists`, with no call for that lesson.
3. `--force`, with a reply cut off at `max_tokens`. The old file moved to `.failed.prev.json`, and the new one holds `raw` (text) with `stopReason: max_tokens`. The redraft was told the earlier parse error ("1 rejection reasons").
4. **Real CLI** `draft.ts foundation-ja-ch11-l03 --recheck`:
   - (a) On the cut-off text: `still FAILED … (recheck, $0)`, file kept.
   - (b) After a hand fix that puts the JSON in `reply` but keeps the rubric: still failed, error rewritten, exit 1.
   - (c) After the rubric is removed: `[validator] pass`, `recheck of a failed reply, no model call, $0 → …json`, `rechecked 1`, `.failed.json` removed, exit 0. The saved draft has no `grading`, and its meta comes from the original call.

---

# 5. Findings

| # | Severity | Where | Finding | Status |
|---|---|---|---|---|
| T1 | Medium (docs) | `tools/authoring/README.md:118-180` | The authoring manual isn't updated, and tech.md's change list missed it. It still says a run skips only `<id>.json`/`<id>.rejected.json`, that the summary reports "drafted, skipped, rejected and estimated cost", and that `--recheck` reruns only `<id>.rejected.json`. It doesn't mention `.failed.json`, the hand-fix procedure (edit `reply`, never `raw`; a cut-off `raw` is always refused), the numbered `.failed.prev.N.json`, the validator now rejecting, or the gate rules this PR rewrote or added (the P5 matcher, I-Reading Teach, self-answering prompt, open check). The Lead's next steps (redraft 44 to 77, wave 3) are where these show up | **Not fixed. Justified as non-blocking:** no code depends on it, the CLI's own messages name the file and the recheck path, and tech.md §1.1 and §6 describe the procedure. It's a docs-only change, which the operating model (§4) lets skip the gates. **Recommend** the Lead or Developer lands it before wave 3 drafting |
| T2 | Low | `course-rules.ts` `ownAnswerInPrompt` / `isLookalike` | The self-answer rule skips English lookalikes, so "Type the kana that reads 'a'" (あ), `'no'` (の) or `'to'` (と) passes, although it answers itself exactly like `'ka'`. I scanned all 100 files for closed typed checks whose prompt spells a lookalike answer: the only hit is lesson 67 q8 `zero`, already flagged to the PM in tech.md §5. Every kana lesson is already drafted | Justified. The gap is latent, the plan names the trade-off, and PM review is the backstop. Revisit if a kana lesson is redrafted |
| T3 | Low | Commit `ef66d5e` | tech.md §6 asks that each commit be green on its own. `ef66d5e` fails `tsc` (duplicate `TYPED_READING_PROMPT`), and `9e8d8b3` fixes it | Justified (dev.md §2.4). Squashing needs a force-push, which is on the stop list. Only a bisect is affected |
| T4 | Low (docs) | `dev.md` §1 | The table lists `89722a5` before `f142305`, but the swap `f142305` comes first and the review fixes `89722a5` come last, so the swap isn't the PR's last commit as tech.md §1.9 planned. It is still in a commit of its own, touching only the outline, three specs and the `typed-answers.ts` comment. `dev.md` is uncommitted | Justified. Nothing depends on the order. Correct the table when `dev.md` is committed |
| T5 | Low | `item-refs.ts` | The repoint applies only to checks. A practice template on an undeclared item is refused (validator), so it needs a hand edit and `--recheck`, or a redraft | Justified. The brief names checks only, and refusal is safe |

No correctness, data-integrity or security defect found. A crash before the paid call isn't saved, but nothing was paid by then. Wrong inputs in my probes (a hand-broken JSON file, a lesson without course context) fail loudly rather than silently.

---

# 6. The Developer's five unfixed code-review findings

| # | Finding | My verdict |
|---|---|---|
| 1 | `spellsOut` misses `sayonara` for さようなら and `tokyo` for とうきょう | **Agree, justified.** Checked: the grader marks `sayonara` (さようなら), `tokyo` (とうきょう) and `arigato` (ありがとう) **wrong**, and `sayounara` and `arigatou` right. The answer line the app shows is `sayounara` and `toukyou`. Copying `sayonara` from Teach scores nothing, so it isn't a free answer. "Sayonara" and "Tokyo" are also English words, the same class as `mango` for マンゴー, which the collapsed form wrongly flagged in approved content. A Teach line saying "sayonara" is a quality point for PM review, not a gate error |
| 4 | A rechecked failed reply that is rejected overwrites an older `.rejected.json` | **Agree, justified.** It's the newer paid attempt, and F.2.a has always let a `--force` rejection replace the older one. Before this PR the reply was lost outright. Keeping `.rejected.prev.json` is correctly routed to the Tech Lead as a separate unit |
| 6 | `isFairTypedReading` keeps the `looseRomaji` substring clause | **Agree, justified.** I read `typed-reading.ts` and `typedReadingProblems`. A false "unfair" only makes the transform rewrite the prompt to `Read this word and type how it sounds: <word>`. Without the standard prefix that prompt has no Latin text, so the gate then passes. It never rejects content. The clause still pins F6 `(oka asan)` |
| 8 | Open-check permission is a substring of note prose | **Agree, justified.** `outline-compiler.spec` pins exactly `ch17-l07` over the real outline, so a reworded note fails CI. An outline flag would have broken the swap's clean rebuild diff |
| 10 | `keepPrevious` duplicates the `.prev.json` rename | **Agree, moot.** Two different behaviours: numbered and never overwritten for paid failed replies, one slot for drafts (F.2.a) |

The five fixed ones (2, 3, 5, 7, 9) are covered by passing tests. I exercised 2, 3 and 7 for real in section 4.

---

# 7. Not verified

- **A real paid model reply.** The constraint was no paid calls. The fake client returns the same shape as the SDK (`content`, `usage`, `stop_reason`), and `generateDraft` is the real code. Residual risk: an SDK response shape not seen before. Low.
- **A real `authoring:publish` refusal with the live database.** It would need the CLI pointed at live with a broken draft, and a refusal that failed to fire would write live rows. Instead the exported `publishRefusals` was run on real files with item rows from the throwaway branch. The CLI was shown to still run `main()`.
- **The actual post-merge rebuild** (`authoring:outline --force` in the main checkout). It's the Lead's step. My pre-merge `compile()` diff uses the real compiler on both outlines, and `main`'s output equals today's `skeleton.json`, so the Lead's diff should show only the expected three entries plus `generatedAt`.
- **The wave driver with `.failed.json`.** It isn't in this PR. It's the Lead's tweak (tech.md §6 step 2). Until then a driver rerun logs `FAILED $0` for a lesson the CLI skipped.
