# Dev notes: typed reading, `--recheck`, the particle gate, N6

Unit `22b-sample-lessons`. Developer, 2026-11-14. Implements `tech.md` as one PR.

- **PR:** https://github.com/amshahed/sensei/pull/74, branch `fix/22b-typed-reading`, worktree `.claude/worktrees/wt-22b`, based on `origin/main` at `0625966`.
- **Scope:** `apps/api` and `tools/authoring/README.md` only. No mobile change, no schema change, no migration, no live data written, no paid model call, no Neon branch.

## What changed, by task

| Task | Commit | Files |
|---|---|---|
| 1. Typed-reading transform | `f20c496` | `course-rules.ts` (exports `isFairTypedReading`), new `typed-reading.ts` + spec, `draft.ts` calls the transform, `draft.spec.ts` |
| 2. `--recheck` | `9e83081` | `draft.ts` (shared `gateAndSave`, `readRejectedDraft`, `--recheck` flag, `rechecked` in the summary), `draft.spec.ts` |
| 3. Particle rule | `44152af`, `686169a` | `course-rules.ts` (`PARTICLES`, Rules A and B), `course-rules.spec.ts` |
| 4. Rejection reasons in a redraft | `fd8234b` | `lesson-prompter.ts` (`previousErrors`), `draft.ts` (`rejectionReasons`), both specs |
| 5. N6 | `567a608` | `writing-eval.service.ts` and spec |
| 6. Docs | `6a118d8` | `tools/authoring/README.md` |
| `/code-review high` fixes | `b16f481` | `course-rules.ts`, `typed-reading.ts`, `draft.ts`, `writing-eval.service.ts`, specs |

**Contracts as planned.** `LessonDraftSchema` and `checkCourseRules`'s signature are unchanged. `DraftRunOptions` gains `recheck?: boolean`, `DraftRunSummary` gains `rechecked: number` (rejected drafts that now pass and were saved; a recheck that still fails counts under `rejected`). `buildDraftPrompt` and `generateDraft` gain a trailing optional `previousErrors: string[] = []`.

## Local results on the real drafts (Tasks 1 and 3)

Run on **copies** in the scratchpad, per the Lead's instruction, not on the originals by absolute path as `tech.md` 3 says. The originals in `tools/authoring/output/` and `tools/authoring/published/` were checksummed before and after: all 15 files unchanged.

New gate over the 4 published lessons, and the transform over them and lesson 19's rejected draft:

| Lesson | Gate before transform | Transform | Gate after |
|---|---|---|---|
| 2 `ch01-l02` | 0 errors | no change, second run identical | 0 |
| 20 `ch04-l06` | 3: `teach[0]` と, `teach[0]` の, `check q5` の | no change (its 5 checks are already fair) | same 3 |
| 21 `ch05-l01` | 0 errors | no change | 0 |
| 43 `ch08-l03` | 0 errors | no change | 0 |
| 19 `ch04-l05.rejected` | 5 typed-reading errors | rewrote q2, q4, q6, q8, q10 in place, explanations kept, 10 questions before and after, second run identical | **0** |

This matches the evidence table in `tech.md`: 2, 21 and 43 clean, 20 failing on と and の only.

