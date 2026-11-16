# Wave 3 notes (Lead)

Lessons 78 to 120, without audio lessons, drafted 2026-11-16 after PR #82 (authoring-hardening) merged. Per-lesson lines are in `run-log.txt`. Same day: the six lessons lost in wave 2 were redrafted ($0.36): 44, 53 and 74 drafted, critic PASS. 54, 55 and 77 were rejected (see below).

## Result

- 38 lessons, $2.61 by the driver, plus $0.01 critic on two recovered drafts. No paid reply was lost.
- **32 drafts:** 30 straight through, plus 2 recovered from `.failed.json` by a Lead hand fix and `--recheck` at $0:
  - 99: a leaked self-correction block was removed.
  - 120: `grading: "exact"` was dropped on four typed checks. In the one lesson that allows open checks, normalisation refuses this on purpose.
- **6 rejected, saved as `.rejected.json`:** see the table.
- Critic: 17 PASS, 15 FAIL. Most FAILs are example-feel on vocab lessons (bare words). Several F-Grammar learner-confusion FAILs say the examples use particles or verbs not yet taught (88, 91, 97). The gate leaves joined particles to review (README, F.2.d), so **read every F-Grammar lesson in full**.

## Rejected (waves 2 and 3), and what each needs

| Lesson | Id | Gate error | Likely fix |
|---|---|---|---|
| 54 | `foundation-ja-ch09-l04` | Kanji 田 and 力 not taught (teach[4], q6) | PM hand edit, then `--recheck` |
| 55 | `foundation-ja-ch09-l05` | I-Reading Teach spells out `chichi`, which q4 asks for | PM hand edit, then `--recheck` |
| 76 | `foundation-ja-ch12-l05` | Kanji 木 not taught (twice, wave 2) | PM hand edit, then `--recheck` |
| 77 | `foundation-ja-ch12-l06` | I-Reading Teach spells out `hon`, which q3 asks for | PM hand edit, then `--recheck` |
| 83 | `foundation-ja-ch13-l06` | I-Reading Teach spells out `eki`, which q1 asks for | PM hand edit, then `--recheck` |
| 86 | `foundation-ja-ch14-l03` | Uses ます before lesson 87 teaches it (verb vocab lesson) | PM edit (dictionary forms), or one `--force` redraft (~$0.08) |
| 87 | `foundation-ja-ch14-l04` | Uses を before lesson 89 teaches it (`ごはん を たべます` ×3+) | PM edit (`ごはん、たべます` or verbs with no object), or one `--force` redraft (~$0.06) |
| 94 | `foundation-ja-ch14-l11` | Kanji 目, 耳, 門 not taught | PM hand edit, then `--recheck` |
| 95 | `foundation-ja-ch14-l12` | I-Reading Teach spells out `tabemasu`, which q4 asks for | PM hand edit, then `--recheck` |
| 104 | `foundation-ja-ch15-l08` | Kanji 門 not taught | PM hand edit, then `--recheck` |

Lesson 67 passed `--recheck` after PR #82 and is a draft now. Lessons 47 and 75 still carry an open check (q4), and publish refuses them until it's converted.

## Patterns (for the PM and Tech Lead)

1. **I-Reading still writes the answers in rōmaji.** Since PR #82 added the prompt line, 4 of 5 I-Reading drafts were rejected for it (55, 77, 83, 95), and only 113 passed. The gate catches every one, so nothing unsafe gets through. The cost is a hand edit each. Every I-Reading lesson is now drafted, so a prompt fix only pays off on redrafts. Not worth a unit now.
2. **Kanji lessons explain kanji by their parts.** 54 (田 力 in 男), 76 (木), 94 (目 耳 門) and 104 (門) use component kanji that haven't been taught. Either the PM rewrites the parts in words, or the PM and Tech Lead rule that a component may appear in a kanji lesson's Teach. That ruling would amend F.2.a with a new decision entry.
3. **Outline order pinch at 86 to 89.** The verb vocab lesson (86) comes before ます (87), and ます comes before を (89). The drafter reaches for both. If the PM finds this lesson-by-lesson patching awkward, the order is the PM's call. Changing it is an outline edit like F.1.c, and it changes lesson IDs.
