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
