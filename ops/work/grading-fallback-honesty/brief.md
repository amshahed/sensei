# Brief: an honest "couldn't grade" in reviews, practice and chapter tests

Unit `grading-fallback-honesty` (backlog B5, from `ops/work/open-check-followup/triage.md` I2). Written by the Project Manager, 2026-11-23.

---

# 1. Problem

When the AI grader can't judge an answer (down, timed out, rate-limited), the rules already say it isn't the learner's miss: it isn't scored and nothing is written to the schedule (G.4.a, I.4.d.a, J.1.f). Lesson checks show that honestly since PR #91 (B.2.c). The other graded surfaces still contradict themselves.

**Evidence**
- **Reviews and practice card** (test.md I2; `RecallCard.tsx` 93 to 104, `grading.service.ts` 165). An ungraded answer shows two lines:
  - grey: "Couldn't grade that right now, so it doesn't count. Answer: X";
  - then the fallback's "Not quite — the expected answer was: X."
  - One says no judgement was made, the next says I was wrong, and the answer appears twice.
- **Fallback that matched exactly.** The card shows "Correct!" and then "Correct." underneath. Not contradictory, just a verdict said twice.
- **Review end screen** (`ReviewSession.tsx` 85, 116). "You got X of Y right" counts every card in Y, ungraded ones included. A learner who got all 8 graded cards right in a 10-card review reads "8 of 10", which looks like two misses. That breaks J.1.f's "never counted".
- **Chapter test and skip-test results** (`AssessmentScreen.tsx` 201, `assessments.service.ts` 251). The score already leaves ungraded answers out. The "To review" list doesn't: every ungraded answer is listed as missed, under "The items you missed will come back in your reviews". These answers are graded at the end, so the learner never saw a per-card notice, and this list is the only place they find out.
- **How often.** In the PR #91 test, 25 of 99 free-tier grading calls fell back (Blocker 9). Since G.4.c every vocabulary review asks for a meaning, which goes to the grader. Until billing is on, about one review card in four can hit this. The Alpha walker will meet it in nearly every session.

# 2. Users and use cases

- **Absolute beginner (primary).** Doing the daily review on the phone, 15 minutes, tired. Types "eat" for たべる. Is told it doesn't count, then that it's wrong. They stop trusting the grader, and a learner who is suspicious of guilt mechanics reads "8 of 10" as failure.
- **Returning learner.** Takes skip-tests to jump chapters they already know. A "To review" list full of answers nobody judged makes them think they're weaker than they are, and they take lessons they don't need.
- **Practice drill.** Same card as reviews. The end screen is already honest ("Nothing was recorded this time…"), so only the card is wrong.

# 3. Decisions

## 3.1 An ungraded card shows one plain line and the answer, once

- **Shown:** the existing grey line "Couldn't grade that right now, so it doesn't count." and the answer once, so the learner can check themselves (G.4.a: "the learner sees the answer and moves on").
- **Not shown:** "Correct!", "Not quite", red or green styling, or any second line under it.
- **Rejected:**
  - **Keeping the fallback's line.** It's a verdict from a word-for-word comparison that the rules already say isn't a judgement.
  - **Hiding the answer.** The learner just typed something and wants to compare.
  - **"One way to say it:" instead of "Answer:",** as lessons do for open checks. Review answers are a reading or a short meaning, not a free introduction. The "doesn't count" line already removes the verdict.

## 3.2 The only line under a verdict is the grader's own comment

- A model-written comment about the answer stays (J.1.d).
- A line that only repeats or contradicts the verdict goes, including the fallback's "Correct." after "Correct!".
- Same rule as lessons (B.2.d: fallback strings are dropped).

## 3.3 The review end screen scores graded cards only

