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

## 2026-11-28: server `turingMachine` set up for sensei

- Server: Debian 13 (OMV 8), user `shahed`, `192.168.0.51`, Tailscale `100.127.177.30`. Done from the Mac over SSH, with `ed_key` added by the founder using `ssh-copy-id`.
- Installed in the user's home only, with nothing system-wide:
  - nvm with Node 22.23.5;
  - pnpm 11.5.3 through corepack;
  - gh 2.106.0 in `~/.local/bin`, logged in with the Mac's gh token piped over SSH;
  - the plugins `code-review` and `frontend-design`.
- Claude Code was already installed and logged in.
- The passphrase file was copied with scp (600). The repo is cloned to `~/workspace/sensei`. `state.mjs pull` restored 837 files and backed up 26 server files to `~/.sensei-state-backups/`.
- Claude config on the server:
  - the server's own global `CLAUDE.md` (NAS rules) moved to `~/.claude/MACHINE.md`, which the shared `CLAUDE.md` now imports;
  - the server's theme is merged into the synced `settings.json`.
- Verified on the server:
  - `pnpm install`, the types build and `prisma generate`;
  - `prisma migrate status`: up to date, so live Neon is reachable;
  - `pnpm typecheck`;
  - `pnpm test`: 64 suites, 1,582 tests, all passing.
- Launcher `~/.local/bin/sensei` (tmux session `sensei`), and Mac ssh aliases `sensei`, `turing`, `turing-ts`.
- tmux needs the founder's sudo password: `sudo apt-get install -y tmux`.
- Both machines use pnpm's isolated layout. pnpm 11 ignores `.npmrc`'s `node-linker=hoisted`, so that comment is stale. No change is needed, because the Mac already runs this way.

## 2026-11-28: auto-resume after usage limits (founder request)

- The founder is on Claude Pro, and asked for sessions to resume by themselves when a usage limit resets. Claude Code has no setting for this, so a watcher types the resume prompt through tmux.
- `ops/bin/auto-resume.sh` runs in tmux window `sensei:auto-resume`. `~/.local/bin/sensei` (server only, not in the repo) now opens that window whenever it's missing, in a restart loop. The founder approved the launcher change and the new script ("yes, go ahead").
- Rejected:
  - scheduled tasks inside Claude Code: they fire at fixed times, not at the reset;
  - cloud `/schedule`: no server `.env` or Neon, and the same quota;
  - cron `claude --continue`: a second process on the conversation the tmux one holds.
- Tested against a fake Claude pane: a python3 copy named `claude` in a throwaway tmux session.
  - It types once after the reset time, and a second copy refuses to start (flock).
  - It types nothing while busy, nothing over text in the box, and, with a menu up, sends one Escape and types nothing.
  - The parser reads "reset at 5pm (Europe/London)", "resets Dec 2, 9am (America/New_York)" (a time zone conversion), "resets Mon 9am", "resets in 2h 13m" and "resets 11:30pm", and returns unknown for a message with no time.
- Gotcha: Claude's prompt is `❯` plus U+00A0. The script normalises it, or the empty box reads as non-empty.
- The real limit message's wording is unverified: no transcript on this machine holds one. Check `~/.local/state/sensei/auto-resume.log` after the first real limit.
