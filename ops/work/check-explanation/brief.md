# Brief: what a lesson check tells me after I answer

Unit `check-explanation`. Written by the Project Manager, 2026-11-14. Raised in 22b `content-review.md` section 5 item 5 and 22b `tech.md` section 7. Decision logged in `decisions.md` as B.2.a.

---

# 1. Problem

- **A miss in a lesson teaches nothing.** After a wrong answer, the check screen shows `Answer: <right answer>` and nothing else (`LessonPlayer.tsx`). Every drafted check has an explanation of why: 111 of 111 checks in the 22b drafts and the 22c wave 1 drafts so far. It's published with the lesson, and no learner ever sees it.
- **On a typed reading check, the answer shown is the question.** Lesson 19 q8 asks me to read きっぷ and type how it sounds. If I type `kipu`, I see `Answer: きっぷ`: the kana I just failed to read, never "kippu". The feedback can't teach me the typing rule for っ (a small っ doubles the next letter). 11 typed checks are live (lesson 19: 5, lesson 20: 5, lesson 43: 1), and every reading and sound lesson in 22c adds more.
- **Fixing the text alone isn't enough.**
  - The drafter didn't put the rōmaji in the typed explanations of lessons 19 or 20. Only my 22b edit put it into lesson 19's.
  - Lesson 20's typed explanations still don't have it ("ともだち — four kana, with no pause and no long vowel in this one."). Lesson 20 can't be republished until its passage passes the particle gate, so its text can't be fixed now.
- **Converting the answer to rōmaji mechanically gets particles wrong.** For lesson 43 q4, `ともだち は いしゃ です` comes out as `tomodachi ha isha desu` (wanakana, the conversion library the app uses, checked 2026-11-14). The point of that lesson is that this は is said "wa" (22b P7, H.2.a). B.3.a found the same problem with `konnichiha`.
- **The 22b explanation edits can't be seen.** 10 in lesson 19 and 3 in lesson 20.
- **Lesson 1, the old seed, has no explanation** on any of its 5 checks. 22c replaces it with a draft that has them. The draft format doesn't require an explanation, though, so a check without one has to look right.

---

# 2. Users and use cases

- **Absolute beginner (primary).** On the phone, tired, 15 minutes a day. Misses a check, most often a typed reading in a sound or reading lesson, or picking a greeting for a situation. Needs to learn right then what the answer is, in a form they can use next time, and why. Has quit a gamified app before. A bare "wrong" with no help is how that starts.
- **The lucky guess.** Picks the right one of four choices without knowing it. The "I guessed" toggle (K.1) exists because a right answer isn't proof. They gain from the same explanation.
- **Returning learner.** Gets most checks right. Must not be slowed down by extra taps.

**Where the learner answers questions today**

| Surface | Where its questions come from | What it shows after an answer | Has an authored explanation? |
|---|---|---|---|
| Lesson checks | Written per lesson, reviewed by the PM | `Correct!` or `Answer: X`. Multiple choice also marks the right choice | **Yes, never shown** |
| Chapter test (skip and exit) | Built from item data, one per item (I.4.d.a) | Score, then "To review": prompt, my answer, the right answer | No |
| Reviews | Built from item data (G.4.a) | `Correct!` or `Answer: X`, plus the grader's comment on meaning answers | No |
| Practice | Same as reviews (J.1.f) | Same as reviews | No |
| Placement | Built from item data (I.4.f) | No result per question, by design | No |

---

# 3. Decisions

## 3.1 Show the explanation after every lesson check, right or wrong

**Chosen: after a right answer too.**
- **No extra tap.** I already tap Next after every check. A line under "Correct!" costs a few seconds of reading, not an extra interaction.
- **A right answer isn't proof.** Multiple choice can be guessed, which is why K.1 exists. The explanation is often the mnemonic ("き is ki — think of a KEY"), and seeing it just after recalling the answer helps it stick.
- **One rule is easier to write for.** If an explanation can appear after either result, it has to read right after either. That gets rid of the "Nice!" after a miss that 22b had to fix by hand (22b 7.3).
- Showing it only after a miss makes it feel like a penalty notice.

**Rejected**
- **After a miss only.** Saves one line, but the lucky guesser gets nothing and drafts need two ways of writing.
- **After a right answer only when "I guessed" is ticked.** A hidden rule, and typed checks have no toggle.
- **Behind a "Why?" tap.** The learner who needs it most, tired and having just missed, is the least likely to tap.

## 3.2 How it's shown

