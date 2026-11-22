# Brief: what an open lesson check tells me after I answer

Unit `open-check-followup`. Written by the Project Manager, 2026-11-22. This is the follow-up that `check-explanation/brief.md` section 5 deferred and F.2.i made a precondition for publishing an open check. Its job is to let lesson 120 (`foundation-ja-ch17-l07`) be published. Decision logged in `decisions.md` as B.2.c.

An **open check** is a lesson check with no single right answer: the learner writes freely, and the AI grader judges it against a rubric and a model answer.

---

# 1. Problem

- **Lesson 120 is approved and held** (`22c-full-batch/content-review-wave3.md` 2.5 and 3.3). Its q17 asks me to write my own self-introduction. It's the course's only open check, and the last thing between the course and its final lesson.
- **The grader's comment is thrown away.** For an open check the grader writes one sentence about my answer. Reviews and practice show it. The lesson result screen doesn't, so after writing six sentences I only get "Correct!" or "Not quite."
- **"Answer:" is the wrong frame.** After a miss the screen says `Answer: はじめまして。わたし の なまえ は ハナ です。わたし は アメリカじん です。…`. That's someone else's introduction, with someone else's name and country. It reads as if I should have typed it.
- **A grade nobody made looks like a real one.** When the grader can't judge (an outage, a timeout, the free tier's 15 requests a minute), the lesson currently:
  - shows "Not quite." plus the model answer when the check has one, which q17 does. An exact match against a model introduction never succeeds, so every ungraded introduction looks like a miss;
  - shows "Correct!" when the check has no model answer;
  - counts the check in "You got X of Y right" as if it had been judged.

  Reviews already say "Couldn't grade that right now, so it doesn't count." The lesson should be as honest.
- **The answer box is one line.** A self-introduction is about six short sentences. In a one-line box I can't see or fix what I wrote.
- **Unknown: how the grader treats rōmaji.** The q17 prompt now says "Rōmaji is fine", and the rubric accepts it. Nobody has run a rōmaji introduction through the real grader (wave 3 review section 7).

---

# 2. Users and use cases

- **Absolute beginner (primary).** Has just finished the course's last lesson set: greetings, わたし, なまえ, がくせい, の, です, すき, よろしくおねがいします. Writes their first full introduction on a phone, most likely in rōmaji, tired. This is the "speak early, real communication" moment, so it should feel like a conversation with a tutor, not an exam. A long write-up answered with a bare "Not quite." is where a learner quits.
- **Returning learner.** Writes a complete introduction quickly. Wants a short, specific comment and to move on.
- **Alpha walker.** Scores this on the iOS simulator, on `Sensei 22a SE3`.

---

# 3. Decisions

## 3.1 The result of an open check shows the grader's comment

**Order:** the verdict, then the grader's comment, then on a miss a model introduction labelled as an example (3.3), then the check's explanation (B.2.a, unchanged).

- The comment is the only feedback about what *I* wrote. The explanation is written in advance and generic ("A full introduction runs: …").
- It appears with the verdict, with no tap, as B.2.a does for explanations.
- **The verdict and the comment are in view without scrolling** on the SE-size device. The example and the explanation may need a short scroll inside the result on a miss. Six sentences of model answer can't all fit alongside the question and the box, and the comment matters more than the example.

**Why this doesn't break B.2.a 3.4** (which rejected AI-written explanations at the moment of a miss):
- That rule covers explaining a check that has a reviewed explanation. Free writing can't have reviewed feedback, because nobody knows in advance what the learner will write.
- Reviews and practice already show this grader's comment (J.1.d). Lessons would be the odd one out.
- The risk is real: the comment is unreviewed AI text about Japanese. It's limited to one sentence that agrees with the verdict (P2), and grader comments are added to the native-speaker sample (Blocker 6).

**Rejected**
- **No comment, verdict only.** It throws away the most useful thing the grader produces, at the one point where the learner produced the most.
- **Comment behind a "Feedback" tap.** The tired learner who most needs it won't tap.

