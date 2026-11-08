# Triage: Tester report on PR #70

Unit `22a-outline-gaps`. Project Manager, 2026-11-08. Covers what `test.md` (commit `0dcaf2d`, FAIL) leaves to the PM. No promise changes, so `brief.md` is untouched.

| Finding | Ruling | Outcome |
|---|---|---|
| F2 recap card | Back shows what the learner has to recall for that item type. Table below | **Fix now, in PR #70** |
| F1, P7 "over-enforced" | Bare あります and います are within the taught patterns. P7 stands as written | Fix now (Developer), product reading below |
| P5 "content is PM review" | 21 author notes read. Fit to draft from | Accepted. Drafted text is judged at 22b |
| F3 rōmaji particles | Tech Lead's pick, as `test.md` says. One product constraint below | Tech Lead, before 22b drafts lessons 21 and 43 |
| F6 rōmaji in prompts | If the Tech Lead leaves it, PM review at 22b reads for it | Accepted either way |
| Linguistic correctness | Nobody on the team can judge it. Unchanged from `content-review.md` | Accepted for closed beta, Blocker 6 |

---

# F2: what the recap card shows

**The finding is wider than reported.** `LessonPlayer.tsx` uses `item.reading` as the back for every item, and that fails for all four item types. Read from the code and `test.md`'s payload, not seen on a simulator:

| Item | Today | Why |
|---|---|---|
| Word | かぎ / かぎ | The reported case, G.4.c |
| Kana | あ / あ | The ingest stores the kana as its own `reading` (`ingest/kana.ts:10`). Rōmaji sits in `data`, which the app never receives |
| Grammar | Pattern / blank | `reading` is null, so tapping shows nothing |
| Kanji | 一 / raw dictionary form such as ひと- | `reading` is the raw first KANJIDIC reading, with its `-` and `.` markers (`ingest/kanji.ts:65`, G.4.a) |

Kana is the worst of these. The first 14 lessons are the absolute beginner's first experience, there is no audio, and the card says "recall its sound" and then shows the same character.

**Ruling**

| Item | Front | Back on tap |
|---|---|---|
| Word (all 185, phrases included) | Kana | **Meaning** |
| Grammar | Pattern | **Meaning** (the 24 meanings) |
| Kana | Character | **Rōmaji** |
| Kanji | Character | **Meaning, then readings**, in the same clean form the review answer shows, no `-` or `.` |

The line above the cards changes to "Tap each card to test yourself before the check", because "its sound" is now wrong for words and grammar.

**Why meaning for words**
- Since G.4.c every word review asks "What does 「かぎ」 mean?". The card rehearses the question the learner will actually get, using the same text the answer shows.
- The persona wants conversation on a trip. Knowing that かぎ is "key" is the point of a vocabulary lesson.
- The beginner can already read the front: every sound on it has been taught (P1). Rōmaji would tell them only what they just decoded.

**Rejected**
- **Rōmaji for words.** In lessons 15 to 20 it puts the answer one tap before a check P2 says has no hint. Words have no stored rōmaji, and generating it is wrong where it matters most: wanakana gives `konnichiha` for こんにちは and `konbanha` for こんばんは (run on the installed library). We would teach a misspelling in the first phrase lesson.
- **Meaning and rōmaji together.** Same problems, and more to read for a tired learner on a phone.
- **Dropping the card for words.** The three-beat lesson is locked, and this beat is cheap once it does something.

**Cost accepted.** Lessons 15 to 20 recap meaning while their check asks for the sound. The sound practice is the check itself, which is what P2 wants.

**What must hold for F2 to close**
1. On each of the four item types, tapping shows the back in the table above and never repeats the front or shows nothing.
2. Long fronts fit. Kana makes fronts much longer: よろしくおねがいします is 11 characters, the front is 40pt, and the card is a single row. Nothing may be clipped or pushed off a phone screen. Backs are long too: grammar meanings run to 100 characters and phrase glosses can be longer.
3. No rōmaji appears on a word's card.
4. Because this changes the screen, it has to be seen rendered on the simulator, for at least one lesson of each type. `tech.md` section 2's "no mobile changes" no longer holds, so the Tech Lead should amend it. How rōmaji and clean kanji readings reach the app is the Tech Lead's call.

---

# F1: what P7 means for あります and います

Lesson 74 teaches があります and lesson 75 がいます. ほん は つくえ の うえ に あります is the same verb with the thing moved to the front, so it is taught grammar. It is not an early use of the ます lesson.

The exemption should be exactly those two words, after their patterns are taught, with か allowed after them. Before their own lessons, ありません, いません, ありました and いました stay rejected. Lesson 88 teaches ません and 92 teaches ました. A fix that lets those through would break P7 the other way, so the tests should pin them.

---

# P5: author notes

I read all 21 notes in the spec. The five phrase lessons (21 to 25) each require when and to whom, a real situation per phrase, and a check that gives a situation and asks which phrase fits. That is what P5 needs. The notes for the grammar limits (ます, ません, ました, て-form, たいです, がすきです) match brief 3.2 and C1 and C2 of `content-review.md`.

This approves the instructions only. Whether each lesson really tells the learner when to say a phrase is judged on the drafts at 22b. The pronunciation statements in the notes (えい, おう, ぢ, づ, っ) agree with my own understanding and are not expert-checked, so they join the native-speaker sample.

---

# F3: one product constraint

The approach is the Tech Lead's. Whichever is chosen, a beginner who types konnichiwa for こんにちは, or watashi wa for わたし は, must never be marked wrong. A gate that stops drafts from asking for those answers meets this. Leaving it for Alpha to find doesn't, because lesson 21 is one of the first phrase lessons and this persona has already quit one app.