- The verdict comes first, then the right answer if I missed, then the explanation.
- It appears with the verdict, with no tap. It must be in view without scrolling on an iPhone SE-size screen, the alpha device. The worst live case is lesson 43 q5: a question, four choices a sentence long, and a two-line explanation.
- It's shown as plain text, as written.
- How it's built is the Tech Lead's call.

## 3.3 A missed typed check shows the answer in rōmaji as well as kana

When I miss a typed check whose answer is in Japanese, the answer line shows both, for example `kippu` and `きっぷ`.

**The rōmaji is spelled the way the app accepts a typed answer and the lessons teach typing:**
- っ doubles the next letter: kippu, gakkou.
- Long vowels are spelled out the way the learner types them: gakkou, okaasan.
- A particle in a sentence is spelled as it sounds: `tomodachi wa isha desu`. こんにちは is konnichiwa, and こんばんは is konbanwa (H.2.a).
- A check about the kana は itself shows "ha" (H.2.b).
- If I type exactly what's shown, it's accepted.

This applies whether the answer is stored in kana or in rōmaji. Wave 1 reading lessons 4 and 8 store `ao` and `kasa`, and I see both forms either way. Multiple choice is unchanged, because the right choice is already marked.

**Why the app does it, not the explanation text**
- It has to be right on every typed check, and the drafter doesn't reliably write it (lessons 19 and 20).
- It fixes lesson 20's five typed checks without republishing lesson 20.
- Rōmaji worked out from the stored answer by fixed rules is deterministic and agrees with grading. It isn't AI-written language, so the hard constraint isn't touched.

**Rejected**
- **Explanation text only.** See above.
- **Rōmaji only.** The skill is linking the kana to its sound, so the learner needs both.
- **Rōmaji only when I typed rōmaji.** More rules for no gain. Someone typing kana loses nothing by seeing it.
- **Rōmaji after a right answer as well.** I just typed it.

**Fallback.** If the Tech Lead finds that sentences can't reliably spell particles as they sound, they say so in `tech.md`. Then sentence answers show kana only, and single words keep the rōmaji. Showing "ha" for the particle は is worse than showing no rōmaji.

## 3.4 A check with no explanation

**Chosen:** I see the verdict and the right answer, with rōmaji under 3.3, and nothing else. No empty box, no placeholder, no "No explanation available".

**Rejected**
- **AI writes one at the moment of the miss.** That would put unreviewed AI-written explanations of Japanese on a teaching screen. Under the hard constraint PM review is the minimum, and runtime text skips it. It would also mean a model call and a delay on every miss.
- **Generic filler such as "Review the lesson".** It's noise, and it teaches learners to skip the line.

**From now on, a missing explanation is a content defect.** Every lesson check published from 22c on has one, and PM review enforces it. A gate warning would help, but whether to add one is the Tech Lead's call. Today the only checks without one are lesson 1's 5 seed checks.

## 3.5 Rules for writing explanations, now that learners see them

