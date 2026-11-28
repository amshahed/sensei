# Brief: a listed meaning is marked right at once

Unit `exact-meaning-grading`. Written by the Project Manager, 2026-11-28. It comes from the PM backlog: `grading-fallback-honesty/test.md` F3, and the Tech Lead's note in `grading-model-404/tech.md` (risk table, "15 per minute is exceeded"). It runs on the server while PR #107 waits for the Mac.

---

# 1. Problem

Every meaning answer in reviews, practice, chapter tests and skip-tests goes to the AI grader, even when the learner typed exactly the meaning the app showed them. Since G.4.c every vocabulary review asks for a meaning, so this is the most common graded answer in the app. Three things go wrong.

**1. A listed meaning comes back "couldn't grade" when the grader is down.** The fallback only accepts the whole stored string (`grading-fallback-honesty/test.md` F3):
- "hello" for こんにちは, stored as "hello; good day; good afternoon";
- "thanks" for ありがとう ("thank you; thanks");
- "water" for 水 ("water (esp. cool or cold)");
- "eat" for たべる ("to eat"). That is the example the last brief used for its own persona.

Live data, read-only query on 2026-11-28. Of the 185 vocabulary words the 108 live lessons teach, 12 list several meanings, 22 have a part in brackets, and 12 are verbs listed as "to …". That is 44 distinct words, about a quarter, for which the answer a learner is most likely to type is not the whole stored string. The last brief assumed that "an exact answer already passes in the fallback" (`grading-fallback-honesty/brief.md` 5). For these words that is false.

**2. The free tier fails often, and a chapter test can exceed its limit in a single submit.**
- In the PR #91 test, 25 of 99 grading calls fell back: 18 were 503 "high demand" and 9 hit the 12-second cap (`open-check-followup/test.md` F5). A timeout means the learner waits 12 seconds for a verdict on "hello".
- The limit is 15 requests per minute (L.4.b). A chapter test sends up to 20 answers to the grader at once, when it is submitted (`assessments.service.ts`, `ASSESSMENT_SAMPLE_SIZE = 20`).
- The Alpha walker takes 17 chapter tests on this free tier, because Blocker 9 is still open. Without this unit, the Alpha verdict on reviews and chapter tests measures Google's free tier rather than the product.

**3. A right answer gets a comment that only repeats the verdict.** Model comments on right answers restate it ("Spot on — that's the correct meaning." under "Correct!", `grading-fallback-honesty/test.md` F1). B.2.g's rule is that no line under a verdict may only repeat it. An exact answer leaves the model nothing else to say.

# 2. Users and use cases

- **Absolute beginner (primary).** Does the daily review on the phone, tired, with 15 minutes. The recap card showed "water (esp. cool or cold)", so they type "water", which is right. They should hear so at once. They shouldn't wait 12 seconds, or be told it couldn't be graded.
- **Absolute beginner at a chapter test.** Answers 20 questions and submits. Most are words they know well. Every one of those should count toward the 80% pass mark, however busy the grader is.
- **Returning learner.** Takes skip-tests to jump chapters. Answers several in a row with the plain meaning, and needs them all scored, or the skip-test can't judge them.
- **The Alpha run.** It runs on the free tier. This is the cheapest way to make its grading verdicts about Sensei, not about Gemini's quota.

# 3. Decisions

## 3.1 A listed meaning is decided on the spot, without the grader

When a typed meaning is one of the item's listed meanings (3.2), it is marked right straight away. The grader is not asked. Everything else goes to the grader exactly as today.

