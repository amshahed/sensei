# Content review: grammar meanings

Unit `22a-outline-gaps`. Project Manager, 2026-11-08. Covers `grammar-meanings.json`, 24 entries (14 existing rows, 10 new).

---

# Verdict: APPROVE WITH CORRECTIONS

Fit for closed beta only (OM.1). **Not linguistically verified.**

# Provenance

- **AI-written. Not checked by a Japanese expert or a native speaker.** Written by the Project Manager agent, which is not a Japanese expert. Neither is the founder.
- No canonical source covers these. JMdict and the Tanos list give no learner-facing grammar meanings, so the "correctness comes from canonical data" constraint can't be met here. Only a native-speaker sample can close this (Blocker 6).
- Written in my own words. No copyrighted reference book was opened or used (E.2).

# How they were written

| Rule | Reason |
|---|---|
| Short answer first, then one short clarifying line. 100 characters at most | The text is the exemplar the AI grader compares against, and the correction the learner reads when tired. A typed "also" or "is" needs a matching core |
| Covers every use the slice teaches, and no others | A correct answer on a taught use must not be marked wrong. A use the slice doesn't teach (で for "by means of") would only add length |
| English only, Japanese only where the pattern itself needs it | Each Japanese example is more unverified language, and it would have to use only sounds and words taught by that point (P1, P7) |
| No kanji | P9. The meaning is shown as the answer in reviews |

**ID check.** Keys come from the ingest's slug rule applied to `n5-grammar.json` and to the appendix names. All 14 existing ids match the source file, and the 10 new ones collide with nothing. I did not query the live rows. Tech plan section 3, step 3 ("exactly 24 grammar rows have a meaning") catches any miss.

---

# Corrections

**C1. が好きです becomes がすきです. Done in `brief.md`. The Developer must use it.**
好 is not one of the 41 taught kanji, and the kana rule covers vocabulary only. A review would have asked "What does 「〜が好きです」 mean?", breaking P9, and the F-Kanji gate would have flagged the lesson's own target. The pattern is now `〜がすきです`, id `ja:grammar:がすきです`, lesson 116 title "I like: がすきです". This is the one key that differs from what the appendix said. The appendix is updated to match.

**C2. The たいです review should read 「〜たいです」, not 「stem +たいです」.**
That row's display comes from the Tanos ingest, and a review prints it as is. A beginner shouldn't see the word "stem" in a question. The Tech Lead picks how. If it costs more than a one-line change, leave it for Alpha and note that in `dev.md`. It doesn't block P8, because the question is still answerable.

**C3. New rows display as written in the appendix.** `か`, `の`, `じゃありません`, `ます`, `ません`, `ました`, `て-form`, `い-adjective`, `な-adjective`, `〜がすきです`. "What does 「て-form」 mean?" reads oddly, but the lessons use those names, so the learner can answer it. Watch at Alpha.

**C4. Add grammar to the live grader check.** Tech plan P6 checks 5 paraphrases on phrases. P8 rests on the same grader, so it needs the same check. Suggested answers that should pass:

| Item | Learner types | Should be |
|---|---|---|
| です | is | Accepted |
| も | too | Accepted |
| に | at | Accepted (Hard is fine, it names one use) |
| に | to | Accepted (Hard is fine) |
| を | object particle | Accepted |
| て-form | connects verbs | Accepted |
| ませんか | do you want to | Accepted |
| か | because | Rejected |

If a fair answer fails, the PM rewrites that meaning. The file is committed content for that reason.

---

# Least sure, for the native-speaker sample

Most doubtful first.

| # | Item | Doubt |
|---|---|---|
| 1 | て-form | It is a form, not a meaning. "Linking form" is a simplification, and the slice uses it only before ください. The hardest point in the slice (brief 3.2) |
| 2 | は | "Topic" and "as for" are the usual beginner approximations. They leave out contrast and the difference from が |
| 3 | に | One meaning covers three uses. It shows uses a learner may not have reached yet: lesson 81 teaches location, 90 direction, 99 time |
| 4 | ます, ません | "Do or will do" leaves out ongoing states and doesn't explain tense. Is it a fair first statement? |
| 5 | い-adjective, な-adjective | Describes form, not meaning. きれい ends in い but is a な-adjective, and the slice teaches it, so "ending in い" can mislead |
| 6 | ませんか | Is "won't you / would you like to" natural as the gloss, and is it clearly separate from ましょう? |
| 7 | です | "Is" stops being true after an adjective, where です mainly adds politeness. Lesson 109 uses it that way |
| 8 | がすきです | Correct as far as I can judge. Doubt is whether "I like" misleads, since the subject isn't stated in the pattern |
| 9 | と | "And" joins nouns only. "With" is described in very few words |

# What I could not verify

- Whether any meaning is linguistically right, beyond my own non-expert judgment. That includes all 24.
- How the grader rates real answers against these. No grader call was made. C4 covers it.
- Whether they match the eventual lessons. Lessons are drafted in 22b and 22c, and PM review there has to check that lesson explanations agree with this file.
- Whether the short forms feel clear to a beginner. Alpha will show that.