**The real CLI, end to end** (scratchpad copy of `foundation-ja-ch04`, `ANTHROPIC_API_KEY` empty so no client can exist, live DB used read-only by the validator's item lookup):

```text
authoring:draft — 6 lesson(s) for slug "foundation-ja-ch04"
  skipping "foundation-ja-ch04-l01": no rejected draft to recheck
  ... (l02 to l04 likewise)
  rechecking "foundation-ja-ch04-l05" (no model call)
  [validator] pass
  recheck, no model call, $0  → .../foundation-ja-ch04-l05.json
  skipping "foundation-ja-ch04-l06": no rejected draft to recheck
authoring:draft — drafted 0, rechecked 1, skipped 5, rejected 0, estimated cost ~$0.0000
```

A field-by-field diff of the saved draft against the rejected file shows only the 5 prompts changed (`Type the kana word that means 'school'.` → `Read this word and type how it sounds: がっこう`, and so on); `meta` is the original draft's. `--recheck --force` exits 1 with a clear message. `authoring:publish foundation-ja-ch04-l06` on a copy, with an unreachable `DATABASE_URL`, refuses on the 3 particle errors before connecting.

## Verification

`pnpm typecheck && pnpm lint && pnpm test` from the worktree root on `b16f481`: all green, 57 suites, 1045 API tests. The real-data gate report and the CLI recheck above were rerun after the review fixes, with identical results. CI `verify` is green on `b16f481` (run 43632429419).

## Deviations from `tech.md`, and why

1. **Branch name** is `fix/22b-typed-reading`, as the Lead's task said, not `fix/22b-typed-reading-gate` from `tech.md` 6.
2. **Real drafts read from scratchpad copies**, not by absolute path (Lead's instruction). Same results either way: the files are byte-identical.
3. **Known strings are masked on whole words only** (`maskKnown(..., wholeWords = true)` for the particle rule; the ending rule still uses the old substring match). Plain `maskKnown` lets the known word はい swallow the particle in `わたし は いちご` (`は\s*い` matches `は い`), so the particle is never seen. Pinned by a test that fails without the guard.
4. **A word that is only punctuation stays in place as a non-word** (`686169a`). Dropping it made `は — はな` read as は next to はな. `tech.md` says "strip punctuation from each token", which leaves the empty token where it was, so this is the literal reading, not a new rule.
5. **The one-kana known-word exemption also applies to Rule B.** `tech.md` states it for Rule A only. Without it, a number lesson from 65 on offering `に` (two) as a choice would be rejected. Pinned by a test.
6. **An existing test changed:** `[60, 'それ で した']` sat in the "passes" list. Under F.2.c で there is the untaught particle (taught at 91), so it now fails, correctly. I moved it to its own test that still asserts it is never read as でした and now asserts the particle error. Not a weakened test: the old intent is kept and the new behaviour is pinned.
7. **Only the first matching recall check per target is rewritten** in step 2. Rewriting every such check would leave two identical reading checks for one word. `tech.md` says "a closed typed check", singular.
8. **`--recheck` needs no `ANTHROPIC_API_KEY`.** `main()` passes a client whose `create` always rejects, so a recheck can't spend by construction.
9. **`isFairTypedReading` is stricter than the old gate test** (review finding 1). A fair check must also be closed and have the word as its answer. Before, a typed meaning check (`What does ねこ mean?`, answer `cat`) or an open check showing the word passed, so neither the gate nor the transform ensured a read-and-type check. This tightens the gate's typed-reading rule, but the transform runs first and appends a check whenever none is fair, so no fresh draft or recheck can fail on it. The 4 published lessons and lesson 19 give the same results as before.
10. **The pipeline's fixed wording is ignored when looking for rōmaji** (finding 3). `looseRomaji` of `Read this word and type how it sounds:` contains `i`, `e`, `a`, `o`, `hi`, `ho`, `so`, `wo`, so the transform's own check for いい (lesson 107) would fail the gate. No current `typedReading` lesson is affected. Rōmaji added after the wording is still caught (tested).
11. **No known word starts with a lone untaught particle** (finding 5). Whole-word masking still let `に ほん` match the known word にほん (lesson 45), hiding the particle. A multi-word match whose first word is an untaught particle is not masked. Known phrases that end with a particle (`おげんき です か`) are unaffected.
12. **`--recheck` skips a lesson when the skeleton gives no course context** (finding 2), instead of saving the draft with no gate.

## `/code-review high` on the PR, and what became of each finding

Run on `686169a`. Every fix is pinned by a test that fails without it (checked by reverting each fix in turn).

| # | Finding | Disposition |
|---|---|---|
| 1 | Fairness accepted typed meaning checks and open checks | **Fixed** (deviation 9) |
| 2 | `--recheck` with no course context saved drafts ungated | **Fixed** (deviation 12) |
| 3 | Fixed prompt collides with short rōmaji (いい) | **Fixed** (deviation 10). Latent: no current typed-reading lesson affected |
| 4 | Rule A fires in kana and sound lessons (`ね ねこ ねずみ`, `か: かさ`) | **Not changed, for the Tech Lead.** `tech.md` 1.2 says explicitly that kana and sound lessons need no exemption, so changing it would be a quiet redesign. The finding is right that the neighbour condition doesn't cover a kana shown next to an example word. My recommendation: exempt Rule A in lessons with kana targets (F-Kana, 1 to 14 and the katakana rows), where particles aren't taught and the Japanese is rows and example words. Keep it in sound lessons (15 to 19, 39), which have real words and where lesson 20's と and の came from. Until then a false rejection costs a look at the `.rejected.json` and a redraft (about $0.07), because `--recheck` can't cure it without a rule change |
| 5 | `に ほん` masked as にほん | **Fixed** (deviation 11) |
| 6 | `--recheck` replaces an existing `<id>.json` | **Kept, as planned** ("a pass is written exactly as a fresh pass is"). The replaced draft is kept as `.prev.json` and now logged. Approved content lives in `tools/authoring/published/`, which no draft command touches. Risk: an older `.prev.json` is overwritten, as with `--force` today |
| 7 | A regex compiled per known phrase per field | **Fixed**: compiled once per `checkCourseRules` call. `markerProblems` still recomputes `knownStrings` per field, as before this PR |
| 8 | Three punctuation definitions; gate and grader disagree | **Partly.** The grader's list is now defined once (`SEPARATORS` derived from `PUNCTUATION_CHARS`). I didn't unify it with the gate's `\p{P}`: the gate uses it to find word boundaries, the grader's set is fixed by H.2.c, and widening what the grader ignores (「」, …, 〜) is a product call. For the PM if wanted |
| 9 | Redundant `delete courseRuleErrors`; duplicated `spaceless` | **Fixed** |

## For the Tester: look hard at

- **False rejections from Rule A in kana lessons 3 to 14 (22c)**, review finding 4 above. A line like `か かお かさ` or `か: かさ` puts a row kana that is also a particle next to a kana word, and the draft is rejected. Lesson 2 as published passes. This is the most likely good-draft rejection, and it is a Tech Lead call.
- **Rule B in lessons without kana targets or cards** (from 21 on): any choice or closed answer that is exactly は, か, の, も, が, に, を, へ, で, な, と, ね, よ, や, から or まで before its lesson. Check the error text names the check id.
- **`--recheck` on a lesson that also has `<id>.json`**: a pass moves the old `.json` to `.prev.json`, as a passing `--force` redraft would. This is "written exactly as a fresh pass", but it does replace the draft review would otherwise pick up.
- **A malformed `<id>.rejected.json`** makes `--recheck` and a `--force` redraft of that lesson throw (JSON or schema error) rather than silently ignore it. Deliberate: no suppressed errors.
- **N6:** `わ。` for `は` and `wa` for `は。` on a kana target stay wrong; `は。` for `は` is now right. Rōmaji answers were already punctuation-blind.

## Outside the plan (for the PM)

- Lesson 20's passage now fails the gate, so `authoring:publish foundation-ja-ch04-l06` is refused until it is revised. Live rows are untouched. Already flagged in `tech.md` 1.2.
- Rule A misses particles joined to a word, て-forms and に in lessons 65 to 80, as `tech.md` says.

---

# Round 1 fixes

Developer, 2026-11-14. Implements `tech.md` R1.1 to R1.6 on the same branch and PR, after the Tester's FAIL on `b16f481`. `origin/main` (`868aa69`) was already in the branch, so no merge was needed.

## What changed, by task

| Task | Commit | Files |
|---|---|---|
| R1.1 Rule A replaced (F1) | `4b59807` | `course-rules.ts` (stretches, `untaughtParticles`, `bare` exported), `course-rules.spec.ts` |
| R1.2 and R1.3 (F2, F3) | `1e2f838` | `typed-reading.ts`, `course-rules.ts` (`isFairTypedReading` uses `bare`), `typed-reading.spec.ts` |
| R1.4 prompt line | `2a8b049` | `lesson-prompter.ts`, `lesson-prompter.spec.ts` |
| README | `5035b08` | `tools/authoring/README.md` |
| Prettier | `4891f28` | formatting only |
| Review: one-kana known word | `863c095` | `course-rules.ts`, `course-rules.spec.ts` |
| Review: grader's punctuation set | `dfc9b67` | `common/japanese-script.ts` (`ANSWER_PUNCTUATION`), `writing-eval.service.ts`, `course-rules.ts` (`asGraded`), `typed-reading.ts`, `typed-reading.spec.ts` |
| Review: one test fixture | `45b5575` | new `src/testing/compiled-outline.ts`, used by `course-rules`, `typed-reading`, `course-context` and `lesson-prompter` specs |

- **Rule A** now reads each learner field as stretches of kana and spaces (`/[ぁ-ゖァ-ヺー\s]+/g`). In a stretch, after the existing whole-word masking with the deviation 3 and 11 guards, a word that is exactly an untaught particle and not a known word is an error only when the word before it is a word (`|` or two kana or more) and the word after it, if any, is not a lone kana. The message is `uses the particle と before it is taught, in "ともだち と がっこう"`. Rule B is unchanged, so its messages carry no quote.
- **`untaughtParticles(ctx)`** is exported, and both `particleContext` and `courseContextBlock` take the list from it. The prompt line sits right after `GRAMMAR TAUGHT SO FAR`, worded exactly as R1.4.
- **F2:** the transform skips a `ctx.targets` entry whose id isn't in `draft.targetItemIds`, so the gate's typed-reading rule rejects the draft, as on `main`.
- **F3:** `isFairTypedReading` and step 2 compare `correctAnswer` as the grader does. `tech.md` R1.3 says `bare()`, but `bare()` strips every `\p{P}` and the grader strips only H.2.c's `、。,.!?！？`, so they now share `ANSWER_PUNCTUATION` (deviation 4).

## Tests

The Tester's 9 cases and every R1.5 case are permanent tests. Each was checked to fail without its fix by restoring the old source file and rerunning the spec:

- **`course-rules.ts` from `b16f481` against the new spec:** 31 failures. All 9 of the Tester's cases, the 8 other new accept cases, `に ほん` at 45 and both pinned misses fail. The reject cases fail only on the new message format.
- **`typed-reading.ts` and `course-rules.ts` without R1.2 and R1.3:** the F2 test and both F3 tests fail.
- **`lesson-prompter.ts` without R1.4:** all 5 new prompter tests fail.
- **Review fixes:** without `863c095`, `ご と ろく` at 70 passes. Without `dfc9b67`, the `「がっこう」` transform test and 4 of the 8 gate-and-grader agreement cases fail (`「がっこう」`, `がっこう…`, `がっこう・`, `〜がっこう`).

| Spec | Cases |
|---|---|
| `course-rules.spec.ts` | **Accept (F.2.d block):** the Tester's 9, then `こえ か き く け こ` (2), `いぬ な に ぬ ね の` (6), `ね ねこ ねずみ` (6), `Words with ね: ね, ねこ` (6), `か: かさ` (2), `名 な, 何 なに` (62), `一 いち, 二 に, 三 さん` (50), the PM's gloss verbatim (20). **Accept, added to the existing list** from the Tech Lead's spike: `わたし は いちご` (43), `に ほん` (45), `ろく じ に` (99). **Reject, added:** `はな と ひと` (8), `ねこ と いぬ` (9), lesson 43's original preview verbatim (43), `にほん から きました` (49). **Message:** the exact quoted text for `ともだち と がっこう` and for a field with two stretches. **Pinned residuals:** `はな は says ha` (7) is rejected, `ねこ の え` (9) and `日本 から` (49) are missed. The existing Task 3 lists and `それ で した` (60) are unchanged and still pass |
| `typed-reading.spec.ts` | F2: lesson 20 with `ja:vocab:写真` dropped gets no check and fails the gate with `needs a typed check showing しゃしん`. F3: a fair check answered `がっこう。` is kept, judged fair, and not duplicated. Also: a recall check answered `がっこう。` is rewritten in place (step 2's half of F3) |
| `lesson-prompter.spec.ts` | Lesson 20 lists と and の. Lesson 44 lists neither か nor は. Lesson 120 lists exactly ね よ や から まで. The list equals `untaughtParticles(ctx)` at lessons 2, 20, 44, 83 and 120. The guidance sentence is present |

All 37 cases from the Tech Lead's spike (`spike/ruleA3.ts`) are in the spec, plus the R1.5 cases the spike didn't have.

## Real drafts (scratchpad copies)

Copies of `output/`, `published/` and `corrections.jsonl` in the scratchpad. The Tester's `harness-real.ts` and `harness-kana.ts` were pointed at this worktree and the copies. The 16 originals were checksummed before and after, and all are identical.

| Draft | Gate | Transform |
|---|---|---|
| Lesson 2, published | 0 errors | no change |
| Lesson 20, published | 3: `teach[0]` と in "ともだち と がっこう", `teach[0]` の in "おかあさん の しゃしん", `check q5` の in "おかあさん の しゃしん" | no change |
| Lesson 21, published | 0 errors | no change |
| Lesson 43, published | 0 errors | no change |
| Lesson 19, rejected | 5 typed-reading errors before, **0 after** | rewrites q2, q4, q6, q8 and q10 in place. Idempotent, 10 questions |
| Lesson 2, original | 0 errors | — |
| Lesson 20, original | the same 3 as published | — |
| Lesson 43, original | `teach[7]` か in "あなた は いしゃ です か" (Rule A), `check q1` か and を, `check q2` か (Rule B) | — |

These are the round 0 results, with the stretch now quoted.

**The Tester's kana harness** (lessons 3 to 18 built on lesson 2's real structure): every baseline passage and every variant now passes the particle rule. On `b16f481`, 13 of the 16 exposed lessons were rejected. Real uses are still caught: `はな と ひと` at 8 and `ねこ の なまえ` at 6. The only other error in the harness is `ね ねこ ねずみ` at 6, rejected on ず and み, untaught kana. That is the script rule, and correct.

**Real `--recheck`** on a sandbox copy of chapter 4, with all API keys blank and the live DB used read-only by the validator: `drafted 0, rechecked 1, skipped 5, rejected 0, ~$0.0000`, exit 0. The saved lesson 19 differs from the rejected file only in the 5 prompts, and `courseRuleErrors` is dropped.

**Publish gate** on copies with `DATABASE_URL` at `127.0.0.1:1`: lesson 20 is refused on the 3 quoted errors before any connection. Lesson 43 passes the gate and then fails on the unreachable DB. No write was possible.

## Verification

`pnpm typecheck --force && pnpm lint --force && pnpm test --force` on `45b5575`: all green, 0 cached, 57 suites, **1094 API tests** (1045 on `b16f481`). The real-draft results, the kana harness, `--recheck` and the publish gate above were rerun on `45b5575`, with identical results. CI: see the reply to the Lead.

## Deviations from `tech.md` R1

1. **The quote collapses whitespace.** The quoted stretch is trimmed, with each run of spaces or newlines shown as one space. A passage stretch that spans lines is then quoted on one line, and the redraft can still find the phrase.
2. **A stretch with no untaught particle in it skips masking.** Masking only replaces whole words with `|`, so it can't create a particle token. Without the skip, every space between two English words would be a stretch that runs every known-phrase regex. The result is the same, and the spec pins it.
3. **More tests than R1.5 lists:** the spike's extra cases, the two pinned misses (`ねこ の え`, `日本 から`), step 2's half of F3, and a test that the prompt list equals the gate's list. These are additions, not changes to behaviour.
4. **Answers are compared with the grader's punctuation set, not `bare()`** (review finding 5). R1.3's stated aim is to "match H.2.c", and `bare()` doesn't: `「がっこう」`, `がっこう…` and `がっこう・` were judged fair though no learner's answer matches them. A spec now pins that the gate calls a check fair exactly when the grader accepts the word against its answer.
5. **A known word of one kana counts as the word before a particle** (review finding 3). R1.1 (a) says "a masked phrase, or two or more kana". One-kana known words aren't masked only so that に (two) can't hide the particle に, and F.2.c and F.2.d both treat known words as words. Without this, `ご と ろく` (five and six) passed at lessons 65 to 111. The slice's one-kana known words are に, し, ご (from 65) and じ (from 98), and the spec pins that kana rows containing them still pass. **For the Tech Lead to confirm**, because it widens R1.1's wording.

Deviations 1 to 3 don't change the rule. 4 restores R1.3's intent. 5 is the only change to Rule A's behaviour, and it is narrow.

## `/code-review high` on `b16f481..4891f28`

Run on `4891f28`. 9 findings. The reviewer traced each one by hand and couldn't run them, so each claim was reproduced here (`r1rev/claims.ts`, `r1rev/perf.ts`, scratchpad) before it was ruled on. Each fix has a test that fails without it.

| # | Finding | Reproduced | Disposition |
|---|---|---|---|
| 1 | A spaced compound particle passes: `がっこう で も いきます` (89), `ともだち と は` (100). Rule (b) reads the lone も or は after it as a row | **Yes.** Both were caught on `b16f481` | **For the Tech Lead** (below). This is R1.1's rule as written, so changing it would redesign F.2.d |
| 2 | An inline English gloss between a word and its particle hides the use: `ともだち (friend) と がっこう (school)`, `おかあさん (mother) の しゃしん` (20) | **Yes.** Both were caught on `b16f481`. Real drafts gloss like this: `がっこう (school)` in lesson 19, `です (desu…)` in lesson 43 | **For the Tech Lead** (below), for the same reason |
| 3 | A known word of one kana before a particle isn't a word: `ご と ろく` (70) | **Yes.** The reviewer's `え を かきます` isn't a case, because え is not a known word in the slice | **Fixed**, `863c095` (deviation 5) |
| 4 | A target left out of `targetItemIds`, but with a fair check on it, passes the gate, and publish links only the declared ids | **Yes, and identically on `main`** (0 errors there as well), so not a regression | **Not changed.** It predates this PR, and R1.2 ruled out a wider validator change. Candidate rule for the Tech Lead: every `ctx.targets` id must be in `draft.targetItemIds` |
| 5 | `bare()` strips every `\p{P}`, the grader only H.2.c's set | **Yes.** `「がっこう」` was judged fair | **Fixed**, `dfc9b67` (deviation 4) |
| 6 | The prompt's examples (`In はな, は says ha.`) use kana not yet taught in lessons 2 to 6, and a model might copy them | Can't be tested without a paid call | **Not changed.** The wording is R1.4's, verbatim. The examples follow "as in", and the same prompt lists the kana the learner can read and allows only those. If a 22c draft copies one, the script rule rejects it and names the kana. If wanted, the Tech Lead could drop the examples before lesson 7 |
| 7 | Quoting the stretch gives N errors for N stretches, each quoting up to a whole passage | **Partly.** An unpunctuated passage is one stretch, so it gives one error per particle. N errors come only from N punctuated sentences, and each quotes just its own sentence | **Not changed.** R1.1 step 4 asks for the quote, so a redraft sees every phrase to fix. Lesson 20 gives 3 errors, as on `b16f481` |
| 8 | Masking per stretch is slower | **Measured:** 9.0 ms against 3.3 ms per gate run, on a 300-sentence draft at lesson 110 (196 known strings, と in every sentence). A real draft has 10 to 20 sentences, and the gate runs once per draft and per publish | **Not changed.** Stretches with no untaught particle already skip masking (deviation 2) |
| 9 | A fourth copy of the compiled-outline fixture | **Yes** | **Fixed**, `45b5575`. This also touches `course-context.spec.ts`, which the PR didn't otherwise change. Test-only |

## For the Tech Lead: findings 1 and 2

Both are real uses of an untaught particle that `b16f481` caught and round 1 misses. Neither is in F.2.d's known gaps. I didn't change the rule, because F.2.d defines it. I spiked two refinements instead (`r1rev/spike.ts`, which mirrors Rule A with switches):

- **A row needs two lone kana (finding 1).** The particle is part of a listing only when the next two words are both lone kana. A particle kana that can follow a word inside a row is the first of its row (か, な, は, や, が), and every full row has at least two kana after it, so rows still pass. This also catches the pinned residual `ねこ の え`, which is a real use.
- **An English gloss is transparent (finding 2).** A bracket with no kana or kanji inside is removed before the text is split into stretches. `かさ (か + さ)` keeps its bracket, because there is kana inside it.

| Variant | 63 cases: every spec case, the review's 5 uses, 5 gloss-shaped mentions in kana lessons (`In かさ (umbrella), か says ka.`, `そと (outside) ends in と.`) and 4 rows after lesson 65 | Kana harness, lessons 3 to 17: the row-and-words passage and 9 phrasings per particle kana | Real drafts |
|---|---|---|---|
| Round 1 as it stood at `4891f28` | 58 of 63 | 0 false rejections | Unchanged |
| With the one-kana word fix (now in the PR) | 59 | 0 | Unchanged |
| + a row needs two | 59 alone. Finding 1's cases are caught, and `ねこ の え` is now rejected | 0 | Unchanged |
| + gloss transparent | 60 alone. Finding 2's cases are caught | 0 | Unchanged |
| **All three** | **62**. The only difference from the expected results is `ねこ の え` now rejected, which is a real use | **0** | **Unchanged** |

**My recommendation: adopt both and amend F.2.d.** It is about 10 lines plus the spike's cases as tests, and needs no paid call. One caveat: all of this evidence is hand-built text, and the first 22c drafts are the real test.

## For the Tester: look hard at

- **Kana lessons 3 to 18 in 22c.** The rule now passes every phrasing in the harness. The one known false rejection left is a kana written right after a word with nothing between them (`はな は says ha`), and the prompt now steers away from it. Watch the first real 22c drafts for anything else.
- **Missed uses**, pinned and accepted by the Tech Lead: a particle before a one-kana word (`ねこ の え`), after a kanji (`日本 から`), or joined to a word. PM review is the backstop for I-Reading and F-Grammar.
- **The prompt line goes into every draft prompt**, including lesson 2's, where it names particles whose kana the learner can't read yet. It is guidance for the model, not shown to the learner. About 40 input tokens.
- **Long stretches:** a passage written with no punctuation at all is one stretch, so its error quotes the whole passage.
- **The grader's punctuation set moved** to `common/japanese-script.ts` as `ANSWER_PUNCTUATION`. The characters are unchanged, and the grader's spec passes unchanged. The gate now judges a reading check fair only when the grader would accept the word against its answer.
- **Findings 1 and 2 of the review are open, for the Tech Lead:** spaced compound particles (`がっこう で も`) and an English gloss between a word and its particle (`ともだち (friend) と`) still pass. They are false negatives, and PM review is the backstop.

## Outside the plan (for the PM)

- The R1.4 wording names punctuation and English as what sets a kana apart, but not a plain row (`は ひ ふ へ ほ`), which also passes. A model might add commas to rows it doesn't need to. That's harmless, and not worth a prompt change until a 22c draft shows it.
