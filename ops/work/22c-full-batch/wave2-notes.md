# Wave 2 notes (Lead)

Lessons 41 to 77, drafted 2026-11-15 after PR #78 merged (new drafter prompt F.2.e and the two new gate errors). Per-lesson lines are in `run-log.txt`.

## Result

- 30 to draft: 21 drafted, 3 rejected, 6 crashed. The driver total is $1.64, but the crashes were paid for and aren't in it (see below), so the real spend is about $2.06.
- Redrafts: lesson 62 (kanji 口 not taught) passed the gate. Lesson 76 (kanji 木 not taught) was rejected again and goes to the PM for a hand edit.

## The six crashes were paid for and thrown away

Lessons 44, 53, 54, 55, 74 and 77 (three F-Grammar, one F-Kanji, two I-Reading) crashed with "Exit status 1". Reproduced on lesson 44: **the model's reply failed schema parsing** (`check.questions[2].grading` was something other than `"open"`). The drafter throws on parse, so the paid reply is lost, no cost line prints, and the driver logged $0. Each one cost about $0.07. Lesson 13's crash in wave 1 was probably the same.

**Not retried yet:** each retry risks losing another paid draft the same way. They wait for the pipeline fix in `ops/work/authoring-hardening/`.

## Rejected

| Lesson | Id | Problem | Next |
|---|---|---|---|
| 62 | `foundation-ja-ch10-l06` | Kanji 口 not taught | Redraft passed the gate |
| 67 | `foundation-ja-ch11-l03` | "the explanation spells out 'zero' before check q8 asks for it". ゼロ in rōmaji is the English word, the Tester's F1 collision | `--recheck` after the F1 fix |
| 76 | `foundation-ja-ch12-l05` | Kanji 木 not taught, twice. Probably used to explain a kanji built from it | PM hand edit, then `--recheck` |

## For the PM at wave 2 review

1. **Open checks:** lessons 47 (`foundation-ja-ch08-l07`) and 75 (`foundation-ja-ch12-l04`) each have one check marked by the AI grader. Under `check-explanation` brief section 5, no lesson with an open check is published until the follow-up unit (the grader's comment and an honest "couldn't grade") lands. Either convert the check to a closed one or hold the lesson.
2. **Critic `item-ref-match` on vocab lessons 41, 60, 72, 73:** it says the target IDs are kanji forms (`ja:vocab:何`, `本`, `財布`) while the lesson shows kana. Item IDs are canonical keys and vocab is shown in kana for the beta (G.4.c), so this is probably critic noise. Confirm on one.
3. Lesson 46's critic says `ともだち の かばん` is translated inconsistently ("my friend's" or "a friend's").
