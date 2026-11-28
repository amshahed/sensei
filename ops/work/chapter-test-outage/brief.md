# Brief: an outage never decides a chapter test

Unit `chapter-test-outage`. Written by the Project Manager, 2026-11-28. From the PM backlog: `exact-meaning-grading/test.md` F1 ("skip-test outage loophole"). It runs on the server while PR #107 waits for the Mac.

"Test" in this brief means a chapter test (the exit test after a chapter's lessons) or a skip-test (the same test taken before them, to skip the chapter). One engine runs both (I.4.d.a).

---

# 1. Problem

A test is about 20 typed questions, scored together when submitted. The pass mark is 80% (I.4.d.a). When the AI grader can't judge an answer (down, timed out or rate-limited), that answer is left out of the score, so our outage isn't counted as the learner's miss (I.4.d.a, `grading-fallback-honesty` P5).

Leaving it out of the score is right. Leaving it out of the **pass mark** is the bug. The 80% is taken of whatever got graded, however little that is.

**Evidence**
- **One right answer passes a skip-test.**
  - The grader was off. A chapter 4 skip-test got one right answer and 19 answers of "zzz".
  - The result was `passed: true`, 1 of 1, on `main` and on PR #112, which is now merged (`exact-meaning-grading/test.md` F1).
  - A passed skip-test marks the chapter passed and skips every lesson in it.
- **A unit test pins the loophole.** In `assessments.service.spec.ts`, "excludes answers the grader could not score from the total and FSRS" expects one right answer plus one ungraded answer to pass (1 of 1).
- **It doesn't have to be deliberate.**
  - A returning learner takes a skip-test and guesses at the grammar meanings they don't know.
  - Kana and readings are always graded, because they use exact match, but the guesses go to the grader.
  - In a bad minute the guesses drop out, and the learner passes on kana and readings alone. They skip the grammar they needed.
- **An outage can fail a learner too.**
  - 12 right, 4 wrong and 4 ungraded reads "12 of 16, Not this time".
  - If those 4 ungraded answers were right, the learner had 16 of 20, which is a pass.
  - On an exit test, that means retaking a chapter test they may have passed.
- **On a pass, ungraded words are lost.**
  - An ungraded answer isn't recorded. The step that schedules the chapter's untested words also skips it, because it treats every asked question as tested (`seedUntested` is given all the sampled items).
  - After a skip-test pass, that word's lesson is skipped too. So the word has no review schedule, and it is never taught or reviewed. Reviews and practice show only words with a schedule (G.4.e).
  - With the loophole, that is up to 19 words per chapter.
- **How often.**
  - On the free tier, 25 of 99 grading calls fell back (Blocker 9).
  - A test sends up to 20 answers at once, against a limit of 15 requests a minute.
  - G.4.h took listed meanings off the grader, but paraphrases and grammar explanations still go to it.
  - The Alpha run will be on this tier. The checkpoint lists this item as "before real learners".

# 2. Users and use cases

- **Returning learner (primary).** Takes skip-tests to jump chapters they already know. A pass has to mean they showed 80% of what the test asked. Otherwise they skip lessons they need, and nothing ever tells them.
- **Absolute beginner at an exit test.** Has finished the chapter's lessons and takes its test, tired, on the phone. An outage must not fail them, and it must not pass them on a handful of answers either.
- **Both, during an outage.** "Try again in a minute" is better than a verdict nobody judged.

# 3. Decisions

## 3.1 A pass needs 80% of all the questions graded right

- The bar is the same with or without an outage: 16 of 20 means 16 answers judged right.
- An answer that couldn't be graded never helps a pass, and it still isn't counted as a miss.
- **Rejected:**
  - **A minimum share of graded answers**, the backlog's suggestion (for example "at least 80% graded"). It adds a second, arbitrary threshold, and it still passes too little. With 13 right, 3 wrong and 4 ungraded, 80% are graded and the score is 13 of 16 (81%), yet only 13 of 20 were shown to be right.
  - **Counting ungraded answers as misses.** That makes our outage the learner's miss (I.4.d.a), and the score shown would include answers nobody judged, against `grading-fallback-honesty` P5.
  - **Skip-tests only.** I.4.d locks the same bar in both directions ("no 'skip-test is harder than chapter exit' weirdness"). An exit test passed on one answer also marks the chapter completed and schedules its untested words as known.

## 3.2 A fail has to hold even if every ungraded answer were right

- The learner sees "Not this time" only when they would fall short of 80% even with every ungraded answer counted right.
- This makes the rule symmetric: an outage can neither pass a learner nor fail them.
- **Rejected:** **keeping today's fail.** It lets the outage decide fails, which costs the exit-test beginner a retake.

## 3.3 Otherwise there's no result, and the same answers can be submitted again

- When the ungraded answers could still change the outcome, the learner gets no pass and no fail.
- Nothing is recorded: no chapter mark, no lessons skipped, nothing added to reviews.
- The answers are kept. Submitting the same answers again gives a normal result once the grader answers.
- **This is today's rule, widened.** I.4.d.a already has it for "nothing could be graded": submit returns 503 and the attempt stays open. Here it covers "not enough graded to decide".
  - The app already handles it. It shows "Couldn't submit your answers" with a Retry button, and Retry sends the same answers again (`AssessmentScreen.tsx`).
  - The existing expiry still applies: an attempt stays open for 60 minutes from its start.
- **Rejected:**
  - **The server waits and retries the grader before answering.** On the free tier that could mean minutes on "Scoring…", and this rule would still be needed when the retries run out.
  - **A provisional pass** (the chapter skipped "pending grading"). It needs a new chapter state and new screens, all for an outage case.
  - **A new message for this screen.** It is the right idea, but it is app work that can't be shown on this server. See section 5.

## 3.4 A word that couldn't be graded is treated as a word the test didn't ask about

- **On a pass,** it is scheduled the way the chapter's untested words are: the I.4.c "inferred" tier, seeded with moderate confidence so that reviews confirm it early.
  - Kanji follow G.4.d, as untested kanji do.
  - A word the learner already has a schedule for is left alone, as today.
- **This narrows I.4.d.a's "excluded … from FSRS".** FSRS is the spaced-repetition scheduler. The answer is still never recorded as a right or wrong review. On a pass, its word is seeded as untested.
- **Rejected:**
  - **Leaving it unscheduled**, as today. After a skip-test pass its lesson is skipped, so the word is never taught or reviewed.
  - **Un-skipping its lesson.** That would be new lesson-level skipping on a pass, with more moving parts, and the early review confirms the word anyway.

## 3.5 A question that can no longer be asked doesn't hold the test open

- A sampled word can leave the course between the start of a test and its submit.
- Its question then counts neither way, and it isn't one of "all the questions".
- Otherwise the test could never be decided, and the learner would be stuck until the attempt expires. I.4.d.a says the gate never strands a learner.

## 3.6 What doesn't change

- **With every answer graded,** pass and fail are exactly as today.
- **The result screen is the same:**
  - the score ("X of Y right") counts only graded answers;
  - ungraded answers are listed on their own (`grading-fallback-honesty` P5, B.2.g).
- **The score agrees with the verdict.** Because of 3.1 and 3.2, a pass never shows under 80%, and "Not this time" never shows 80% or more.
- **Also unchanged:** which questions are asked, the 80% bar, how graded answers are scheduled, the no-penalty rule for a failed skip-test, and lessons skipped after a partial pass.

## 3.7 Log entry

- I.4.d.b is appended to `decisions.md`. It amends I.4.d.a and leaves B.2.g and `grading-fallback-honesty` P5 as they are.

# 4. Promises

Each promise holds for every way the grader can fail to judge: down, timed out or rate-limited.

- **P1.** I pass a test only if at least 80% of all its questions were graded right. One right answer and 19 answers that couldn't be graded never pass a skip-test or skip a chapter.
- **P2.** I'm told "Not this time" only if I would still fall short of 80% with every answer that couldn't be graded counted right.
- **P3.** When the answers that couldn't be graded could still change whether I pass, I get neither a pass nor a fail.
  - Nothing in my course changes: no chapter is passed or skipped, no lesson is skipped, and nothing new appears in my reviews.
  - My answers are kept. When I submit them again within the hour, once grading works, I get a normal result for them.
- **P4.** When I get a result while some answers couldn't be graded, it looks the way it does today.
  - The score counts only the graded answers.
  - The ungraded answers are listed on their own.
  - The score agrees with the verdict: a pass never shows under 80%, and "Not this time" never shows 80% or more.
- **P5.** If I pass a test while some of my answers couldn't be graded, those words still come up in my reviews, the same way as the chapter's words the test didn't ask about.
- **P6.** When every answer is graded, tests work exactly as before: the same questions, the same 80% bar, the same results, and the same effect on my course and my reviews.

# 5. Out of scope

- **A plain message on the "no result" screen.**
  - Today it shows "Couldn't submit your answers", a raw status line ("POST /assessments/… → 503") and Retry. The action is right but the words are poor.
  - Fixing it needs `apps/mobile`, and `apps/mobile/src/api.ts` is in PR #107. It also needs on-screen proof.
  - It should become one Mac copy unit after #107, together with `grading-fallback-honesty/test.md` F2 (🎉 on the review end screen when nothing counted).
- **Keeping answers past the 60-minute expiry,** or across an app restart.
- **Lowering the outage rate.** That is Blocker 9 (Gemini billing).
- **Reviews and practice.** They are graded one card at a time with no pass mark, and they are unchanged.
- **Placement.** It is multiple choice and never reaches the grader.
- **Streak credit on a submit with no result.** It is credited on the submit that gets a result, as today.
- **Whether a resubmit asks the grader again about answers it already judged.** That is the Tech Lead's call. The product only needs the result to be decided on the same answers.

# 6. Notes

**For the Tech Lead**
- **PR #107's files are off limits:**
  - `packages/types/src/index.ts`, so no change to the result's shape;
  - `apps/api/src/app.integration.spec.ts`, so no HTTP tests in that file;
  - `apps/mobile/src/api.ts`.
  - Nothing here needs them. The change should sit in `assessments.service.ts` and its spec.
- **Two existing specs change on purpose:**
  - "excludes answers the grader could not score from the total and FSRS" (1 right and 1 ungraded of 2);
  - "a fallback-graded miss (grader outage) is not held against the learner" (3 right and 1 ungraded of 4, so 75% at best is proven and 100% is possible).
  - Under P1 and P2, both become "no result". Rewrite them to say so. Don't delete them.
- **Small tests feel this most.**
  - A 4-question test can't pass with even one ungraded answer.
  - Live tests are 14 to 20 questions (`exact-meaning-grading/test.md` 1.5), so a perfect 20-question test can absorb 4 ungraded answers.
- **Live proof works on a throwaway Neon branch with the grader off,** as in `exact-meaning-grading/test.md` 1.6.
  - Kana, readings and listed meanings are always graded. A blank answer or a wrong reading is always graded wrong. A paraphrase that isn't a listed meaning is always ungraded. That is enough to build every case on a 20-question meaning chapter (4 or 5):
  - **P1:** 1 right plus 19 paraphrases (the F1 repro) gives no pass. 16 right plus 4 paraphrases passes.
  - **P2:** 10 right, 6 wrong and 4 paraphrases gives "Not this time". 12 right, 4 wrong and 4 paraphrases gives no result.
  - **P3:** submit the same attempt again with the grader back, using the real key or a fake-grader preload, and it gets a result. Check for a chapter mark, lesson skips and schedule rows before and after.
  - **P5:** after the 16-right pass, the 4 paraphrased words have the same schedule as an untested word in that chapter.

**For the Alpha run**
- P3's screen is only visible in the app.
- Take one skip-test with the API's grader key empty, a forced outage, and answer it so the result is undecided. Confirm that no result is given and that Retry sends the same answers. Then restore the key and Retry once more.
- Without that, P3 can't be scored at G4, because a natural outage may not happen.
