# Content review: 22c wave 2 (lessons 41 to 77)

Unit `22c-full-batch`. Written by the Project Manager, 2026-11-16. Reviews the 30 non-audio drafts of wave 2 in the main checkout's `tools/authoring/output/`. The yardsticks are:
- the 22b promises (`22b-sample-lessons/brief.md` section 4);
- the review policy in 22b `content-review.md` section 6;
- the explanation rules in `check-explanation/brief.md` 3.5;
- the decisions through F.2.i.

Lesson 43 is live from 22b and isn't reviewed here. The six audio lessons (48, 50, 56, 63, 64, 71) aren't drafted (Blocker 2).

**What approval means.** As in wave 1, it means fit for closed beta: tone, flow, naturalness, whether a beginner can follow it, and whether it keeps the promises. It does **not** mean linguistically verified (hard constraint, OM.1). My edits are AI-written Japanese too, with the same blind spots. Everything here goes to the native-speaker sample (Blocker 6).

**Overall: APPROVE WITH CORRECTIONS. All 30 can be published, none held and none left rejected.** The edits are already in the draft files. Each draft passed `authoring:draft --recheck`, with no model call and $0. No paid call was made and nothing was redrafted with `--force`.

The edits fixed five problems that would have hurt a learner:
- **Lesson 70 taught wrong ages.** It gave いちさい and じゅうさい for 1 and 10 years old. They are いっさい and じゅっさい.
- **Lesson 67 taught `まん えん` for 10,000 yen.** 万 always takes a number in front: いちまん.
- **Kanji with no reading.** Lesson 54 taught 子, 女 and 男 by meaning only. Reviews ask "Type a reading for 「男」", so the learner would be tested on a reading nobody taught.
- **Both reading lessons answered their own checks in Teach.** Lesson 55 translated the passage lines that its checks ask about. Lesson 77 did the same and spelled out `hon`.
- **False claims of prior knowledge.** Eight drafts told learners they "already know" this lesson's new words, for example "You already know にほん and アメリカ" in the lesson that introduces them.

---

# 1. Verdicts

Depth followed the brief:
- I read every F-Grammar, F-Kanji and I-Reading lesson in full: 44, 46, 47, 53, 74 and 75; 49, 54, 62, 68, 69 and 76; 55 and 77.
- I read the F-Vocab lessons too, every Teach block and every explanation, since they were short.
- I treated critic `example-feel` fails on vocabulary and kanji lessons as noise. Sentences there would need grammar or kanji not taught yet.

"Edits" counts changed Teach blocks, practice hints and checks, measured against the originals.

