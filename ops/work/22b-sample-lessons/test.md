# Test: PR #74, typed reading, `--recheck`, particle gate, N6

Unit `22b-sample-lessons`. Tester, 2026-11-14. **Round 2**, scoped to `b16f481..45b5575`. Round 1 (FAIL on `b16f481`) is summarised under "Carried forward from round 1".

## Verdict: PASS on `45b5575`

- **Commit:** `45b5575e3dc849ea5b103d5ab35baf8970aae90b`, the head of `fix/22b-typed-reading` (PR #74). It was checked out in `.claude/worktrees/test-74`.
- **Why PASS:**
  - Round 1's High finding F1 is fixed. All 9 reproduction cases now pass, and the kana harness rejects nothing in lessons 3 to 17. Real particle uses are still caught.
  - F2 and F3 are fixed, and F4 and F5 stay justified.
  - Verification passes with nothing cached, and CI passes on this exact commit.
  - Every real draft gives the same result as in round 1, and `--recheck` still saves lesson 19 at $0.
- **Not clean:** the review found two new kinds of missed particle use, N1 and N2 below. In both, the rule fails to catch a real use; it never wrongly rejects correct content. `b16f481` caught both, and `45b5575` misses them.
  - I applied the Lead's test for the two backlog cases to them: `main` has no particle-use rule at all, and no published lesson contains either shape.
  - So neither blocks the merge, but both belong in the Tech Lead's backlog item next to `がっこう で も` and `ともだち (friend) と`.
  - If the Lead weighs them differently, N1 is a one-line fix with measured side effects (below).

---

## Evidence (round 2)

| What | Command or method | Result |
|---|---|---|
| Range reviewed | `git log b16f481..45b5575`, `git log --merges` | 8 commits, all linear, with no merge. `origin/main` is **not** in the branch: the merge base is `0625966`, and `95f4fd9` and `868aa69` are missing. That contradicts `dev.md` ("already in the branch"). Both commits touch only `ops/` and `decisions.md`, which the PR doesn't touch. GitHub reports `MERGEABLE`, `CLEAN` |
| Full verification, uncached | `pnpm install --offline --frozen-lockfile`, types build, `prisma:generate`, then `pnpm typecheck --force && pnpm lint --force && pnpm test --force` in `test-74` at `45b5575` | All pass. Typecheck 4/4, lint 1/1, test 2/2, **0 cached**. 57 suites, **1094 tests** (1045 at `b16f481`). Exit 0 |
| CI | `gh pr view 74`, `gh run view 43649089942` | `verify` SUCCESS. The `pull_request` run was on head sha `45b5575` |
| Code review | `/code-review high` on the staged `b16f481..45b5575` diff in `test-74` | 9 items. I re-ran or traced each one before ruling (see Findings). 3 are new and real (N1, N2, N3). The rest are pre-existing or carried over from round 1 |
| Round 1 reproduction, verbatim | A temporary spec (`r2/zz-tester-r2.spec.ts`) built on the spec's own `errors` and `ctxAt` | **9 of 9 pass** (9 of 9 failed on `b16f481`). `ともだち と がっこう` (20) and `はな と ひと` (8) are still rejected |
| Kana harness, lessons 3 to 18 | My round 1 `harness-kana.ts`, against fresh copies (`r2/`) | Lessons 3 to 17: **0 baseline errors and 0 rejected variants** (round 1: 13 of 16 lessons rejected). Lesson 18 has no kana and is skipped, as before. Real uses are still caught: `はな と ひと` (8), `ねこ の なまえ` (6). The only remaining error, `ね ねこ ねずみ` (6), is the script rule (ず and み are untaught), which is correct |
| Every row, column and the full chart | The temporary spec: 15 rows, 5 columns, each row after a word, each row with 。, and the whole chart on one line and across lines, at **every lesson from 2 to 120** | **0 particle errors.** The only one-kana known strings in the slice are に, し, ご, じ and the particles once taught. None comes before a row-final particle kana (と, の, も, よ) |
| Real drafts | My round 1 `harness-real.ts`, against fresh copies | Same as round 1, now with the stretch quoted. Lessons 2, 21 and 43: 0 errors, no change from the transform. Lesson 20: `と in "ともだち と がっこう"`, `の in "おかあさん の しゃしん"` (×2). Lesson 19 rejected draft: 5 errors, then the transform rewrites q2, q4, q6, q8 and q10, leaving 0 errors. It is idempotent and still has 10 questions, and its prompts contain no Latin letters. Originals: lesson 2 is clean, lesson 20 has the same 3 errors, and lesson 43 has か in `teach[7]` (`"あなた は いしゃ です か"`), か and を in q1, and か in q2 |
| F2 and F3 reproductions | My round 1 `harness-misc.ts`, against fresh copies | F2: lesson 20 with 写真 left out gets **0 appended checks**, and the gate gives 1 error, the same as `main`. F3: **1** typed check on がっこう (`がっこう。`), unchanged |
| Real `--recheck` | `authoring:draft foundation-ja-ch04 --recheck` from the `r2/run` sandbox, all API keys blank, live DB read-only (validator) | `drafted 0, rechecked 1, skipped 5, rejected 0, ~$0.0000`, exit 0. The saved lesson 19 differs from the rejected file only in the 5 prompts and the dropped `courseRuleErrors` |
| Publish gate | `publish.ts` from the sandbox, `DATABASE_URL` at `127.0.0.1:1` | Lesson 20 is refused with the 3 quoted errors before any connection, exit 1. Lesson 43 passes the gate, then fails with "Can't reach database server". No write was possible |
| R1.4 prompt line, real skeleton | `buildDraftPrompt` at lessons 2, 19, 20, 43, 44, 89, 112 and 120 | It is present everywhere, right after `GRAMMAR TAUGHT SO FAR`. Lesson 43 omits は, lesson 44 omits は and か, lesson 89 starts at へ, and lessons 112 and 120 list only `ね よ や から まで` |
| Message consumers | Searched `apps/` and `packages/` for the message text | Only specs, the gate and `draft.ts`'s `courseRuleErrors` pass-through. Nothing parses the changed message |
| Originals untouched | `shasum -a 256` of the 16 files in `output/`, `published/` and `corrections.jsonl`, before and after | Identical |

Scripts and outputs are in the session scratchpad under `r2/`. My temporary spec and comparison copies were removed from the worktree, which is back at `45b5575`, clean. No paid call, no Neon branch, no live write, no secret printed.

---

## The Developer's two deviations

**Deviation 4 (the gate compares answers with the grader's `ANSWER_PUNCTUATION`, not `bare()`): correct.**
- The character set is unchanged (`、。,.!?！？`), and the grader's own spec passes unchanged.
- I probed 21 answers for がっこう against the real `WritingEvalService`, with kuromoji loaded:
  - Whenever the gate calls a check fair, the grader accepts both がっこう and `gakkou`.
  - `「がっこう」`, `がっこう…`, `がっこう・`, `〜がっこう`, `がっこう，` and `がっこう．` are unfair and rejected by the grader alike.
  - Spaces, full-width spaces and `。。` are fair and accepted alike.
- **The two disagree in one direction only.** A katakana or rōmaji `correctAnswer` (`ガッコウ`, `gakkou`) is judged unfair, though the grader accepts it. `dev.md`'s "fair exactly when the grader accepts" is therefore really "only when". See N5.

**Deviation 5 (a known word of one kana counts as the word before a particle): correct in effect, but `dev.md` understates what it covers.** For the Tech Lead's confirmation.
- `pc.known` holds the taught grammar surfaces as well as vocabulary. So from lesson 43, the taught particles (は, か, の, も, を, で, と) count as words too, not just に, し, ご and じ.
- Measured against `b16f481` on the same inputs:
  - It catches `ご と ろく` (70), as intended.
  - It also catches `いく か な` (50), a real sentence-final use that `b16f481` missed.
  - It newly rejects a bare particle list with no punctuation, `は か の も` (46). That is an unlikely draft phrasing, and the error names it.
- It harms no row, column or chart at any lesson (see Evidence).
- I'd confirm it.

---

## Promises (`tech.md` section 4)

| Promise | Status | How checked |
|---|---|---|
| **P4** small っ: type がっこう, きっぷ, ざっし with no rōmaji shown, and be accepted | **Kept in code**, pending PM review of lesson 19 and the Alpha run | The real `--recheck` saves lesson 19 at $0, with 5 reading prompts that contain no Latin letters. The grader accepts all 5 readings (spec, 30 targets) |
| **P5** reading lesson: type the sounds, no hint | **Kept** | The transform leaves lesson 20's checks alone, and its typed checks are unchanged |
| **P2** finish each lesson using only what it shows: no untaught particle | **Kept, and no longer at the cost of kana lessons** | F1 is fixed. Every untaught particle the PM found in lessons 20 and 43 is still caught. N1 and N2 are uses the gate misses, so PM review remains the backstop, as F.2.a and F.2.d intend |
| **P7** A は B です: no unexplained Japanese, "wa" accepted, kana with 。 accepted | **Kept** | Lesson 43 is clean, and its original is still caught (the preview's か by Rule A, the distractors by Rule B). Deviation 4 doesn't change the grader |
| P1, P3, P6, P8, P9, P10 | Not touched by round 2 | Round 2 doesn't change the kanji rules, serving code or mobile code |

**`tech.md` R1.5 test plan:**
- Every accept and reject case is in `course-rules.spec.ts`, including the message tests, the pinned residuals (`はな は says ha` rejected, `ねこ の え` and `日本 から` missed) and the F2 and F3 tests in `typed-reading.spec.ts`.
- `lesson-prompter.spec.ts` has the three lesson tests (20, 44, 120), plus the gate and prompt equality test.
- R1.6's README task is done and accurate. It doesn't list N1, N2 or the two backlog cases among "still left to review" (see Observations).

---

## Findings

### Round 2 (new)

| # | Sev | Where | Failure scenario | Status |
|---|---|---|---|---|
| N1 | Low | `course-rules.ts:292` | Rule (b) treats any lone kana after the particle as a row, including a **known** one-kana word. From lesson 65 the numbers に, し, ご and じ are known, so a real use before one passes: `いぬ が に ひき います` (70), `ともだち と ご じ に あいます` (100). Both were caught on `b16f481`. `ともだち と ろく じ に` is still caught. This falls under F.2.d's accepted gap "a particle before a one-kana word", but with numbers it is common in the counter and time lessons (65 to 111), not rare like `ねこ の え`. The review's fix is `next && LONE_KANA.test(next) && !pc.known.has(next)`. I measured it: it catches both cases, and over every row, row after a word and the full chart at all 120 lessons, its only new rejection is `<word> な に ぬ ね の` at lessons 65 to 110, an implausible text that late. The Developer's "a row needs two" spike does **not** catch `と ご じ`, because ご and じ are both lone kana | **Justified for merge:** a missed use only. `main` has no particle rule, no published lesson is past 43, and PM review is the backstop. **Add to the Tech Lead's backlog item** with the fix above |
| N2 | Low | `course-rules.ts:85` (`STRETCH`) | Japanese quote brackets end a stretch, so a particle right after a quoted word has no word before it: `「すし」 を たべます` (60) and `『ねこ』 と いぬ` (20) pass. Both were caught on `b16f481`. This gap is not in F.2.d, and the Developer's bracket-transparency spike keeps brackets that contain kana, so it wouldn't cover this either. One possible approach is to treat a closing `」』` as the end of a word rather than the end of a stretch | **Justified for merge** on the same grounds as N1. No published lesson contains 「 or 『. **Add to the Tech Lead's backlog item** |
| N3 | Nit | `src/testing/compiled-outline.ts` | `tsconfig.build.json` excludes only `*spec.ts`, so the test fixture is compiled into the API build. I confirmed this with `tsc -p tsconfig.build.json`: `dist/src/testing/compiled-outline.js` is emitted | **Justified:** it follows the existing `src/testing/ignore-dotenv.ts`, which already ships. No production code imports it, so it is dead code |
| N4 | Nit | `course-rules.ts:405` | The rōmaji-particle split still has its own copy of `[\s、。,.!?！？]`, not `ANSWER_PUNCTUATION` | **Justified:** the copy predates this PR and is identical to `main` line 236, and the sets match today. Worth folding in next time this file is touched |
| N5 | Low | `course-rules.ts:97` (`asGraded`) | `asGraded` doesn't fold katakana or rōmaji to hiragana as the grader does. A typed check answered `ガッコウ` is judged unfair, so the transform appends a second check with the same prompt. A rejection can't follow, because step 3 always leaves a fair check | **Justified:** it predates round 2 (`b16f481` compared `spaceless`). The input is implausible, since a model answering a hiragana target in katakana is unlikely, and the outcome is harmless, because both checks grade correctly |

### Review items already ruled on, not new in round 2

| Review item | Ruling |
|---|---|
| An undeclared target with a fair check passes the gate (`typed-reading.ts:43`) | This is the Developer's review finding 4. The gate behaves identically on `main`, and R1.2 restored `main`'s behaviour. It needs the model to drop a target and then a redraft that keeps it undeclared. **The Tech Lead's candidate rule from `dev.md`, that every `ctx.targets` id must be in `targetItemIds`, should be logged in the backlog.** It isn't there yet |
| One bad `.rejected.json` stops a `--recheck` batch (`draft.ts:152`) | F4, justified in round 1. `draft.ts` is unchanged since `b16f481` |
| `--recheck` promotes a passing redraft over an existing `<id>.json` (`draft.ts:194`) | F5, justified in round 1 (`tech.md` 1.1). Unchanged |
| Per-stretch masking cost (`course-rules.ts:286`) | The Developer's review finding 8, measured at 9.0 ms against 3.3 ms on a 300-sentence draft. Not changed |

### Carried forward from round 1 (`b16f481`)

| # | Sev | Round 1 | Round 2 |
|---|---|---|---|
| F1 | High | Rule A rejected correct kana and sound lessons in 13 of 16 lessons | **Fixed** (`4b59807`). The 9-case reproduction passes, and the kana harness rejects nothing |
| F2 | Low | The transform appended checks for undeclared targets | **Fixed** (`1e2f838`). Reproduced on a lesson 20 copy |
| F3 | Low | A fair check answered `がっこう。` got a duplicate | **Fixed** (`1e2f838`, `dfc9b67`). Reproduced on a lesson 19 copy |
| F4 | Low | A malformed rejected file aborts the batch | Justified (unchanged) |
| F5 | Low | `--recheck` promotes over `<id>.json` | Justified (unchanged) |

Round 1 results I didn't re-run, because round 2 doesn't touch the code behind them:
- The four live lessons match `published/*.json` check by check.
- The 175-case grader comparison against `main`: 29 verdicts changed, all from wrong to right, all differing only in punctuation.
- `--recheck --force` is refused.
- A recheck that still fails rewrites only the rejected file.

### Observations (not blocking)

- **Tech Lead:** the backlog item should now list four missed shapes: `がっこう で も`, `ともだち (friend) と`, N1 and N2. It should also carry the undeclared-target rule above. The Developer's two spike refinements don't cover N1 or N2.
- **Tech Lead:** deviation 5 needs your confirmation. It also counts taught particles as words (see "The Developer's two deviations"). I recommend confirming it.
- **Tech Lead, deferred in round 1:** a model-written reading check with partial rōmaji is still judged fair (`How does がっこう sound? (ga + kkou)`). Rechecked here, and unchanged.
- **Developer and Lead:** `dev.md` says `origin/main` was already merged into the branch. It isn't. It's harmless here, because the missing commits are ops-only and the PR is CLEAN.
- **README:** "Still left to the critic and PM review" should gain the backlog shapes when the backlog item is ruled on.
- **PM, for lesson 19's review (from round 1, still true):** Teach spells out `ga … kkou` and `gakou` in rōmaji, and `gakkō` with a macron is rejected.

---

## Not verified

- **Real model output for lessons 3 to 18, and the effect of the new prompt line on it.** No paid calls were allowed. F1's fix rests on lesson 2's real structure and on hand-built phrasings. The first 22c drafts are the real test, as `dev.md` says.
- **The app on the simulator.** There is no mobile or serving change in round 2.
- **Live republish.** The publish gate was proven only against an unreachable DB. The write path is unchanged.
