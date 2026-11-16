# Content review: 22c wave 1 (lessons 1 to 40)

Unit `22c-full-batch`. Written by the Project Manager, 2026-11-15. Reviews the 35 wave 1 drafts that aren't live, in the main checkout's `tools/authoring/output/`, against the 22b promises (`22b-sample-lessons/brief.md` section 4), the review policy in 22b `content-review.md` section 6, and the explanation rules in `check-explanation/brief.md` 3.5.

**What approval means.** The same as in 22b: fit for closed beta. That covers tone, flow, naturalness, whether a beginner can follow it, and whether it keeps the promises. It does **not** mean linguistically verified (hard constraint, OM.1). My own edits and rewrites are AI-written Japanese too, with the same blind spots. Everything here goes to the native-speaker sample (Blocker 6).

**Overall: APPROVE WITH CORRECTIONS.** All 35 drafts can be published after my edits, which are already in the draft files. Three need the Lead first: lessons 38 and 39 wait for the order swap (section 3), and lesson 40 waits for the katakana sounds lesson. The edits fixed four problems that would have hurt a learner:
- Three reading lessons spelled out the answers to their own typed checks.
- Two reading lessons were not reading lessons at all.
- The long-vowel lesson taught a spelling that grading marks wrong (`otoosan`).
- A katakana lesson said ツ's long stroke goes up, which contradicted the lesson before it.

---

# 1. Verdicts

Review depth follows 22b section 6. I reviewed every I-Reading, sound and I-Writing lesson in full. I skimmed the F-Kana and phrase lessons, and still read every Teach block and explanation in them. Critic `example-feel` fails on kana lessons are noise, as `wave1-notes.md` says, and I ignored them.