## 3.2 What the comment may say

- One sentence, in English. Any Japanese in it is written in kana or rōmaji, never kanji. A beginner at lesson 120 knows a handful of kanji, and the grader may write 好き or 名前.
- It agrees with the verdict: no praise on a miss, no "wrong" on a pass. Unlike an explanation, it knows the verdict, so it may say "Nice" on a pass.
- It names what was good, plus at most one thing to add or fix.
- It never tells me to switch to kana, because the prompt said rōmaji is fine.

## 3.3 After a miss, the model answer is shown as an example

- It's labelled as one example of a good introduction, such as "One way to write it:", never "Answer:". The exact words are the Tech Lead's call, but it must read as an example, not a key.
- It's shown in kana only, with no rōmaji line. Six sentences in two scripts would double the panel, and by lesson 120 the learner reads kana (B.2.a 3.3's rōmaji rule covers closed typed checks only).
- It isn't shown after a pass, as with closed checks (B.2.a).

**Rejected**
- **"Answer:"** It implies one right introduction, with another person's name in it.
- **Hiding the example.** A learner who missed needs a model to copy next time.

## 3.4 An open check the grader couldn't judge says so

- **Shown:** a plain line saying it couldn't be graded right now and doesn't count against me. Then the example and the explanation, so the check still teaches.
- **Not shown:** "Correct!", "Not quite." or the red or green verdict style.
- **Score:** it's left out of the end-of-lesson score. With 17 checks and one ungraded, that's "X of 16".
- **Schedule:** unchanged from today. The item still enters my reviews, unscored, so a review makes the real judgement later.
- This covers every way the grader can fail to judge: down, timed out, rate-limited, or no model answer to fall back on.

**Rejected**
- **Counting it as right.** That claims a judgement nobody made.
- **A "Try again" button.** It's useful but rare, it adds a state and a second submit path, and Blocker 9 (billing) removes the rate limit before any real learner. Backlog.
- **Counting it in the total as neither right nor wrong ("16 of 17").** That makes it look like a miss again.

## 3.5 What passes in lesson 120

**Chosen: an introduction passes when a listener would understand it as me introducing myself in Japanese, with a name.** Missing parts and small slips lower the rating and get named in the comment, but they aren't a miss.

- The prompt asks for six parts. A beginner who writes a greeting, a name and a closing has introduced themselves. Marking that "Not quite." punishes speaking, the thing the course exists for.
- The grader's ratings already allow this: "Hard" means essentially right with a slip, and still counts as right.
- English only, a single word, or no introduction at all is a miss.

**Rejected: requiring all six parts.** It turns a writing task into a checklist and fails most first attempts.

**Rubric amendment, applied by the PM to the held draft on 2026-11-22.** The following was appended to q17's `rubric` (English only, so no gate rule is affected; the publish gate rechecks it):

> Pass (Hard or better) any self-introduction in Japanese that a listener would understand and that gives a name. A missing part or a small slip lowers the rating, not the verdict: in the feedback, name the one part to add or the one fix. Rate Again only if it is not a self-introduction in Japanese, for example English only or a single word. Never ask the learner to switch to kana. Write any Japanese in the feedback in kana, never kanji.

## 3.6 I can see what I'm writing

For an open check, the answer box shows my whole introduction of about six short sentences while I write, and I can edit it before submitting. Closed typed checks keep their one-line box.

## 3.7 Privacy, noted and not changed

The introduction will usually contain my real name and country, and it goes to the grader. The free tier permits human review and training on input. Blocker 9 (paid tier) and M.5 (18+) already have to be cleared before any real learner, and that covers this. Alpha runs use the dev user. I'm not changing the prompt to "any name is fine": practising with your own name is the point.

## 3.8 Priority