- 10 cards with 2 ungraded reads "You got X of 8 right", as lessons do ("X of 16").
- **No extra "2 couldn't be graded" line.** The learner saw the notice on each card as it happened, and lessons don't add one. Same surface rules everywhere.
- **None graded:** no score. Say plainly that nothing could be graded this time, so nothing counted. Never "0 of 0".
- **Rejected:** counting ungraded cards as neither right nor wrong in the total ("8 of 10"). It reads as two misses, which is the bug.

## 3.4 Chapter test results list ungraded answers on their own

- Not in "To review". Shown in their own short list under a plain line such as "Couldn't grade these right now, so they don't count:", each with my answer and the answer, no verdict.
- **The score doesn't change.** It already leaves them out (I.4.d.a). The new list explains why the total is smaller than the number of questions.
- **Rejected:**
  - **Leaving them in "To review".** It claims misses nobody judged, and "will come back in your reviews" isn't something an ungraded answer causes.
  - **Hiding them.** Here, unlike reviews, the learner never saw a per-card notice. Hiding them makes questions vanish from the result.
  - **A count only ("2 couldn't be graded").** The learner can't check their own answer.

## 3.5 Scope takes in chapter tests, not only reviews and practice

The triage named reviews and practice. Chapter tests have the same defect, the Alpha walker takes one at the end of every chapter (17 of them), and the fix is small. Leaving them out would keep the exact inconsistency this unit exists to remove.

## 3.6 No decision-log entry

No rule changes. G.4.a, I.4.d.a and J.1.f already say ungraded answers aren't scored or counted. This unit makes the screens say the same thing.

# 4. Promises

Each promise holds for every way the grader can fail to judge: down, timed out or rate-limited.

- **P1.** In a review or a practice drill, when my answer couldn't be graded, I see one plain line saying it couldn't be graded right now and doesn't count, and the answer shown once. I never see "Correct!", "Not quite" or red or green styling on that card.
- **P2.** On any review or practice card, I'm told the verdict once. No line underneath repeats it or contradicts it. Any comment under the verdict is about what I wrote.
- **P3.** At the end of a review session, my score counts only the cards that were graded. With 10 cards and 2 ungraded, it reads "of 8". If none could be graded, I see no score, just that nothing counted this time.
- **P4.** A review card that couldn't be graded comes back in a later review session, as if I hadn't answered it.
- **P5.** After a chapter test or a skip-test, an answer that couldn't be graded isn't listed among the ones I missed. It's listed on its own, with my answer and the answer, under a plain line saying it couldn't be graded right now and doesn't count.
- **P6.** Answers that were graded look and count exactly as before: "Correct!" for a pass, the answer in red for a miss, the grader's comment when it wrote one, and the same scores and pass marks.

# 5. Out of scope

- **A "Try again" after "couldn't grade".** Still backlog, as in B.2.c.
- **The grader's comment in the chapter test's "To review" list.** Still backlog.
- **Lowering the fallback rate.** That's Blocker 9 (Gemini billing). Exact-match before calling the model saves calls but doesn't change how often a learner sees "couldn't grade", since an exact answer already passes in the fallback.
- **Lesson checks and the lesson end screen.** Done in PR #91.
- **The practice end screen.** Already honest.
- **Placement.** I didn't check whether an ungraded placement answer counts as a miss. Its screens show no per-answer verdict. **Tech Lead:** please check and report it in `tech.md`. If it does count as a miss, that becomes a new unit, not scope here.
- **The 503 when nothing in a chapter test could be graded.** Unchanged (I.4.d.a).

# 6. Notes

- **For the Tech Lead.** The "Answer:" label and the "doesn't count" line already exist on the card. The change is mostly removing things. A test that forces the fallback (grader off) covers P1 to P5, as the PR #91 Tester did. One real free-tier outage is good extra evidence, not required.
- **For the Alpha run.** P1, P3 and P4 need at least one ungraded review card. On the free tier that's likely in any 10-card session. If none happens, run another session later. A promise that can't be scored fails G4. P5 needs one chapter test with an ungraded answer, which is likely across 17 chapters.