| # | Id | Type | Verdict | Edits |
|---|---|---|---|---|
| 1 | `the-five-vowels` | F-Kana | APPROVE WITH CORRECTIONS | 2: う described with relaxed lips, not rounded (card hint, q5) |
| 3 | `foundation-ja-ch01-l03` | F-Kana | APPROVE | none |
| 4 | `foundation-ja-ch01-l04` | I-Reading, full | APPROVE WITH CORRECTIONS | 4, see 2.1 |
| 5 | `foundation-ja-ch02-l01` | F-Kana | APPROVE WITH CORRECTIONS | 1: ち hint said "a reversed 'ち'" |
| 6 | `foundation-ja-ch02-l02` | F-Kana | APPROVE WITH CORRECTIONS | 2: intro read "な ni nu ne no"; のき (eaves) → きのこ (mushroom), example and q10 |
| 7 | `foundation-ja-ch02-l03` | F-Kana | APPROVE WITH CORRECTIONS | 4 hand edits, then `--recheck` passed. See 2.6 |
| 8 | `foundation-ja-ch02-l04` | I-Reading, full | APPROVE WITH CORRECTIONS | 2, see 2.1 |
| 9 | `foundation-ja-ch03-l01` | F-Kana | APPROVE WITH CORRECTIONS | 2 hand edits, then `--recheck` passed. See 2.6 |
| 10 | `foundation-ja-ch03-l02` | F-Kana | APPROVE | none |
| 11 | `foundation-ja-ch03-l03` | F-Kana | APPROVE WITH CORRECTIONS | 1: り hint was "like り standing tall" |
| 12 | `foundation-ja-ch03-l04` | F-Kana | APPROVE | none |
| 13 | `foundation-ja-ch03-l05` | I-Reading, full | APPROVE WITH CORRECTIONS | 3, incl. 1 replaced check. See 2.1 |
| 14 | `foundation-ja-ch03-l06` | I-Writing, full | APPROVE WITH CORRECTIONS | 6 hand edits, incl. 4 replaced checks, then `--recheck` passed. See 2.5 |
| 15 | `foundation-ja-ch04-l01` | Sound, full | APPROVE WITH CORRECTIONS | 3, see 2.4 |
| 16 | `foundation-ja-ch04-l02` | Sound, full | APPROVE WITH CORRECTIONS | 8 gloss edits, see 2.4 |
| 17 | `foundation-ja-ch04-l03` | Sound, full | APPROVE WITH CORRECTIONS | 5 readings, see 2.4 |
| 18 | `foundation-ja-ch04-l04` | Sound, full | APPROVE WITH CORRECTIONS | 17 wording edits and 1 added Teach block. Most edited. See 2.4 |
| 22 | `foundation-ja-ch05-l02` | Phrases | APPROVE WITH CORRECTIONS | 2: ごめんなさい vs すみません (Teach, q7) |
| 23 | `foundation-ja-ch05-l03` | Phrases | APPROVE WITH CORRECTIONS | 2: removed "From the corpus" (prompt leak); q10 explanation trimmed to two sentences |
| 24 | `foundation-ja-ch05-l04` | Phrases | APPROVE WITH CORRECTIONS | 6: よろしくおねがいします glossed "please treat me kindly / I look forward to getting to know you", not "please remember me" |
| 25 | `foundation-ja-ch05-l05` | Phrases | APPROVE WITH CORRECTIONS | 3: no "reply はい" to いらっしゃいませ; typed q8 and q10 said "Type in kana" and now say "rōmaji is fine"; q8 asks for tea "using ください", so おちゃ おねがいします isn't marked wrong |
| 27 | `foundation-ja-ch06-l01` | F-Kana | APPROVE WITH CORRECTIONS | 2: "オ/オ" typo; a muddled イ mnemonic |
| 28 | `foundation-ja-ch06-l02` | F-Kana | APPROVE WITH CORRECTIONS | 1: カ lacks か's dash, not a "hook" |
| 29 | `foundation-ja-ch06-l03` | F-Kana | APPROVE WITH CORRECTIONS | 2: ソ hint and the シ/ソ mnemonic described the ticks wrongly |
| 30 | `foundation-ja-ch06-l04` | F-Kana | APPROVE WITH CORRECTIONS | 5. **ツ's long stroke was said to go up**, the opposite of lesson 29's rule. タ is ク plus a stroke, not カ |
| 31 | `foundation-ja-ch06-l05` | F-Kana | APPROVE WITH CORRECTIONS | 2: ナ has no "slash on top" |
| 32 | `foundation-ja-ch06-l06` | I-Reading, full | **REJECT as drafted; PM rewrite APPROVED** | Teach and checks rewritten. See 2.2 |
| 33 | `foundation-ja-ch07-l01` | F-Kana | APPROVE WITH CORRECTIONS | 2: フ curves down to the left; ホ is "a little tree", not "き without the loop" |
| 34 | `foundation-ja-ch07-l02` | F-Kana | APPROVE WITH CORRECTIONS | 3: dropped "'mi' means 'three'" |
| 35 | `foundation-ja-ch07-l03` | F-Kana | APPROVE | none |
| 36 | `foundation-ja-ch07-l04` | F-Kana | APPROVE | none |
| 37 | `foundation-ja-ch07-l05` | F-Kana | APPROVE WITH CORRECTIONS | Hand edits, incl. an **open (AI-graded) check converted to multiple choice**, then `--recheck` passed. See 2.6 |
| 38 | `foundation-ja-ch07-l06` | I-Reading, full | **REJECT as drafted; PM rewrite APPROVED, HELD for the swap** | Rewritten for its place after the sounds lesson. See 2.3 and 3 |
| 39 | `foundation-ja-ch07-l07` | Sound, full | APPROVE WITH CORRECTIONS, **HELD for the swap** | 11 edits and 2 added typed checks. See 2.4 |
| 40 | `foundation-ja-ch07-l08` | F-Vocab | APPROVE WITH CORRECTIONS, **publish after the sounds lesson** | 3: dropped "(Western-style)" from the gloss and answer; q7 explanation cut to two sentences |