| # | Id | Type | Verdict | Edits |
|---|---|---|---|---|
| 41 | `foundation-ja-ch08-l01` | F-Vocab | APPROVE WITH CORRECTIONS | 2 Teach. The example `あなたですか` ("Is it you?") used です and か before they're taught, so it is now `たなかさん`, placed after the さん text. "You've actually seen it already inside みなさん" came before みなさん was introduced |
| 42 | `foundation-ja-ch08-l02` | F-Vocab | APPROVE WITH CORRECTIONS | 3 Teach, 2 explanations. "You already know all three" was false. "Two tricky long parts" in がくせい was wrong: it has one. The long-vowel wording now matches lesson 18: the い makes せ last two beats, and you type it |
| 44 | `foundation-ja-ch08-l04` | F-Grammar, full | APPROVE WITH CORRECTIONS | 1 Teach, 1 prompt. "You don't need a rising question mark" mixed up intonation and punctuation. The prompt dropped a redundant "Use がくせい" |
| 45 | `foundation-ja-ch08-l05` | F-Vocab | APPROVE WITH CORRECTIONS | 1 Teach, 1 prompt. "You already know にほん and アメリカ" was said in the lesson that teaches them. q9 asked "which word" when the choices were sentences |
| 46 | `foundation-ja-ch08-l06` | F-Grammar, full | APPROVE WITH CORRECTIONS | 3 Teach, 2 checks. See 2.1 |
| 47 | `foundation-ja-ch08-l07` | F-Grammar, full | APPROVE WITH CORRECTIONS | 3 Teach, 2 checks, including **the open check q4, now closed**. See 2.1 |
| 49 | `foundation-ja-ch08-l09` | F-Kanji, full | APPROVE WITH CORRECTIONS | 3 Teach, 1 hint, 1 explanation. 小 was described as "a small center line with two dashes", but its centre is the long stroke. "You already say these words in kana" was false for 大 and 小 |
| 51 | `foundation-ja-ch09-l01` | F-Vocab | APPROVE WITH CORRECTIONS | 1 Teach. Says once that the う in おとうと and いもうと is typed (F-Vocab correction note) |
| 52 | `foundation-ja-ch09-l02` | F-Vocab | APPROVE WITH CORRECTIONS | 3 Teach, 2 prompts. The だいがく mnemonic ("だい sounds like 'die'… a daily place you grow at") now points to 大 (big) from lesson 49, in words, because kanji can't appear in a vocabulary lesson. "It's a university teacher" became "(She is) a university teacher". Two prompts said "in kana" |
| 53 | `foundation-ja-ch09-l03` | F-Grammar, full | APPROVE WITH CORRECTIONS | 1 Teach. The closing note on when to use も was garbled |
| 54 | `foundation-ja-ch09-l04` | F-Kanji, full | **REJECT as drafted; PM rewrite APPROVED** | Rejected by the gate (田, 力). Teach and all 10 checks rebuilt. See 2.2 |
| 55 | `foundation-ja-ch09-l05` | I-Reading, full | APPROVE WITH CORRECTIONS | Rejected by the gate (`chichi` in Teach). 3 Teach rewritten, 1 removed, 1 explanation. See 2.3 |
| 57 | `foundation-ja-ch10-l01` | F-Vocab | APPROVE | none |
| 58 | `foundation-ja-ch10-l02` | F-Vocab | APPROVE WITH CORRECTIONS | `わたしの` spaced to `わたし の`. Two phrase prompts now say "Rōmaji is fine" |
| 59 | `foundation-ja-ch10-l03` | F-Vocab | APPROVE | none |
| 60 | `foundation-ja-ch10-l04` | F-Vocab | APPROVE WITH CORRECTIONS | 3 Teach. Links なん to なに, which lesson 8 taught as "what". Glosses かた, which the どなた example uses untaught. The mnemonic "Three of these begin the question word in a handy way" was nonsense and is replaced |
| 61 | `foundation-ja-ch10-l05` | F-Vocab | APPROVE WITH CORRECTIONS | 6 Teach, 3 checks. "You already met these in your earlier lists" was false. "どう hiding inside どうぞ and どうも" was misleading. The mnemonic had a typo ("moneR"). `いくつ です か` is now "How many?", not "How many are there?". Readings are spaced consistently. Two prompts said "in kana". The どう explanation now says to type the う |
| 62 | `foundation-ja-ch10-l06` | F-Kanji, full | APPROVE WITH CORRECTIONS | 6 Teach, 1 check. See 2.2 |
| 65 | `foundation-ja-ch11-l01` | F-Vocab | APPROVE WITH CORRECTIONS | 3 Teach. Adds that four is more often よん. "You already met these in a question" was false. The ごはん mnemonic is fixed |
| 66 | `foundation-ja-ch11-l02` | F-Vocab | APPROVE WITH CORRECTIONS | 2 Teach, 2 explanations. Adds that seven is also なな. "Hold it for the full ten beats" contradicted the course's two-beat rule. The explanations for きゅう and じゅう say the う is typed (`kyu` is marked wrong) |
| 67 | `foundation-ja-ch11-l03` | F-Vocab | APPROVE WITH CORRECTIONS | 3 Teach, 1 check. **`まん えん` → `いちまん えん`**, with a line saying まん always takes a number. The mnemonic said まん is "the shortest to say", which is untrue. **q8 is now multiple choice.** As typed, "Type the Japanese for zero" was answered by typing the English word `zero` (PM backlog item, now closed) |
| 68 | `foundation-ja-ch11-l04` | F-Kanji, full | APPROVE WITH CORRECTIONS | 2 Teach, 1 hint, 2 prompts. Adds that 四 is also read よん. `五 ひゃく えん` → `五ひゃく えん`. Two prompts said "in kana" |
| 69 | `foundation-ja-ch11-l05` | F-Kanji, full | APPROVE WITH CORRECTIONS | 1 Teach, 1 check. Adds that 七 is also read なな. q10 said "in kana", and its explanation now says the う is typed |
| 70 | `foundation-ja-ch11-l06` | F-Vocab | APPROVE WITH CORRECTIONS | 4 Teach, 1 explanation. **The age readings were wrong.** See 2.4 |
| 72 | `foundation-ja-ch12-l01` | F-Vocab | APPROVE WITH CORRECTIONS | 1 Teach, 4 prompts. めがね "has two round め shapes" became "め is also the word for 'eye', and めがね starts with it". Four prompts said "in kana" |
| 73 | `foundation-ja-ch12-l02` | F-Vocab | APPROVE WITH CORRECTIONS | 1 Teach, 2 checks. **"とけい sounds like と・け・え" taught `tokee`, which grading rejects.** It now says the い makes け last two beats and is typed. Two prompts said "in kana" |
| 74 | `foundation-ja-ch12-l03` | F-Grammar, full | APPROVE WITH CORRECTIONS | 1 prompt. "There is a watch" → "a clock", to match lesson 73's gloss of とけい |
| 75 | `foundation-ja-ch12-l04` | F-Grammar, full | APPROVE WITH CORRECTIONS | 1 Teach, 1 check: **the open check q4, now closed**. See 2.1 |
| 76 | `foundation-ja-ch12-l05` | F-Kanji, full | APPROVE WITH CORRECTIONS | Rejected by the gate (木). 5 Teach, 1 hint, 5 checks. See 2.2 |
| 77 | `foundation-ja-ch12-l06` | I-Reading, full | APPROVE WITH CORRECTIONS | Rejected by the gate (`hon` in Teach). 1 Teach removed, 1 rewritten. See 2.3 |

