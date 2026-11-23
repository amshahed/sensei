# Triage: open-check-followup, after the Tester's PASS

Unit `open-check-followup`. Written by the Project Manager, 2026-11-23. Input: `test.md` (PASS on `7d137ef`, PR #91 merged).

There's been no Alpha run yet. This file rules on publishing lesson 120 and decides what each Tester finding becomes. G4 for this unit stays open until the Alpha run scores P1 to P8.

---

# 1. Ruling: publish lesson 120 now

**Publish `foundation-ja-ch17-l07` to the live database now, exactly as tested.** Don't change the rubric first.

**Conditions**
- **Publish the approved draft unchanged.** That's the draft whose prompt, example, rubric and explanation the Tester matched on the throwaway branch (test.md 1.2). Any edit to q17's rubric before publishing reopens testing.
- **It isn't a stop-list item.** The live database serves only the dev user until Blocker 9 and M.5 clear, and 107 lessons were published the same way under OM.1.

**Why**
1. **The bar is met.** F.2.i and `check-explanation` section 5 held 120 until this unit landed. It has merged, and every promise held.
2. **F1, two fixes in one comment, doesn't hurt the learner.**
   - In every run where it happened, both fixes were right (を → の, を → が). Each time it was one sentence that agreed with the verdict.
   - My "at most one thing" (brief 3.2) exists so a beginner isn't buried in corrections. Two right fixes for two real slips is a small miss against that rule.
   - It's an accepted gap for answers with two slips. The rule stays as written.
3. **F2, the wrong fix 「わたし は なまえ は」, is a real defect.** It shows an ungrammatical sentence as the correction. It still doesn't block:
   - It needs one specific slip, を for の in the name sentence.
   - It appeared in 2 of 10 model runs of that one input, all in the Developer's runs and none in the Tester's 4.
   - The explanation on the same panel spells out the right pattern, わたし の なまえ は … です.
   - It's the risk already accepted for every grader comment (B.2.c; brief section 5; Blocker 6). Holding 120 doesn't remove it from reviews and practice, which show this grader's comments today (J.1.d).
   - No real learner sees it before Blocker 9 and M.5.
4. **Holding buys nothing we can verify today.**
   - A rubric fix needs a clean eval run to prove it, and the free tier failed 21 of 60 open-check calls across the Tester's two runs (F5).
   - Publishing an untested rubric is worse than publishing the tested one.
   - Republishing 120 is routine under OM.1, so the fix can follow later at the cost of one republish.
5. **Waiting for F4 makes no sense either.** Lesson 120 is the last lesson of the course. F4's fix (`authoring-polish` P8) covers 120 along with every other lesson, and publishing now means the default branch matches what the Alpha run will score.

**The cost, stated plainly.** Until B1 lands, a dev-user walker who makes that exact slip may be shown a wrong fix, about one time in five. That's acceptable for closed beta. It's not acceptable for real learners, so B1 must land before any real learner.

---

# 2. Findings

| # | Finding (test.md section 3) | Call | Why |
|---|---|---|---|
| F1 | The comment names two fixes on a two-slip answer | **Accepted** for closed beta; folded into B1 | Section 1, point 2 |
| F2 | The wrong fix 「わたし は なまえ は」, 2 of 10 model runs of one input | **Accepted** for closed beta. **B1 before any real learner**, and B2 | Section 1, point 3 |
| F3 | The eval's pair rule counts fallback runs, so its FAIL reasons mislead | **Backlog** (B3) | It never touches the product and can't produce a false PASS. Bundle it with the next change to grading or the eval |
| F4 | The right multiple-choice answer is listed first in 652 of 668 checks | **Fix before Alpha:** new promise P8 in `ops/work/authoring-polish/brief.md` | A learner who taps the top option scores about 98%, so every lesson score is meaningless, including the ones the Alpha run would record |
| F5 | Free-tier Gemini: 25 of 99 eval calls and 2 of 6 app submits fell back | **Accepted.** Blocker 9 is the fix and is already open | The product was honest every time (P6). See the Alpha notes (section 4) |
| I1 | Android: the keyboard handling has no behaviour set | **Backlog** (B4) | The closed beta is checked on iOS only. Fix it before any Android build reaches a learner |
| I2 | Reviews and practice show the fallback's "Not quite — the expected answer was…" next to "Couldn't grade" | **New unit** (B5), after `authoring-polish`, before any real learner | Two messages that contradict each other, on the surfaces a learner uses daily. With the free tier failing a quarter of calls, it's common. The Alpha run logging it is fine |
| I3 | After a result, the answer box sits mostly under the panel | **Accepted**, no action | No promise needs it, and the box scrolls into view |

**Not verified by the Tester (test.md section 4).** Real taps and keystrokes, the Return key, Android, large text and a physical device. The Alpha run covers real taps and Return (Blocker 10). Android and large text are in B4 and the existing pre-beta checks.

---

# 3. Backlog this creates

The Lead carries these lines to the PM backlog in `ops/CHECKPOINT.md`.

- **B1. Lesson 120 rubric: the name pattern, and one fix.** Content only, $0 to write, but it needs a clean eval run to prove it.
  - Rubric line to append, written by the PM and ready to apply:
    > If the name sentence has a particle slip, the fix is the pattern the lesson teaches: わたし の なまえ は (name) です. When there is more than one slip, name only the one that matters most for being understood.
  - Add an eval case with only the name-sentence slip.
  - Apply and republish once a clean eval run is possible: after Blocker 9, or in a quiet free-tier window.
  - **Must land before any real learner.**
- **B2. Native-speaker sample (Blocker 6).** Include grader comments on particle slips, using test.md F1 and F2 as the examples. The Lead adds this to Blocker 6's wording.
- **B3. Eval pair rule.** Count only model-graded runs toward agreement between scripts (test.md F3). Developer, small.
- **B4. Android keyboard handling** in the answer box (test.md I1). Before any Android build reaches a learner.
- **B5. New unit: an honest "couldn't grade" in reviews and practice** (test.md I2). Drop the fallback's "Not quite — the expected answer was…" when the result is ungraded, as B.2.c did for lessons. After `authoring-polish`, before any real learner.

These backlog lines are unchanged: "Try again" after "couldn't grade", the grader's comment in the chapter test's "To review" list, and the 500 error on very long answers.

---

# 4. Notes for the Alpha run

- **The Alpha run starts after `authoring-polish` P8 merges.** Until then, every multiple-choice score is meaningless.
- **q17 may come back "Couldn't grade" (F5).** That's P6 working, and it counts as P6 evidence. P1 to P4 need a graded result. If q17 is ungraded, try it again on a later run of the lesson. A promise that can't be scored fails G4; it isn't skipped.
- **Type for real in q17.** Return should insert a new line in the open box, and it should still submit the closed typed check in lesson 19.
- **Expect untaught Japanese in some comments** (あめりかじん, アメリカから きました). This is already accepted (brief section 5, Blocker 6). Note it, but don't fail P2 for it.