**Verified after editing (offline, $0):**
- Every edited draft parses against `LessonDraftSchema`.
- Each check and practice target is declared, and each multiple-choice answer is among its choices.
- Each draft passes `checkCourseRules` with zero errors and zero warnings, except lesson 5. That lesson keeps the existing heuristic warning on とけい (a long vowel before lesson 18), which I accept: "tokei" read kana by kana is still right.
- Lessons 7, 9, 14 and 37 went through `authoring:draft <id> --recheck` (no model call, $0), and each was saved as `<id>.json`.
- Lessons 38 and 39 were checked against a copy of the outline with the swap applied: 0 errors and 0 warnings. With `typedReading` on, the typed-reading transform leaves lesson 39 unchanged. Against today's outline, lesson 38 fails the gate (ー and voiced kana not yet taught), so it can't be published by mistake before the swap.
- No kanji in any learner-facing field.
- No open check is left in wave 1.
- No explanation has praise, "Not quite" or more than two sentences.
- Every new typed answer was checked against `typedAnswersMatch`. `koohii`, `biiru`, `mangoo`, `hanbaagaa`, `okaasan`, `otousan` and `eiga` are accepted. `kouhii`, `otoosan` and `eega` are rejected, which is what the Teach edits now steer learners away from.
- Originals of every draft are kept in the session scratchpad. The pre-edit drafts of lessons 13, 18 and 47 are inside the new corrections entries.

---

# 2. Per lesson

## 2.1 Lessons 4, 8 and 13: reading lessons that gave the answers away

**The common flaw.** Each Teach beat spelled out every passage word in rōmaji: examples `あお / ao` in lesson 4, and "なに is na-ni. はな is ha-na" in lessons 8 and 13. Then the typed checks asked the learner to read exactly those words. That breaks P5 ("type how they sound with no hint") and turns a reading check into a memory test. Lesson 8 also never said what its words mean.

**Fix, the same in all three.** One worked example, then meanings only.
- **Lesson 4.** Kept `あさ / asa / morning` as the worked example, because no typed check asks for あさ. The four other example blocks became one text block: "Now read the rest on your own, one kana at a time: あお (blue), かさ (umbrella), さか (hill), そこ (there) and かお (face)."
- **Lessons 8 and 13.** Their worked words (なに, やま) are also typed checks, so the worked example gives no rōmaji: "なに is な then に, and together they make the word for 'what'." The rest get meanings only.

**Other edits**
- **Lesson 4:**
  - The passage word こけ (moss) was never glossed. It is now かお (face), a word a traveller can use, made of the lesson's own か and お.
  - The look-alike tip said "あ crosses in the middle", but お crosses too. It now says: *お has an extra little stroke at the top right, and あ does not.*
- **Lesson 8:** q3 was multiple choice but worded "Read this word and type how it sounds: なに", and it asked for the same word as q1. It is now *In the word なに, which sound does に make?*
- **Lesson 13:** q4 asked for やま a second time. It now asks the learner to read かわ, the one passage word with no check. Its target moved from ま to わ.

## 2.2 Lesson 32: not a reading lesson

**The draft.** The passage was `カ ス テ ト ニ`. The Teach beat said "Today you meet five new katakana", but all five were taught in lessons 28 to 31. It re-taught them with cards. Its 10 checks were all "which kana says X". There was not one word in a lesson titled "Reading katakana loanwords". The critic was right this time.

**The rewrite.** The passage is real words made only of katakana taught by lesson 31: テニス, テスト, テキスト, アイス, ココア, カツ, ネクタイ.
- テニス is the one worked example, with a line on why "tennis" ends in ス.
- The other words get meanings only.
- One tip on テ vs ト, which テスト puts side by side.
- 10 checks:
  - 4 typed reading checks: テスト, アイス, カツ, テキスト. Answers are stored as kana (F.2.e), and the explanation gives the rōmaji.
  - 3 meaning checks.
  - 3 look-alike checks: テ/ト, ニ, and カ/タ/ク.
- Targets are unchanged.

## 2.3 Lesson 38: invented words, one of them vulgar

**The draft.**
- The passage was ハム, マリ, ラン, ルル, ハワイ, and a second one with マラ, ラム, ルン, ハン.
- Most of these are not words a learner can use, and none was glossed.
- **マラ is vulgar slang in Japanese.** It must never ship.
- It re-taught its five kana with cards, and q7 and q10 were the same check (ルン).

**The rewrite** is written for its place after the swap (section 3), when ー, small kana and voicing are taught.
- The passage is a café menu: ラーメン, ハンバーガー, サラダ, マンゴー, ビール, ジュース.
- ラーメン is the worked example, with how ー is typed (raamen). The other words get meanings only.
- A tip on ラ vs ル.
- 10 checks:
  - 4 typed reading checks: ハンバーガー, マンゴー, サラダ, ビール.
  - 2 menu-meaning checks.
  - 3 look-alike checks: マ/ム/ア, ル/ラ, ン/ソ/シ/ツ.
  - 1 beat count for ラーメン.