- **Why:** H.2 already routes deterministic answers to an exact match ("faster, cheaper, more reliable"). A listed meaning is deterministic: it can't be more right than our canonical data (JMdict, the open Japanese–English dictionary) says it is. The fix covers all three problems at once: no outage result, no wait, no grader call and no comment that repeats the verdict.
- **Rejected:**
  - **Fixing only the fallback**, so it accepts any one meaning (F3's suggestion). That still waits up to 12 seconds, still uses a call per answer, and still lets a chapter test go over the limit in one submit.
  - **Keeping every answer with the grader, for its richer rating** (G.3: Easy, Good or Hard). On an exact listed meaning there's nothing to judge. L.4.b already records that this model rates some right answers "Easy" and so lengthens their review intervals.

## 3.2 What counts as a listed meaning

An answer counts when, after the rules below, it is the same as any one of the meanings the item lists. The meanings are separated by ";" in the stored meaning, the same text the recap card shows.
1. Capital letters, spacing and punctuation don't matter: "Hello!", "thanks.", "how do you do" for "how do you do?", "years old" for "... years old".
2. A part in brackets may be left out, or typed without the brackets: "water" for "water (esp. cool or cold)", "in front" or "in front of" for "in front (of)", "America" or "United States of America" for "(United States of) America", "good" or "good-tasting" for "good(-tasting)".
3. A listed verb meaning's leading "to" may be left out: "eat" for "to eat", "come" for "to come (spatially or temporally)".

- **Why these three:** each one is mechanical over the dictionary's own conventions. JMdict separates senses with ";", puts qualifiers in brackets, and marks verbs with "to". None of them asks us to judge English or Japanese, which the hard constraint forbids.
- **Rejected:**
  - **Ignoring "a", "an" or "the".** "a little" (ちょっと) and "little" are different meanings. A typed "a pen" goes to the grader, which accepts it.
  - **Typo tolerance** ("helo"). A typo can be a different word, so the grader judges it.
  - **Synonym lists** ("delicious" for おいしい). That is linguistic judgement. The grader judges it, as today.
  - **Splitting grammar explanations on commas or sentences** ("Is, am, are. Ends a polite sentence…"). They are explanations, not glosses. The same rule applies to them, and in practice it will rarely match.
  - **Number spellings** ("ten thousand" for 万 "10,000"). The grader judges it.
- **Known cost:** dropping a bracketed qualifier can drop a distinction. "there" is accepted for そこ ("there (place relatively near listener)"), "which" for どれ, "thank you" for いただきます. These are the dictionary's own head glosses, and the grader would most likely accept them too. Whether a teacher would accept them is beyond what I can judge, so it is flagged in section 6.

## 3.3 What the learner sees, and how it counts

- **"Correct!" with nothing under it.** There is no model comment, and no canned line either (B.2.g: a line that only repeats the verdict doesn't belong).
- **It counts as a plain right answer**, the same rating an exact match gets from the fallback today ("Good"). It counts in every score and pass mark, and the item is scheduled as for any right answer.
- **Rejected:** "Easy" for an exact answer. It would lengthen intervals on the strength of one typed word, and that is the cost L.4.b already accepted reluctantly.

## 3.4 Where it applies

- **In scope:** reviews, practice, chapter tests and skip-tests. They share one grader (G.4.a), so the rule is the same on all four.
- **Unchanged:** lesson checks (closed checks already have their own exact answer; lesson 120's open self-introduction stays with the grader), placement (multiple choice) and kana or kanji reading answers (already exact match).

## 3.5 Log entry

G.4.h, appended to `decisions.md`. It amends G.4.a, which said meaning answers go to the AI grader, and G.3, for this one case.

# 4. Promises

- **P1.** In a review, a practice drill, a chapter test or a skip-test, when I type one of a word's listed meanings, I'm told "Correct!" straight away, with nothing written under it. Examples: "hello", "good day" or "good afternoon" for こんにちは; "thanks" for ありがとう; "excuse me" for すみません.
- **P2.** Capitals, extra spaces and punctuation don't stop it counting: "Hello!", "thanks.", "how do you do" for はじめまして, "years old" for さい.
- **P3.** I may leave out a part of a listed meaning that's in brackets, or type it without the brackets: "water" for みず, "in front" or "in front of" for まえ, "America" for アメリカ.
- **P4.** For a verb, I may leave out the "to": "eat" for たべる, "go" for いく, "come" for くる.
- **P5.** The answers in P1 to P4 are marked right and count even when the grader is down, slow or busy. They never show "couldn't grade", and I never wait on the grader for them. A chapter test or skip-test answered entirely with listed meanings is scored on every question at such a moment.
- **P6.** They count like any right answer: in the review end-screen score, in a chapter test's score and pass mark, and the word comes back for review on the same schedule as any word I got right.
- **P7.** Any other answer is judged as it is today, with the grader's comment when it writes one. That covers a right answer in my own words ("delicious" for おいしい), "a pen" for a word listed as "pen", a typo ("helo") and a wrong answer ("goodbye" for こんにちは, "little" for ちょっと). When the grader can't judge one of these, I'm told it couldn't be graded and it doesn't count, exactly as today.
- **P8.** Lessons and placement are unchanged. Lesson checks, including lesson 120's self-introduction, and placement questions are marked exactly as before.

# 5. Out of scope

- **Showing the full listed meaning after a right answer.** Today only a miss shows the answer, so "there" for そこ never shows "(place relatively near listener)". That's a screen change, which can't be proven on this server. If the Alpha run shows learners missing a distinction, it becomes a new unit.
- **The wording of model comments on paraphrases and misses** (`grading-fallback-honesty/test.md` F1, "That's incorrect — いしゃ means doctor."). That's the grading prompt. It stays with B1's eval, after Blocker 9.
- **Editing stored meanings**, such as 人 "-ian (e.g. Italian)" or 万 "10,000". That's content.
- **Articles, typos, synonyms and number spellings** (3.2, rejected).
- **The grader's 12-second cap, the app's 15-second timeout, and the 6,000-character 500.** Still in the backlog.
- **The grader eval tool** (`authoring:grader-check`). It grades through the model on purpose.
- **Any file PR #107 changes** (`gh pr diff 107 --name-only`). Among them are `app.integration.spec.ts`, `packages/types/src/index.ts`, `users.controller.ts`, and everything under `auth/` and `onboarding/`. The Tech Lead should plan around them so nothing stacks on #107.

# 6. Notes

- **For the Tech Lead.**
  - Nothing in this brief needs the app to change. On an exact answer, the card already shows "Correct!" alone when there's no comment.
  - The rules in 3.2 are the product rule. How they are applied, and where, is yours. Where the rule sits must keep P7 (lesson 120's exemplar) and P8 (lesson checks) unchanged.
  - If you find that a rule accepts a wrong answer for any taught word, tell me and I'll narrow the rule. Please don't drop it quietly.
- **For the Tester.**
  - Every promise can be proven on the server: unit tests plus curl against the review, practice and chapter-test routes, with a learner on a throwaway Neon branch.
  - P5 needs the grader made unavailable, and also made to hang so a wait would show. "Straight away" means the answer returns without waiting on the grader at all.
  - P1 needs the grader up once, to show that an exact answer gets no comment where today it gets the model's comment.
  - If #107 has merged by then, the test learner must first answer the 18+ question (M.5.a).
- **For the Alpha run.** Reviews and chapter tests should now rarely show "couldn't grade" for the plain meaning. If they still often do, report it, because it means learners type something other than the listed meaning.
- **What I can't judge.** I can't say whether a teacher would accept the head gloss with its bracketed qualifier dropped (そこ "there", どれ "which", いただきます "thank you"). The rule follows the dictionary mechanically. The native-speaker sample (Blocker 6) should look at a handful of these.