**Critic noise, confirmed** (wave2-notes items 2 and 3):
- **`item-ref-match` on 41, 60, 72 and 73 is noise.** Item ids are canonical keys, and vocabulary shows in kana (G.4.c). On 60 the critic also claimed どなた isn't a target, and it is. On 51 it said おとうと and いもうと aren't targets, and they are.
- **Lesson 46's "my friend's" vs "a friend's" was half right.** "My friend's bag" is the natural English. The real risk was that learners would think の means "my". Teach now says "Japanese often leaves out 'my' when it is clear who you mean."

---

# 2. Per lesson

## 2.1 F-Grammar: 46, 47 and 75

**Lesson 46 (の).**
- Two sentences relied on untaught words, so they could only be guessed:
  - The example used くるま (car), which is never taught.
  - q3 asked what `せんせい の くるま` means, with "the car's teacher" as a distractor.
- Both now use taught words: `にほん の カメラ` (a Japanese camera), and `せんせい の かばん` (the teacher's bag).
- `にほん の せんせい`, glossed "a Japanese teacher", was ambiguous: it reads as "teacher of Japanese". It is cut, and `がっこう の ともだち` (a school friend) stays.
- q4's explanation called a friend "the thing". That wording is gone.

**Lesson 47 (じゃありません).**
- **q4 open → closed.** The prompt is now *Type the Japanese for "I am not a student." Use わたし and がくせい. Rōmaji is fine.* The answer is stored in kana. `grading` and `rubric` are removed, so F.2.i's gate passes it.
- `これ は みず じゃありません` used これ, which lesson 57 teaches. It is now `ともだち は いしゃ じゃありません`. q3 is now `かぎ ___。`, with no これ.
- The mnemonic said じゃ is "a little 'no way, nope' sound", which isn't true. It now says: keep the sentence and put じゃありません where です was.
- `あなた は がくせい じゃありません か` ("Aren't you a student?") was cut. It added negative questions, whose はい and いいえ answers work the opposite way to English and confuse beginners. It is now `アメリカじん じゃありません` (not American).

**Lesson 75 (がいます).**
- **q4 open → closed.** The prompt is now *Type the Japanese for "There is an older brother." Use あに. Rōmaji is fine.*
- The mnemonic "both have an い feel to them" was empty. It now says people and animals could get up and walk away.

**Lessons 44, 53 and 74** needed one small edit each (section 1).

**Typed answers checked against the grader** (`typedAnswersMatch`):
- Accepted: `watashi wa gakusei ja arimasen` (also with `ha`, and with no spaces), `ani ga imasu`, `tokei ga arimasu`, `gakusei desu ka`, `watashi no tomodachi` and `ani mo isha desu`.

## 2.2 F-Kanji: 49, 54, 62, 68, 69 and 76 (first kanji run)

**What I checked in every kanji lesson:**
- Every target kanji has a reading taught in kana and asked in a check, because reviews ask for one (F.2.j, point 4).
- Stroke descriptions match the character.
- Untaught component kanji appear nowhere.

After the edits, all six lessons pass the first and third checks. I checked the readings against KANJIDIC2 (`apps/api/data/sources/kanjidic2-en-3.6.2.json`):

| Kanji | Reading taught |
|---|---|
| 人, 大, 小 | ひと, だい, しょう |
| 子, 女, 男, 父, 母 | こ, おんな, おとこ, ちち, はは |
| 何, 名, 今 | なん, な, いま |
| 一 to 五 | いち, に, さん, し, ご |
| 六 to 十 | ろく, しち, はち, きゅう, じゅう |
| 本, 学, 校, 生 | ほん, がく, こう, せい |

**Lesson 54 (母 父 子 女 男): rebuilt.**
- **The gate's catch:** 男 was explained as 田 over 力. It is now *The top is a rice field: a box split into four. The bottom looks like the katakana カ, and here it means strength.* カ is taught, and 力 really does look like it.
- **Three kanji had no reading.** 子, 女 and 男 each now have an example block with their reading: こ ("the こ at the start of こども"), おんな and おとこ.
- **The checks.** There were 10 meaning checks. One of them, q6, tested 力, which isn't taught, and another used "field" as a distractor. They are now five meaning checks and five reading checks. q6 is typed: *How do you read 男 (man)? Rōmaji is fine.*
- **Stroke and gloss fixes:**
  - 父's "two crossing strokes at the top" is wrong: the X is at the bottom. It now says *two short strokes on top of a big X*.
  - 男 is "man", not "male".
- The two example sentences now show the kanji, `父 は いしゃ です。` with the reading `ちち は いしゃ です。`, so the reading line finally does some work.
- This is a rewrite, so the verdict is REJECT as drafted.

**Lesson 62 (何 名 今).**
- `名 は これ です` ("The name is this") isn't natural Japanese, and 名 on its own isn't the word for "name". It became a text block: *In なまえ, the な is written 名. The rest of なまえ uses a kanji you haven't learned yet.*
- `今 です` ("It's now") became the bare `今 / いま / now`.
- **The mnemonics:**
  - 何 "has a person 人 on the left". The left part is the thin side form of 人, and Teach now says so.
  - 名's "party in the evening" now gives the real picture, in words: *the top is the shape for evening, the bottom is a mouth: in the dark nobody can see you, so you call out your name.*
- Teach adds that 何 is also なに.
- q6's prompt said "in kana", and its answer is now `いま`.
- "You already say these words in kana" was false for いま.

**Lesson 76 (本 学 校 生).**
- **The gate's catch:** 木 appeared twice. Now:
  - *The left side of 校 is the shape for tree or wood.*
  - *本 is the shape for a tree with one extra short line low on the trunk.*
- 学's mnemonic now names 子, which lesson 54 teaches.
- 校 had no reading. Teach now says *In 学校, 校 is read こう*, and q8 asks which kanji is read こう.
- q6's explanation was garbled (`がakusei`).
- 校's meaning is "school", not "school building".
- **Data finding:** the 校 item's stored meaning is "exam", KANJIDIC2's first sense, so the recap card would say "exam". See section 6.

**Lessons 49, 68 and 69** needed small edits (section 1). Lesson 69 shows its kanji on kana cards with rōmaji (`六 roku`). That renders fine, and I left it.

## 2.3 I-Reading: 55 and 77

**The pattern.** The gate now catches rōmaji give-aways (F.2.g), and both lessons were rejected for that. Underneath, they repeated wave 1's flaw in another form: **Teach translated the passage lines that the checks ask about.**
- **Lesson 55:**
  - T3 translated `ちち は いしゃ です`, which q3 asks.
  - T4 translated `はは も いしゃ です`, which q5 and q7 ask.
  - T1 said "a short note about someone's family", which q1 asks.
- **Lesson 77:**
  - T4 translated `つくえ が あります` and `いす も あります`, which are q1 and q2.
  - T3 translated and spelled out `ほん が あります (hon ga arimasu)`, which q3 and q4 ask.

**The fix, the same in both.** The grammar is explained with a sentence that isn't in the passage, and every passage word keeps its meaning.
- Lesson 55 uses `わたし は がくせい です` and `わたし も がくせい です`.
- Lesson 77 uses `みず が あります`, and adds that も can take the place of が.
- The give-away example blocks are removed.
- In lesson 55, T1 no longer says what the note is about, and "は is held" (it isn't held) is gone from both places it appeared.

**No strike.** These were removals and rewordings, with no new checks, below 22b's rewrite bar. And every I-Reading lesson is now drafted, so a no-go would stop nothing. The pattern goes into the corrections log (section 5) for the wave 3 redrafts (83, 95).

## 2.4 Lesson 70: wrong age readings

- **The draft said:** "いちさい means 'one year old', じゅうさい means 'ten years old'", and its first example was `じゅうさい です`.
- **Both are wrong.** A number's sound changes before さい: 1 is いっさい and 10 is じゅっさい.
- **Why it matters.** This is the lesson an adult uses to state their age (lesson 71 is "Stating your age"). Ages ending in 1, 8 or 0 change, so about a third of adult ages would be said wrong.
- **The fix.** The examples use ages that don't change (ごさい, にじゅうごさい), and one sentence lists the changes: *1 is いっさい, 8 is はっさい, 10 is じゅっさい, and 20 has its own word, はたち.*
- **For whoever drafts lesson 71** (audio, not drafted): the speaking prompts must cover these.

---

# 3. Ruling on the kanji-components pattern (wave3-notes pattern 2)

**Decided and logged as `decisions.md` F.2.j.**
- No exemption. An untaught kanji can't appear even as a part of a target kanji.
- A part that is itself a taught kanji may be named (子 in 学, 人 in 何). Any other part is described in words, or by a taught kana it resembles.
- New rule from this review: **every target kanji gets a reading in kana in Teach, and a check on it**, because reviews ask for a reading.

**Why not allow components.**
- Words did the job in 54 and 76 with nothing lost.
- A component shown as a kanji is a character the learner meets once and never reviews.
- Folk etymology is the drafter's least checkable output.
- A whitelist would need KRADFILE (a new dataset and licence check) for five lessons.

**For wave 3.** Lessons 94 (目, 耳, 門) and 104 (門) get the same hand edit in the wave 3 review. No gate change is needed.

---

# 4. Lesson types after wave 2

- **F-Grammar (first run): go.** Six lessons, small to moderate edits, no rewrites. Read every wave 3 F-Grammar lesson in full. The failure here was untaught *words* (これ, くるま), which no gate catches, and the wave 3 critic is flagging untaught particles and verbs (88, 91, 97).
- **F-Kanji (first run): on watch.** One rewrite (54) and one heavy edit (76). In wave 3, check readings, components and stroke descriptions in 82, 93, 94 and 104. A second rewrite would be the second strike. Since every kanji lesson is already drafted, a no-go would only mean fixing them by hand.
- **I-Reading: no change.** See 2.3.
- **F-Vocab: go.** The recurring defects were mechanical: "in kana" prompts, false "already know" claims, and held vowels. Two were real correctness errors (67, 70), both in number lessons.

---

# 5. Corrections log entries added

Four lines appended to `tools/authoring/corrections.jsonl`, each with its pre-edit draft as `original_draft`:

| Type | Original | Note, in short | Who it steers |
|---|---|---|---|
| F-Kanji | lesson 54 | Name a part as a kanji only if it's taught, otherwise describe it in words. Give every kanji a reading in kana, and check it. Describe strokes as they are. Claim only known words. "Rōmaji is fine", never "in kana" | Any redraft of 94 or 104, and later kanji |
| F-Vocab | lesson 70 | Sound changes with counters (いっさい, はっさい, じゅっさい, はたち, いちまん). Mention よん and なな. Never say this lesson's words are already known. Mnemonics must be true. A held sound is never another spelling (とけい ≠ と・け・え) | Lesson 86 if it is `--force` redrafted. The audio-wave vocabulary |
| I-Reading | lesson 77 | Teach must not answer the checks: don't translate a passage line a check asks about. Explain grammar with a sentence that isn't in the passage | Redrafts of 83 and 95 |
| F-Grammar | lesson 47 | Every word must be taught already (これ, くるま). One point per lesson (no negative question). True mnemonics. Closed translation checks | Lesson 87 if it is `--force` redrafted. Later F-Grammar |

The F-Vocab and F-Grammar notes repeat a rule that is already in the prompt ("uses only the … words listed above"). The drafter still broke it, partly because of finding 6.1.

---

# 6. For the Tech Lead (findings, not instructions)

1. **The prompt lists this lesson's own words as already known.**
   - `courseContextBlock` prints "WORDS THE LEARNER KNOWS" from `ctx.words`, which includes this lesson's targets. The kanji list is built the same way.
   - So 8 of 30 drafts told learners they "already know" or "already met" the new words: 41, 42, 45, 49, 54, 61, 62 and 65.
   - Fix: list "known before this lesson" and "new in this lesson" separately. It's prompt-only, and matters for redrafts and the audio wave.
2. **The 校 item's stored meaning is "exam"** (KANJIDIC2's first sense: "exam; school; printing; proof").
   - The recap card (`recapBackFor`) would show "exam" for a kanji that lesson 76 teaches as "school".
   - Please check every beta kanji's primary meaning. In wave 2 only 校 is wrong; 男's is "male", which is fine.
   - Changing a live row is your call on reversibility.
3. **A gate rule for kanji readings (F.2.j point 4).** In an F-Kanji lesson, each target kanji must appear in Teach next to one of its KANJIDIC2 readings in kana. It's mechanical, and would have caught lesson 54.
4. **"in kana" in typed prompts.** 15 checks across 8 drafts said "in kana" or "(katakana)", despite the F-Vocab correction note. A gate error on that phrase in a typed check's prompt is a one-line regex.
5. **Untaught words aren't caught.** これ in 47, くるま in 46 and かた in 60 all passed. A *warning* for kana tokens that are not known words, taught grammar or particles would surface them for review. My rough tokenizer found every case I fixed. As an error it would be too noisy, because of conjugated forms.
6. **Example blocks whose reading equals the Japanese show the same line twice.** That's most wave 2 drafts and many live lessons (`いただきます。 / いただきます`). The player could skip the reading line when it equals the Japanese once punctuation and spaces are removed. This is a small mobile change and not blocking.
7. **Reading lessons translate the lines their checks ask about** (2.3). It's not mechanical, so it stays with review and the new corrections note.

---

# 7. What I could not verify

- **Linguistic correctness of anything**, including every edit and the rewrite of 54.
- **Screen fit** of the rewritten Teach beats at 375pt. That's for the Alpha.
- **Whether the kanji mnemonics help**. That's for the Alpha and triage.

## 7.1 For the native-speaker sample (Blocker 6), adding to wave 1's 7.1

1. **Numbers and counters:**
   - いっさい, はっさい, じゅっさい and はたち (70).
   - "まん always has a number in front: いちまん" (67).
   - "よん is more common than し in everyday counting" (65, 68).
   - "なな is heard as often as しち" (66, 69).
2. **Kanji pictures:**
   - 子 (baby wrapped up), 女 (woman kneeling, arms crossed), 男 (rice field over strength), 父 (two short strokes over a big X), 母 (two dots) (54).
   - 小 (49).
   - 何 (the side form of 人) and 名 (evening over mouth) (62).
   - 学 (子 under a roof with three marks), 校 (tree or wood on the left), 本 (tree with a mark at the root) (76).
3. **Readings taught for a lone kanji:** 子 as こ (54), 大 as だい and 小 as しょう (49).
4. **Lesson 45:** is `なまえ は たなか です` natural for "My name is Tanaka"?
5. **Lesson 60:** "before です, なに usually becomes なん", and かた as a polite ひと.
6. **Lesson 61:** `いくつ です か` as "How many?".
7. **Lesson 52:** がくせい as "usually a university student".
8. **Lesson 72:** め as "eye", and めがね as starting with it.
9. **Lesson 75:** `あに が います` as "There is an older brother" or "I have an older brother".

---

# 8. Verification ($0, no model call)

- **Originals kept.** Every wave 2 draft and critique was copied to the session scratchpad before editing. The four originals that became corrections entries are stored inside those entries (54, 70, 77 and 47).
- **Offline gate.** I ran `LessonDraftSchema`, `checkCourseRules`, the multiple-choice answer check, target declaration and the open-check scan over all 30. The result was 0 errors, 0 warnings, 0 open checks, and no undeclared targets.
  - Run on the originals, the same script reported the gate's known errors (54: 田 and 力; 47 and 75: the open check; 77: `hon`), so it does test what it claims to.
- **Official recheck.**
  - The 28 edited drafts were moved to `<id>.rejected.json` and run through `pnpm --filter api authoring:draft foundation-ja-ch08 … ch12 --recheck` from the main checkout. That covers the structural validator against the item table, then the gate.
  - **28 rechecked, 0 rejected, $0.0000.** Lessons 46 and 55 were rechecked a second time after a last edit, and both passed.
  - Lessons 57 and 59 weren't edited. They passed the offline gate and weren't rechecked.
- **Critiques.** `--recheck` deletes `<id>.critique.json`. I restored the 23 pre-edit critiques afterwards, as in wave 1. They describe the drafts before my edits and are stale. Nothing downstream reads them.
- **Typed answers.** Every typed answer I wrote or reworded was checked against `typedAnswersMatch`.
  - Accepted: `ima`, `otoko`, `san`, `go en`, `juu`, `kyuu`, `dou`, `tanjoubi`, `tokei`, `sensei`, `gakusei`, `gakkou`, `otouto`, `imouto`, `shigoto`, `sono kasa`, `hon` and the sentence answers in 2.1.
  - Rejected: `kyu`, `doo`, `tanjoobi` and `tokee`. The Teach and explanation edits now steer learners away from those.
  - `ju-` is accepted for じゅう, which is H.2.e by design.
- **Sweeps over all 30.**
  - No typed prompt says "in kana".
  - No explanation has praise, or more than two sentences.
  - Every remaining "you already know" claim names a word an earlier lesson really taught.
- **Logged.** One line in `run-log.txt`.

---

# 9. For publishing

**Approved for publishing now, in course order.** For each, the Lead runs `EDITOR=true pnpm --filter api authoring:review <id>`, then `authoring:publish <id>`:

- `foundation-ja-ch08-l01` (41)
- `foundation-ja-ch08-l02` (42)
- `foundation-ja-ch08-l04` (44)
- `foundation-ja-ch08-l05` (45)
- `foundation-ja-ch08-l06` (46)
- `foundation-ja-ch08-l07` (47)
- `foundation-ja-ch08-l09` (49)
- `foundation-ja-ch09-l01` (51)
- `foundation-ja-ch09-l02` (52)
- `foundation-ja-ch09-l03` (53)
- `foundation-ja-ch09-l04` (54)
- `foundation-ja-ch09-l05` (55)
- `foundation-ja-ch10-l01` (57)
- `foundation-ja-ch10-l02` (58)
- `foundation-ja-ch10-l03` (59)
- `foundation-ja-ch10-l04` (60)
- `foundation-ja-ch10-l05` (61)
- `foundation-ja-ch10-l06` (62)
- `foundation-ja-ch11-l01` (65)
- `foundation-ja-ch11-l02` (66)
- `foundation-ja-ch11-l03` (67)
- `foundation-ja-ch11-l04` (68)
- `foundation-ja-ch11-l05` (69)
- `foundation-ja-ch11-l06` (70)
- `foundation-ja-ch12-l01` (72)
- `foundation-ja-ch12-l02` (73)
- `foundation-ja-ch12-l03` (74)
- `foundation-ja-ch12-l04` (75)
- `foundation-ja-ch12-l05` (76)
- `foundation-ja-ch12-l06` (77)

**Held:** none. **Rejected:** none.

**Not in this review:**
- Lesson 43 (`foundation-ja-ch08-l03`), live since 22b.
- The audio lessons 48, 50, 56, 63, 64 and 71 (Blocker 2).

**Files changed besides the drafts:**
- `decisions.md` (F.2.j)
- `tools/authoring/corrections.jsonl` (4 lines)
- `ops/work/22c-full-batch/run-log.txt` (1 line)

They're uncommitted in the main checkout, for the Lead's state sync.