## 2.4 Sound lessons 15 to 18 and 39 (on watch since 22b)

**Lesson 15 (が, ざ).**
- The mnemonic said "か goes quiet to が", which contradicts the lesson's own "let your throat buzz". It now says *か buzzes into が*.
- "water (cool or cold)", a dictionary qualifier, became "water" in the example and in q7.

**Lesson 16 (だ, ば, ぱ).**
- "telephone call" → "phone" for でんわ, in the example, q3, q5 and q9.
- "(wooden) pencil" → "pencil".

**Lesson 17 (combinations).** The example readings split a word with spaces (`と しょ か ん`), which the F-Kana correction already forbids, because spaces teach false word boundaries. They now use the dot form lesson 15 uses (`と・しょ・か・ん`).

**Lesson 18 (long vowels): the important one.**
1. **It taught a spelling that grading rejects.** The lesson says おう sounds like a long お and えい like a long え. Its typed checks said "Type the word you see". A learner who types what they hear (`otoosan`, `eega`) is marked wrong, because grading follows the kana (H.2.a: long vowels are typed). Live lesson 20 has the same trap with がっこう.
   - Added one Teach block: *When you type these words, type every kana you see, even the ones you hear as a held sound. The う in おとうさん and the い in えいが are typed too.*
   - The five typed prompts are now "Type this word in rōmaji: <word>", the wording lessons 15 and 16 use.
   - The five typed explanations now say why the word is spelled that way, for example *In rōmaji, おとうさん is otousan: type the う you see, though you hear a long お.* Before, they only repeated the clapping.
2. **"Hold the あ for two beats" can be read as three beats** (か, then あ held for two). The three Teach lines and three explanations now use the wording approved for lesson 20: *the あ after か makes か last two beats*.

**Lesson 39 (katakana sounds).**
- The ー card said "コー sounds like こう". Under H.2.d, `kouhii` is marked wrong and `koohii` is right, so the hint pushed learners into a miss. It now says *like the held vowels in おかあさん*.
- The シャツ example's reading was `shat-tsu`, which puts in a pause シャツ doesn't have. It is now `シャ・ツ — シャ is one beat, then ツ`.
- "shirt (undergarment)" became "shirt", in the example and in q7.
- q5's explanation said ポ "comes from ハ's partner line". It now says *ポ is ホ with a small circle*.
- The three typed checks stored rōmaji answers. They now store kana (F.2.e) and use the course's reading prompt.
- **Added q11 (コーヒー) and q12 (シャツ)**, so every word has a typed reading check, as in lessons 15 to 19. That lets the outline turn on `typedReading` for this lesson (section 3), which clears a PM backlog item.

**Ruling: no strike for sound lessons.** No Teach beat was rewritten and no check was replaced.
- Lesson 18's typing gap traces to my 22a author note, which said nothing about typing, as lesson 19's っ gap did in 22b.
- Lesson 39's こう hint matched how grading worked when it was drafted (H.2.d came the next day).
- The rest are wording.

All sound lessons are now drafted, so the watch ends.

## 2.5 Lesson 14, Writing full hiragana (I-Writing, rejected twice)

- **The gate's catch, と.** The passage `あさ、さかな と はな。 また あかい はな。` also used また and あかい, words that are never taught. It is now a list of known words: `あさ。 さかな。 はな。 かさ。 さくら。`
- **Four checks tested nothing.** "Type the kana that reads 'ka'" is answered by typing `ka`, which the grader turns into か. Each is now multiple choice and asks which kana spell a word: *Which of these spells 'kasa' (umbrella)?* かさ | たさ | はさ | まさ. Choosing the kana for each sound is the decision writing needs, and a phone can test it.
- **The intro** now says to copy each kana with pen and paper. The card hints are stroke guidance, and the app can't check handwriting (out of MVP scope), so this makes the "writing" real.

## 2.6 Lessons 7, 9 and 37 (rejected twice)