These go in the drafter prompt (how is the Tech Lead's) and apply to every PM review from 22c wave 1 on.

1. One or two short sentences.
2. Reads right after a right answer and after a wrong one. No praise ("Nice!", "Great work!"), no "Not quite".
3. For a typed check, the explanation says why the answer is spelled that way, for example "the っ doubles the k". The answer line now shows the rōmaji, so the explanation may repeat it but doesn't have to.
4. Never spells out how to type a word before the check in that lesson that asks me to type it. This is the 22a triage rule that 22b applied to lesson 19. Pointing out one kana's sound is fine, because kana are already taught.
5. The course rules apply as everywhere else: only taught Japanese, and no kanji outside F-Kanji lessons.

**Lessons checked against these rules** (scanned 2026-11-14: all 11 drafts that passed the gate, the 5 published 22b lessons and 6 from 22c wave 1):
- **Rule 2:** one breach. Lesson 43 q4 said "Topic ともだち, then は, then いしゃ, then です. Great work!". I edited the draft to "Topic ともだち, then は (said 'wa'), then いしゃ, then です." It still parses against the draft schema. The live lesson needs a republish, which re-runs the gate (Lead).
- **Rule 4:** no breach. An automated scan found no explanation containing the full rōmaji of a later typed answer.
- **Rule 3:** lesson 20's typed explanations don't say why the answer is spelled that way. 3.3 still shows what to type. Accepted, because lesson 20 can't be republished anyway.

## 3.6 Chapter tests, reviews, practice and placement stay as they are

- They don't show lesson checks. Their questions are built from item data, one per item, and have no authored explanation to show.
- Their answers are never the thing I was asked to read (G.4.a, G.4.c, I.4.d.a):
  - kana → rōmaji
  - words and phrases shown in kana → English meaning
  - grammar → meaning
  - a kanji → its reading in kana

  The lesson problem, where the answer shown is the question, can't happen there.
- Reviews and practice already show the grader's one-line comment on meaning answers.
- **Rejected: reusing a lesson check's explanation in reviews.** Each one is written for one particular question ("In the passage, ..."), and an item can have several.
- The chapter test's "To review" list doesn't show the grader's comment on a missed meaning answer. That's minor and goes to the backlog.

## 3.7 Priority

- This lands before the 22c Alpha run (22b `content-review.md` section 4). It doesn't block drafting or publishing waves.
- It's small: the lesson check screen, plus what the app gets back after a check is graded.

---

# 4. Promises

Scored on the iOS simulator, on the iPhone SE-size device `Sensei 22a SE3`, in the published lessons.

- **P1.** After I answer any check in a lesson, right or wrong, I see a short explanation of the answer along with whether I was right. It's there before I move on, and I don't have to tap anything to see it.
- **P2.** When the result appears on my phone, the verdict, the right answer (if I missed) and the explanation are all in view at once. I don't have to scroll to find them, and no text is cut off. This holds on the longest check in the published lessons (lesson 43, "What does わたし は せんせい です mean?").
- **P3.** When I get a check wrong that asked me to type Japanese, I see the right answer in rōmaji as well as in kana, spelled the way the lessons taught me to type it:
  - After missing きっぷ, I see "kippu".
  - After missing the sentence in lesson 43, I see "wa" for は, not "ha".
  - When I later type what I was shown, it's accepted.
- **P4.** No explanation contradicts how I did. None congratulates me after a wrong answer, and none says I was wrong after a right one.
- **P5.** No explanation shows me how to type a word before the lesson asks me to type it.
- **P6.** When a check has no explanation, I still see whether I was right and the right answer. There's no blank space, placeholder or error where the explanation would be.

**Scoring notes for the Lead and the Alpha User**
- A real beginner misses things. The walker should get at least one multiple-choice check wrong, one typed word, and the typed sentence in lesson 43.
- **P3, "later accepted":** lessons can't be reopened, but がっこう and ちょっと are typed in both lesson 19 and lesson 20. A walker who misses one in lesson 19 can type in lesson 20 what lesson 19 showed. The Tester proves the other cases.
- **P4 needs lesson 43 republished** before the Alpha run.
- **P6:** lesson 1 has no explanations only while it's still the seed. If 22c has replaced it before the Alpha run, the walker may meet no such check. Then the Tester's evidence stands, and the PM accepts it in triage.

---

# 5. Out of scope

- **Lesson checks marked by the AI grader (open checks): its comment, and an honest "couldn't grade" message.** Today a lesson check the grader couldn't judge looks like a miss (`Answer: <model answer>`), unlike reviews. None is live or in the 22b sample, so an Alpha run couldn't score it. **Trigger:** a follow-up unit has to land before the first lesson with an open check is published. PM review in 22c watches for one.
- Chapter tests, reviews, practice and placement (3.6).
- **The "Type in rōmaji or kana" placeholder** (22b 5.2). I called it a one-line change. It isn't: the same box takes English meaning answers, where that text would mislead. Typed prompts already say "rōmaji is fine" where it matters (22b). Backlog.
- The reading printed twice on example blocks (22b 5.4). That's in the Teach beat, a different screen. Backlog.
- A list of my misses at the end of a lesson.
- Practice-beat hints, which are never shown.
- Whether any explanation is linguistically correct. PM approval means fit for closed beta only (OM.1, Blocker 6).

---

# 6. Notes for the Tech Lead

- **An explanation gives the answer away** ("か is ka"), so handle it like the answer. It should reach the app only after I've answered. The lesson payload already withholds the answer.
- **The rōmaji shown has to match grading.** Unknowns that are yours to settle:
  - Katakana ー: wanakana writes ゲーム as `geemu`. Is that accepted?
  - Particles (H.2.a, H.2.b).
  - Answers stored in rōmaji (wave 1 lessons 4 and 8).
  - If sentences can't be done reliably, use the fallback in 3.3.
- **Keep my typed answer visible** in the box after a miss, so I can compare it with the answer.
- **Republish lesson 43** from the edited draft for P4. Lesson 20 can't be republished, and nothing here needs it to be.
- Rule 3.5 goes into the drafter prompt, not `corrections.jsonl`, because corrections are fed only to drafts of the same lesson type, and this rule covers every type.
