# Brief: authoring pipeline hardening

Unit `authoring-hardening`. Written by the Lead, 2026-11-15. No learner-facing change, so this is a Lead brief and the PM isn't needed (operating model section 4, right-sizing). The Tech Lead writes `tech.md`, then a Developer and a Tester as usual.

## Why

The 22c waves are losing money and time to pipeline defects, not content problems. Every item below was seen in a real run, and evidence is in `ops/work/22c-full-batch/wave1-notes.md`, `wave2-notes.md` and `run-log.txt`.

## What has to be true after this unit

1. **A paid draft is never thrown away.** If the model's reply fails schema parsing, it's saved for inspection, its cost is printed and counted against `--max-cost`, and it can be recovered without a new model call once the cause is fixed. Six wave 2 lessons (44, 53, 54, 55, 74, 77) were lost this way, and probably lesson 13 in wave 1.
2. **A harmless slip in the model's reply doesn't cost a draft.** The known case is a `grading` value other than `"open"` on a closed check. Whether to normalise it, or change the prompt so the model doesn't write it, is the Tech Lead's call.
3. **The P5 give-away rule stops rejecting fair drafts.** This is Tester finding F1 in `ops/work/check-explanation/test.md`: English words that look like rōmaji (are, do, made, zero, I). Lesson 67 is rejected today on "zero" (ゼロ). The Tech Lead also rules on F2 and F5 there, and on the H.2.d wording point (hyphen spellings such as `oba-san`).
4. **A check pointing at an undeclared item is fixed or refused before it can be approved.** Lessons 22 and 25 had garbled IDs (`ja:vocab:ありがotou`). The Lead repointed them by hand this time. Today the drafter only warns, and `authoring:publish` doesn't run the structural validator at all; the foreign key is the only thing that stops it.
5. **I-Reading stops giving its answers away (blocks all further I-Reading drafting).** The PM has made I-Reading no-go after a second strike: lessons 4, 8 and 13 spelled out their typed answers in Teach. The gate has to reject a Teach block in an I-Reading lesson that contains, as a whole word, the rōmaji of any of that lesson's typed check answers (`ops/work/22c-full-batch/content-review.md` sections 4 and 6.1). Lessons 55, 77, 83, 95 and 113 wait on this.
6. **The PM's other gate findings** (`content-review.md` 6.2 to 6.4), each the Tech Lead's call to take or defer with a reason:
   - an open check only where the outline's author note asks for one (3 have appeared unasked: lessons 37, 47, 75);
   - a typed check whose prompt contains the rōmaji of its own answer ("Type the kana that reads 'ka'");
   - how practice templates in `production` mode for kana are shown.
7. **Swap lessons 38 and 39** (PM decision F.1.c). A data-only edit to `apps/api/data/curriculum/foundation-ja-beta.json`, exactly as written in `content-review.md` section 3 step 1, in its own commit. The Lead does the post-merge steps (rebuild the outline, diff, rename the drafts) and publishes 38 to 40.
8. **Optional, the Tech Lead's call:** the drafter writes particle phrases in pre-grammar lessons, and the critic's `example-feel` check marks bare-word examples in kana lessons down (`wave1-notes.md`, For the Tech Lead, item 1). Most pre-grammar lessons are already drafted, so this is only worth doing if it's cheap.

## Acceptance

- Each item above has a test that fails on today's `main` and passes after.
- After the merge, the Lead can recover lessons 44, 53, 54, 55, 74 and 77 at the cost of at most one redraft each, and recover lesson 67 with `--recheck` at $0.
- The gate passes on every lesson approved or published so far (wave 1 and 22b). A new rule that rejects approved content is either wrong or the PM has to see the hit.
- After the swap, rebuilding the outline changes only the two ch07 lesson entries and the one sound stage.

## Sequencing (Lead)

Wave 3 drafting (lessons 78 to 120, without audio or I-Reading) waits for this merge. In wave 2, 6 of 30 paid drafts were lost to the parse crash. Drafting after the fix costs no extra time, because the PM can only review one wave at a time.
- No change to published lessons or the live database.