**Lesson 7, H row.**
- The lone へ in `はな ふね ほし へ ひと` was read as a particle. Inside a list it was really a gate false positive, but it was also not a word. It is now へそ (belly button), a real word made of taught kana, with an example block.
  - The Lead's suggested へや uses や, which is lesson 10, so the gate would reject it.
- The intro read "は hi fu he ho".
- The は hint said "け with an extra vertical line on the left". It is now *Like け, but the stroke on the right ends in a little loop.*

**Lesson 9, M row.**
- `まち の みせ` became `まち。 みせ。`
- The ま hint said "Like は but with an extra loop", but は already has the loop. It now says *Like ほ without the line on the left*.

**Lesson 37, katakana W, ヲ, ン.**
- ペン and パン (p-sounds, lesson 39) became メロン and レモン, which are plain katakana. The passage repeated ワイン three times and is now ワイン メロン レモン.
- **q4 was an open check** ("What is the difference between ワ and ヲ?", AI-graded). Under `check-explanation` brief section 5, no lesson with an open check is published until the follow-up unit lands. It is now multiple choice: *What sound does ヲ make?*
- **The ワ/ヲ tell was wrong.** The draft said ヲ is "ワ with an extra stroke on top". ヲ is フ with a line across the middle, and ワ has a short line down on the left. The hints, the mnemonic and the explanations now say that.
- **The ン/ソ tell was reworded** to match lessons 29 and 30: ン sweeps up like シ, ソ comes down like ツ.

---

# 3. Lessons 38 and 39 swap order

**Decided, logged as `decisions.md` F.1.c.**
- After the swap, the katakana sounds lesson is 38 (`foundation-ja-ch07-l06`) and the café-menu reading lesson is 39 (`foundation-ja-ch07-l07`).
- Real katakana a traveller meets is mostly words with ー, voicing and small kana. After the sounds, the reading lesson can be a real menu that practises those marks, as lesson 20 does for hiragana.
- The wave 1 reading draft was unusable in either order, so nothing good is thrown away.
- I don't accept the wave 1 note's claim that plain katakana "rules out most real katakana words". ハム, メロン, ワイン and マラソン all work. The swap wins on what the lesson teaches, not on necessity.