Next, ahead of `authoring-polish`. It blocks only lesson 120. It's small:
- the lesson result for open checks;
- the honest "couldn't grade";
- the answer box;
- the rubric (done).

---

# 4. Promises

Scored on the iOS simulator, on the SE-size device `Sensei 22a SE3`, in lesson 120 as published.

- **P1.** After I submit my self-introduction and it's graded, I see a one-sentence comment about what I actually wrote, together with whether it passed. I don't tap anything to see it, and on my phone the verdict and the comment are both in view without scrolling. The lesson's explanation is there too.
- **P2.** The comment agrees with the verdict: it never praises an introduction marked as a miss, and never calls a passing one wrong. Any Japanese in it is in kana or rōmaji, not kanji. It never tells me to stop using rōmaji.
- **P3.** When my introduction misses, the model introduction is shown as one example of a good introduction, not as "the answer" I was supposed to type.
- **P4.** A short but real introduction passes, and the comment names one thing to add or fix. For example: a greeting, my name and a closing, with "where I'm from" left out. An answer that isn't a Japanese self-introduction doesn't pass, such as English only or a single word.
- **P5.** The same introduction gets the same verdict whether I write it in rōmaji, in kana, or in a mix.
- **P6.** When my answer can't be graded, I see a plain message that it couldn't be graded right now and won't count against me, with the example and the explanation. I never see "Correct!" or "Not quite." for an answer nobody judged, and the end-of-lesson score leaves that check out.
- **P7.** While writing, I can see my whole introduction of about six short sentences, and I can fix any part of it before I submit.
- **P8.** Lesson 120 is in the course as the last lesson of chapter 17, and I can complete it from start to finish.

**Scoring notes for the Tester, Lead and Alpha User**
- **P2, P4 and P5 need the real grader.** It's Gemini's free tier, so $0, at 15 requests a minute. Run a labelled set of about 10 introductions through it:
  - full kana, full rōmaji, and a mix of the same text;
  - one missing two parts, and one with a wrong particle;
  - greeting, name and closing only;
  - English only, a single word, and gibberish.

  P5 means the same verdict for the kana and rōmaji versions of the same text. Record each verdict and comment in `test.md`.
- **P6** can't be produced on demand by a walker. The Tester proves it with the grader made unavailable. The Alpha User scores it only if it happens.
- **P1, P3, P7 and P8** are for the Alpha walk. The walker should write one short real introduction and one deliberately thin one.
- **Lesson 120 is published by the Lead after merge:** `EDITOR=true pnpm --filter api authoring:review foundation-ja-ch17-l07`, then `authoring:publish`.

---

# 5. Out of scope

- **A "Try again" after "couldn't grade"** (3.4). Backlog.
- **Open checks in other lessons.** F.2.i keeps them to lesson 120.
- **The grader's comment in the chapter test's "To review" list** (`check-explanation` 3.6). Backlog.
- **Reviews and practice.** They already show the comment and "couldn't grade". If the Tech Lead changes the shared grading prompt rather than the rubric, they benefit too. That's allowed, and the eval set must still pass.
- **Very long answers** (about 6,000 characters causes a 500; PM backlog). An introduction is about 200 characters.
- **Whether a comment is linguistically right.** PM approval means fit for closed beta. Grader comments join the native-speaker sample (Blocker 6).

---

# 6. Notes for the Tech Lead (facts, not instructions)

- The lesson result panel never renders `feedback`. Lesson results carry no "couldn't grade" signal, though the server already knows: `scored: false` in `ChecksService`. Reviews get one.
- The fallback with a model answer returns `correct: false` (so "Not quite."). The fallback without one returns `correct: true` (so "Correct!"). Both are unscored.
- The lesson score counts `result.correct` for every check.
- q17's model answer is six sentences. Check P1 at the SE size with the longest realistic comment.
- A long introduction makes the grader call longer. The PM backlog notes a rare 12-second timeout. If timeouts are common at this length, P1 fails often in practice, so measure it.
