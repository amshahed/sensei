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

## 2026-11-14: 22b drafting run

- Drafted from the main checkout with `--max-cost 0.5` per lesson. Measured cost, draft plus critique: lesson 2 $0.071, 20 $0.079, 21 $0.090, 43 $0.055. All four passed the course gate and the critic (lesson 2's critic noted textbook-ish examples, persimmon and voice, as a minor fail on example-feel).
- **Lesson 19 (`foundation-ja-ch04-l05`, small っ) rejected twice by the course gate, about $0.145 spent.** Both drafts wrote typed checks as recall from English ("Type the kana word that means 'school'"), not reading. P4 needs the prompt to show the kana (がっこう) with no rōmaji. The TYPED READING instruction does reach the drafter (`lesson-prompter.ts:151`, `typedReading` is true), and the model ignored it twice. That makes it systematic, so it is likely to hit all 7 sound lessons. Sent to the Tech Lead; no more redrafts until fixed.
- Running total for 22b: about $0.44 of the $2.50 cap.

## 2026-11-23: authoring-polish live kanji apply (tech.md 3.3)

- PR #95 merged (`42f327e`), Tester PASS on `e541cb5`.
- Backup: `ops/work/authoring-polish/kanji-rows-before.json` (9 rows, live, read with Prisma before any write).
- Dry run on live: exactly 9 of 103 rows. 校 meaning "exam" → "school"; `data.word_reading` added to 食 た.べる, 飲 の.む, 読 よ.む, 書 か.く, 行 い.く, 来 く.る, 見 み.る, 聞 き.く.
- Apply: `ingest:items kanji` upserted 103, and a second dry run shows 0 rows to change.
- Verify (SQL on live): 校 = "school"; all eight verb kanji have `word_reading`; no other meaning changed. That matches the PM's 41-kanji audit (brief 4.1: only 校 differed).
- Rollback: re-run the ingest with the supplement emptied, or a nine-row `UPDATE` from the backup. The Tester proved both on `test-open-check-followup`.

## 2026-11-28: device handoff set up (founder request)

- The private store `amshahed/sensei-private` was created and first pushed from the Mac: 1,036 files, 91 MB.
- Verified with a fresh clone from GitHub into a throwaway home:
  - every restored file is byte-identical to the Mac's: both `.env` files, drafts, published lessons, datasets, memory, all 326 transcript files, the global `CLAUDE.md`, settings, templates and skills;
  - 0 readable secrets in the store.
  - The test copy was deleted afterwards.
- Fixed along the way:
  - The passphrase one-liner was bash-only and wrote an empty file in zsh. It is replaced by `ops/bin/set-passphrase.sh`.
  - `state.mjs` no longer pulls straight after a fresh clone.