**Steps for the Lead** ($0; I haven't touched the outline):

1. In a worktree branch, edit `apps/api/data/curriculum/foundation-ja-beta.json`:
   - In chapter `foundation-ja-ch07`, move the lesson titled "Katakana sounds: ー, ッ, ャ and voiced marks" above "Reading katakana loanwords II".
   - Set the sounds lesson's `id` to `foundation-ja-ch07-l06`, and the reading lesson's `id` to `foundation-ja-ch07-l07`.
   - Add `"typedReading": true` to the sounds lesson.
   - In `soundStages`, change the "katakana ー, ッ, ャ and voiced marks" stage's `lessonId` from `foundation-ja-ch07-l07` to `foundation-ja-ch07-l06`.
   - Optional: `apps/api/src/testing/typed-answers.ts` lines 328 to 370 cite `ch07-l06` and `ch07-l07` checks that no longer exist (`mara`, `run`, and the rōmaji-stored `nooto`). It's test data only, so relabel it or leave it.
   - Run `pnpm typecheck && pnpm lint && pnpm test`, then open a PR. The gate it needs is your call: it's a data-only change.
2. After merge, from the main checkout:
   - Back up `tools/authoring/output/skeleton.json` to the scratchpad.
   - Run `pnpm --filter api authoring:outline --force`.
   - Diff the old and new skeletons. Only the two ch07 lesson entries (order, ids, `typedReading`) and that one sound stage's `lessonId` may differ. If anything else changed, restore the backup and stop.
3. Rename the drafts without overwriting one with the other, then fix `lessonId` inside each. Run from `tools/authoring/output`:
   ```bash
   for s in .json .critique.json; do
     mv foundation-ja-ch07-l06$s tmp-reading$s
     mv foundation-ja-ch07-l07$s foundation-ja-ch07-l06$s
     mv tmp-reading$s foundation-ja-ch07-l07$s
   done
   node -e 'const fs=require("fs");for(const id of ["foundation-ja-ch07-l06","foundation-ja-ch07-l07"])for(const s of [".json",".critique.json"]){const p=id+s;const d=JSON.parse(fs.readFileSync(p,"utf8"));d.lessonId=id;fs.writeFileSync(p,JSON.stringify(d,null,2))}'
   ```
   Both critiques describe the pre-edit drafts and are stale. Nothing downstream reads them.
4. Check, optional. `authoring:publish` re-runs the gate and refuses a draft that breaks it. For an earlier check at $0, copy a draft to `<id>.rejected.json` and run `pnpm --filter api authoring:draft <id> --recheck`. I ran the same gate against a swapped copy of the outline: 0 errors.
5. Approve and publish 38, 39 and 40, in that order. Lesson 40 (テレビ, ラジオ) needs the voiced katakana that the sounds lesson teaches.

---

# 4. I-Reading: second strike, no-go until the gate catches a give-away

- **The strike.**
  - Lessons 32 and 38 needed new Teach beats and new checks, which fails 22b's 3.4 bar ("small edits only").
  - Lessons 4, 8 and 13 all gave away their typed answers in Teach.
  - With lesson 20 in 22b, this is the second strike. Under 22b section 4, I-Reading is **no-go**.
- **What no-go means.**
  - No further I-Reading lesson is drafted until the gate rejects a Teach beat that spells in rōmaji a word that one of that lesson's typed checks asks for (Tech Lead, section 6 item 1).
  - The rule matches every lesson I approved here. Lesson 4's worked あさ and lesson 32's テニス aren't typed, and lesson 38's worked ラーメン isn't either. Live lesson 20 has no rōmaji in Teach.
  - This costs nothing now. The two I-Reading lessons in wave 2 (55, 77) crashed and are already waiting for `authoring-hardening`, so the rule can go in that unit. The other three (83, 95, 113) are in wave 3.
- **Already in place.** A corrections note for I-Reading (section 5) is in the drafter prompt from 2026-11-15 16:11 UTC.
- **Why not rely on the note alone.** 22b showed that notes steer but don't bind. Lesson 20 ignored "only the grammar listed". The give-away rule is mechanical, so the gate should own it.

The other types: F-Kana and phrase lessons stay **go**. The sound watch ends (2.4). I-Writing has one more lesson (120), whose open check is by design and waits for the follow-up unit.

---

# 5. Corrections log entries added

Three lines appended to `tools/authoring/corrections.jsonl`, each with the pre-edit draft as `original_draft`:

| Type | Original | Note, in short | Why a later wave would repeat it |
|---|---|---|---|
| I-Reading | lesson 13 | No rōmaji for passage words in Teach except one worked example. Example blocks only for that word. Every word gets a meaning. Don't re-teach kana targets. A multiple-choice check never says "type". No two checks ask for the same word | 5 I-Reading lessons left (55, 77, 83, 95, 113) |
| F-Vocab | lesson 18 | Learner glosses, not dictionary qualifiers. Typed answers are graded kana by kana (otousan, eiga, koohii), so never describe a held sound as another spelling, and say once that every kana is typed. Never "in kana" in a typed prompt. Make the expected answer the only natural one. No prompt words like "from the corpus" | Most later lessons are F-Vocab. Wave 2 already shows the gloss pattern |
| F-Grammar | lesson 47 (wave 2) | No open checks unless the author note asks. Translation checks are closed and name the words to use | Wave 2 lessons 47 and 75 both have one, as wave 1 lesson 37 did. Wave 3 has more F-Grammar |

There's no F-Kana entry, because every F-Kana lesson is in wave 1.

---

# 6. For the Tech Lead (findings, not instructions)

1. **I-Reading give-away gate (blocks I-Reading drafting, section 4).** In an I-Reading lesson, a Teach block that contains, as a whole word, the rōmaji of any typed check's answer is an error. Fold it as F.2.e folds rōmaji. This is the deterministic half of the new I-Reading note.
2. **Open checks appear where no author note asks for one:** 3 so far, in lessons 37, 47 and 75, across F-Kana and F-Grammar. A gate error, "open check only when the outline's author note asks for one", would hold them at $0 until the follow-up unit lands. Until then PM review is the backstop, and I've added a note for F-Grammar.
3. **Self-answering typed checks.** "Type the kana that reads 'ka'" (lesson 14) passes every gate rule, because F.2.e skips single sounds. Suggested rule: a closed typed check whose prompt contains the rōmaji of its own answer is an error.
4. **Practice templates in `production` mode for kana** (lesson 14: "Write the kana for 'a'"). If the practice beat renders these as typed questions, they answer themselves the same way. Please check how they're rendered.
5. **Rōmaji-stored typed answers** remain in lessons 4, 8 and 13 (`ao`, `nani` and so on). They grade and display correctly (B.2.b's resolver, Tester-verified), so I left them. Lessons 13, 32, 38 and 39 now store kana where I touched them.

---

# 7. What I could not verify

- **Linguistic correctness of anything**, including every edit and both rewrites.
- **Screen fit** of the rewritten Teach beats at 375pt. That's for the Alpha.
- **Whether the café-menu framing lands** with the persona. That's for the Alpha and triage.

## 7.1 For the native-speaker sample (Blocker 6), adding to 22b's 6.1

1. **Kana shape and stroke descriptions.** I'm confident of the stroke directions, but a teacher should confirm the wording:
   - シ, ツ, ソ, ン in lessons 29, 30 and 37.
   - ワ vs ヲ in lesson 37.
   - ま vs ほ in lesson 9, and は vs け in lesson 7.
   - ナ, フ and ホ in lessons 31 and 33.
2. **Lesson 1:** う "with relaxed lips, not pushed forward".
3. **Lesson 18:** "えい usually sounds like a long え", and the clap-per-beat description.
4. **Lesson 22:** ごめんなさい "said mostly to people you know; with a stranger すみません is the usual choice".
5. **Lesson 24:** よろしくおねがいします as "please treat me kindly / I look forward to getting to know you".
6. **Lesson 25:** is `おちゃ ください`, with no を, natural as spoken?
7. **Lessons 32 and 38, my own word lists and glosses:**
   - アイス as "ice cream".
   - カツ as "a breaded, fried cutlet".
   - "Most Japanese sounds end in a vowel, so the 's' at the end of 'tennis' becomes ス".
   - The beat count for ラーメン.

---

# 8. For publishing

**Approved for publishing now** (in course order, after `EDITOR=true pnpm --filter api authoring:review <id>`):

- `the-five-vowels` (lesson 1, replaces the seed in place, F.1.b)
- `foundation-ja-ch01-l03`
- `foundation-ja-ch01-l04`
- `foundation-ja-ch02-l01`
- `foundation-ja-ch02-l02`
- `foundation-ja-ch02-l03`
- `foundation-ja-ch02-l04`
- `foundation-ja-ch03-l01`
- `foundation-ja-ch03-l02`
- `foundation-ja-ch03-l03`
- `foundation-ja-ch03-l04`
- `foundation-ja-ch03-l05`
- `foundation-ja-ch03-l06`
- `foundation-ja-ch04-l01`
- `foundation-ja-ch04-l02`
- `foundation-ja-ch04-l03`
- `foundation-ja-ch04-l04`
- `foundation-ja-ch05-l02`
- `foundation-ja-ch05-l03`
- `foundation-ja-ch05-l04`
- `foundation-ja-ch05-l05`
- `foundation-ja-ch06-l01`
- `foundation-ja-ch06-l02`
- `foundation-ja-ch06-l03`
- `foundation-ja-ch06-l04`
- `foundation-ja-ch06-l05`
- `foundation-ja-ch06-l06`
- `foundation-ja-ch07-l01`
- `foundation-ja-ch07-l02`
- `foundation-ja-ch07-l03`
- `foundation-ja-ch07-l04`
- `foundation-ja-ch07-l05`

**Approved, held back until the swap in section 3 is done:**

- `foundation-ja-ch07-l06`: today's file is the reading lesson, written for position 39, and it fails the gate where it stands. After the rename it is the katakana sounds lesson.
- `foundation-ja-ch07-l07`: today's file is the katakana sounds lesson. After the rename it is the reading lesson.
- `foundation-ja-ch07-l08` (lesson 40): needs the voiced katakana the sounds lesson teaches, so publish it after that one.

**Not in this review:** lesson 26 (`foundation-ja-ch05-l06`, I-Speaking), which is audio-blocked (Blocker 2) and not drafted.
