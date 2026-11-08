# Journal

Append-only dump of detail that shouldn't sit in working context: analysis, reasoning, notable output. Newest at the bottom. `ops/CHECKPOINT.md` links here when a resume needs it.

---

## 2026-11-08: state audit before the team model started

Evidence gathered from GitHub, the live database, session transcripts and the code.

- **Live database:** 1 module, 1 chapter, 1 lesson, 1,593 items (92 kana, 1,358 vocab, 103 kanji, 40 grammar), 1 user, 0 lesson completions, 0 mastery rows. All migrations through `20261104230000_reminders` applied.
- **Outline at `tools/authoring/output/skeleton.json`:** 15 chapters, 113 lessons (23 F-Kana, 36 F-Vocab, 18 F-Grammar, 13 F-Kanji, 10 I-Reading, 2 I-Writing, 4 I-Listening, 7 I-Speaking). 92 kana, 162 vocab, 19 grammar and 51 kanji items.
- **Outline gaps confirmed against the item table:**
  - No item matches こんにちは, ありがとう, すみません, はじめまして, よろしく or 日本, by display or reading.
  - No voiced kana (が, ば, ガ), no きゃ, no っ. D.2 makes these derivative, so they are not items.
  - Grammar has no か, の, ます form or て-form, yet the outline teaches ませんか, ましょう and てください.
- **All 40 grammar items have no meaning text**, so AI writes every grammar explanation regardless of source list.
- **D.2 already places set expressions in Vocab** (with `multi_word: true`), so adding phrases is a data gap, not new design.
- **Sound-variant lessons:** `SkeletonSchema` requires at least one `itemId` per lesson, and Checks target items. With no が item, a lesson on が has to target か, so が gets no schedule of its own and misses land on か.
- **Not built:** no Azure or R2 code anywhere in `apps` or `packages`. No Railway or Docker config in the repo.
