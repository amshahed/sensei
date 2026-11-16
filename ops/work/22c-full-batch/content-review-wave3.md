# Content review: 22c wave 3 (lessons 78 to 120)

Unit `22c-full-batch`. Written by the Project Manager, 2026-11-16. Reviews the 38 non-audio lessons of wave 3 in the main checkout's `tools/authoring/output/`: 32 drafts (99 and 120 recovered by the Lead) and the six the gate rejected (83, 86, 87, 94, 95, 104). The yardsticks are the same as wave 2:
- the 22b promises (`22b-sample-lessons/brief.md` section 4);
- the review policy in 22b `content-review.md` section 6;
- the explanation rules in `check-explanation/brief.md` 3.5;
- the decisions through F.2.j, the wave 2 watch-list (`content-review-wave2.md` section 4) and the correction notes merged in PR #85.

The audio lessons 96, 105, 106, 118 and 119 aren't drafted (Blocker 2).

**What approval means.** Fit for closed beta: tone, flow, naturalness, whether a beginner can follow it, and whether it keeps the promises. It does **not** mean linguistically verified (hard constraint, OM.1). My edits are AI-written Japanese too. Everything here goes to the native-speaker sample (Blocker 6).

**Overall: 37 approved for publishing, 1 held (120), none left rejected.**
- 35 drafts edited, 3 untouched (91, 116, 117).
- All six gate rejects were fixed by hand. 87 and 95 were rewritten, so their verdict is REJECT as drafted with the PM rewrite approved. No `--force` redraft is needed for 86 or 87.
- All 35 edited drafts passed `authoring:draft --recheck`, with no model call and $0.
- **120 is held, not rejected.** Its content is approved with corrections, but it holds the course's first open check. The check-explanation brief (section 5) and F.2.i say no lesson with one is published until the grader follow-up unit lands. That unit doesn't exist yet (section 3.3).

The edits fixed these problems, which would have hurt a learner:
- **Lesson 114 taught a spelling the grader rejects.** It said おんがく is typed `onngaku`. Grading accepts `ongaku` and marks `onngaku` wrong (checked with `typedAnswersMatch`). It also called おんがく a long-vowel word.
- **Lesson 98 left out the irregular times.** It didn't say that 4, 7 and 9 o'clock are よじ, しちじ and くじ, or that ふん becomes ぷん after 1, 3, 4, 6 and 10. Learners would say よんじ and きゅうじ.
- **Verb kanji couldn't be answered in review.** Lessons 93 and 94 taught 食 as "read た here". Reviews ask "Type a reading for 「食」" and accept たべる, never a bare た (`kanjiReadings`), so all eight verb kanji would fail in review. See 2.2.
- **Lesson 95's passage was built on words nobody had taught.** Six of them: あさ, ひる, ばん and ごご (a later lesson), あう and うち (never taught). It also glossed the exact words its checks asked for. Rewritten (2.3).
- **The drafter's self-corrections were left in learner text.** Lesson 109 said *"あたらしい くるま... well, you don't know くるま yet"*, and 120 said *"おんがち — oops — おんがく"*. Lesson 92 said "The み changes to ました". In lesson 115, an example's Japanese (やさい) and reading (おちゃ) were different sentences.
- **Rōmaji answers given away in Teach** in five drafts, all missed by the gate:
  - `no-mu` (84) and `go, go` (97);
  - `ふん (fun)` (98);
  - `genki` and `yuumei` (110);
  - `ryokou`, `onngaku` and `eiga` (114).
- **Grammar used before it's taught:**
  - に in lesson 80, one lesson early;
  - a destination に in 87, three lessons early;
  - を in 87 (the gate's catch);
  - object sentences with the particle dropped in 88;
  - plain dictionary forms ending sentences in 99.
- **False "you already know these" claims** in seven drafts: 78, 79, 84, 85, 86, 108 and 110. That's wave 2's Tech Lead finding 1, still open.

---

# 1. Verdicts

**Depth.** I read every lesson in full: every F-Grammar lesson as the watch-list asks, every F-Kanji and I-Reading lesson, and every F-Vocab Teach block and explanation.

**Critic noise.** I treated critic `example-feel` fails on vocabulary lessons (78, 79, 85, 98) as noise. The "untaught を and ます" fails on 91 and 97 were noise too, because lessons 87 and 89 teach both.

**Counts.** "Edits" counts changed Teach blocks, practice hints and checks, measured against the originals.

| # | Id | Type | Verdict | Edits |
|---|---|---|---|---|
| 78 | `foundation-ja-ch13-l01` | F-Vocab | APPROVE WITH CORRECTIONS | 2 Teach, 1 explanation. False "You already know some of these". "ぎんこう holds the お sound" now says the う makes こ last two beats and is typed |
| 79 | `foundation-ja-ch13-l02` | F-Vocab | APPROVE WITH CORRECTIONS | 1 Teach. False "You already know these as vocabulary" |
| 80 | `foundation-ja-ch13-l03` | F-Vocab | APPROVE WITH CORRECTIONS | 3 Teach, 3 prompts. **The examples used に (`ぎんこう の となり に びょういん が あります`) one lesson before に is taught.** They are now phrases with の (`ぎんこう の となり`, `えき の ちかく`), which T0 explains. Three prompts said "in kana" |
| 81 | `foundation-ja-ch13-l04` | F-Grammar, full | APPROVE WITH CORRECTIONS | 1 Teach. `ここ に ともだち が います` is "There is a friend here", not "My friend is here" |
| 82 | `foundation-ja-ch13-l05` | F-Kanji, full | APPROVE WITH CORRECTIONS | 3 Teach, 1 hint, 1 explanation. See 2.2 |
| 83 | `foundation-ja-ch13-l06` | I-Reading, full | APPROVE WITH CORRECTIONS | Rejected by the gate (`eki`). 2 Teach rewritten, 1 removed. See 2.3 |
| 84 | `foundation-ja-ch14-l01` | F-Vocab | APPROVE WITH CORRECTIONS | 6 Teach, 4 prompts. False "You already know them a little". "you たべる ごはん" put the verb before the object; it is now "ごはん is something you たべる". The mnemonic `no-mu!` gave away q4. Four checks were "Type the rōmaji for 'to eat' (たべる)", which only copies the kana shown; they now ask for recall: *Type the Japanese for "to eat". Rōmaji is fine.* |
| 85 | `foundation-ja-ch14-l02` | F-Vocab | APPROVE WITH CORRECTIONS | 2 Teach, 1 hint, 1 explanation. "You already met … いく, くる, かえる and する in earlier lists" was false. "くる … in space or in time" was cut to "toward where you are". The かえる/frog mnemonic is true and stays |
| 86 | `foundation-ja-ch14-l03` | F-Vocab | APPROVE WITH CORRECTIONS | Rejected by the gate (ます). The example `ともだち は にほんご が わかります` used ます and が with わかる; it is now `にほんご の ほん` (a book in Japanese). False "You already know よむ, かく…". **Hand fix, no `--force` redraft** |
| 87 | `foundation-ja-ch14-l04` | F-Grammar, full | **REJECT as drafted; PM rewrite APPROVED** | Rejected by the gate (を ×6). Five examples, one Teach block and three of four checks rebuilt. See 2.1. **Hand fix, no `--force` redraft** |
| 88 | `foundation-ja-ch14-l05` | F-Grammar, full | APPROVE WITH CORRECTIONS | 4 Teach, 1 check. See 2.1 |
| 89 | `foundation-ja-ch14-l06` | F-Grammar, full | APPROVE WITH CORRECTIONS | 2 Teach. `みず を のむ。` ended a sentence in the plain form; it is now `のみます`, like every other example |
| 90 | `foundation-ja-ch14-l07` | F-Grammar, full | APPROVE WITH CORRECTIONS | 1 Teach. `うち へ かえります` used うち (home), which is never taught. It is now `ホテル に かえります` (I'm going back to the hotel). The critic's q1 complaint is noise: に isn't among the choices |
| 91 | `foundation-ja-ch14-l08` | F-Grammar, full | APPROVE | none |
| 92 | `foundation-ja-ch14-l09` | F-Grammar, full | APPROVE WITH CORRECTIONS | 1 Teach. "The み changes to ました" is now "Only the ending changes" |
| 93 | `foundation-ja-ch14-l10` | F-Kanji, full | APPROVE WITH CORRECTIONS | 2 Teach, 1 added, 4 checks. See 2.2 |
| 94 | `foundation-ja-ch14-l11` | F-Kanji, full | APPROVE WITH CORRECTIONS | Rejected by the gate (目, 耳, 門). 2 Teach, 1 added, 2 hints, 3 checks. See 2.2 |
| 95 | `foundation-ja-ch14-l12` | I-Reading, full | **REJECT as drafted; PM rewrite APPROVED** | Rejected by the gate (`tabemasu`). Passage and Teach rebuilt, 5 of 10 checks rewritten, 2 explanations. See 2.3 |
| 97 | `foundation-ja-ch15-l01` | F-Vocab | APPROVE WITH CORRECTIONS | 2 Teach. The mnemonic `go, go!` gave away q10 (`gogo`) |
| 98 | `foundation-ja-ch15-l02` | F-Vocab | APPROVE WITH CORRECTIONS | 5 Teach, 1 check. See 2.4 |
| 99 | `foundation-ja-ch15-l03` | F-Grammar, full | APPROVE WITH CORRECTIONS | 7 Teach, 3 checks, mostly mechanical. See 2.1 |
| 100 | `foundation-ja-ch15-l04` | F-Grammar, full | APPROVE WITH CORRECTIONS | 1 Teach. The mnemonic's "flat no … turns a refusal into an invitation" is now: ません says "don't", and the rising か turns it into an invitation |
| 101 | `foundation-ja-ch15-l05` | F-Grammar, full | APPROVE WITH CORRECTIONS | 1 Teach. Says the う in ましょう is typed (`ikimasho` is marked wrong, `ikimashou` passes) |
| 102 | `foundation-ja-ch15-l06` | F-Grammar, full | APPROVE WITH CORRECTIONS | 2 Teach, 1 added, 2 checks. Adds `きく → きいて`, because lesson 103 uses きいて and its author note says "only the て-forms taught in the last lesson". q2's distractor みた (untaught) is now みました. q4 said "Use kana. Rōmaji is fine." |
| 103 | `foundation-ja-ch15-l07` | F-Grammar, full | APPROVE WITH CORRECTIONS | 1 Teach. `もういちど いって ください` used いう, which is never taught; it is now `もういちど よんで ください` |
| 104 | `foundation-ja-ch15-l08` | F-Kanji, full | APPROVE WITH CORRECTIONS | Rejected by the gate (門). 6 Teach, 1 removed, 3 checks. See 2.2 |
| 107 | `foundation-ja-ch16-l01` | F-Vocab | APPROVE WITH CORRECTIONS | 2 Teach. "おおきい starts with a long お sound" now uses the course's two-beat wording. "ちいさい has a tiny quick ちい" wasn't true (ちい is two beats too); it is now about mouth shape |
| 108 | `foundation-ja-ch16-l02` | F-Vocab | APPROVE WITH CORRECTIONS | 3 Teach, 3 checks. False "You already met … in passing". q1's answer "high" is now "expensive / tall", matching Teach. Two prompts said "in kana" |
| 109 | `foundation-ja-ch16-l03` | F-Grammar, full | APPROVE WITH CORRECTIONS | 3 Teach, 1 check. See 2.1 |
| 110 | `foundation-ja-ch16-l04` | F-Vocab | APPROVE WITH CORRECTIONS | 5 Teach, 4 prompts, 1 explanation. "You've actually seen them all before" was false; it now says げんき was met inside おげんきですか, which is true. `この はな は きれい` used はな (flower, untaught); it is now `この しゃしん は きれい`. Teach gave away `yuumei`, and the mnemonic gave away `genki`. Four "Type the rōmaji for げんき" checks now ask for recall |
| 111 | `foundation-ja-ch16-l05` | F-Grammar, full | APPROVE WITH CORRECTIONS | 3 Teach, 2 checks. はな (twice) is now しゃしん. "It is a famous person" is now "(She is) a famous person" |
| 112 | `foundation-ja-ch16-l06` | F-Grammar, full | APPROVE WITH CORRECTIONS | 1 Teach. `いっしょに` is spaced `いっしょ に` and glossed |
| 113 | `foundation-ja-ch16-l07` | I-Reading, full | APPROVE WITH CORRECTIONS | 1 Teach rewritten, 1 removed. See 2.3 |
| 114 | `foundation-ja-ch17-l01` | F-Vocab | APPROVE WITH CORRECTIONS | 5 Teach, 5 prompts, 3 explanations. See 2.4 |
| 115 | `foundation-ja-ch17-l02` | F-Vocab | APPROVE WITH CORRECTIONS | 3 Teach, 1 hint. The example was `すこし... いいえ、やさい が きらい です`, read as `いいえ、おちゃ が きらい です`; it is now `おちゃ が きらい です`. T0 claimed these work "with が, just like げんき and きれい", which is false. "きらい has an あ, きれい has an え" now names the kana: ら and れ |
| 116 | `foundation-ja-ch17-l03` | F-Grammar, full | APPROVE | none |
| 117 | `foundation-ja-ch17-l04` | F-Grammar, full | APPROVE | none. Follows its author note: no "stem" |
| 120 | `foundation-ja-ch17-l07` | I-Writing, full | **APPROVE WITH CORRECTIONS; HELD from publishing** | 6 Teach, 6 checks. See 2.5 and 3.3 |

---

# 2. Per lesson

## 2.1 F-Grammar: 87, 88, 99 and 109

**Lesson 87 (ます): rewritten.**
- **The gate's catch:** を appeared six times, two lessons before 89 teaches it. The draft also used a destination に (`がっこう に いきます`, in T7 and q3), three lessons before 90 teaches that use. The gate can't see that one (section 6.1).
- **New examples**, with no object and no untaught particle use:
  - `わたし も たべます` (I'll eat too);
  - `はい、のみます` (Yes, I'll drink some);
  - `わかります` (I understand);
  - `たなかさん も きます か` (Is Tanaka coming too?);
  - `わたし は かえります` (I'm going home).
  - Every one is a sentence an adult can say on day one.
- T6's list of polite forms adds `わかる → わかります`.
- **The checks:**
  - q2 is now *What does ともだち も きます。 mean?*
  - q3 is *Which sentence politely says "I understand"?*, with わかる です, わかりです and わかるます as distractors.
  - q4 is *Type the Japanese for "I'll drink too." Use わたし, も and the polite form of のむ. Rōmaji is fine.*
  - q1's explanation dropped "The む changes to み", because T1 says "no rules to memorise".
- **Why no `--force`.** A redraft would be told the を errors, but nothing would tell it about the destination に. The hand fix is certain and costs $0.

**Lesson 88 (ません).**
- **Three examples were broken:**
  - `みず の みません` split のみません into a false の;
  - `テレビ みません` dropped を before it's taught;
  - `がっこう いきません` dropped the destination particle.
- **Now:** `わたし も のみません` (I don't drink either), `ともだち は きません` (My friend isn't coming) and `わたし は いきません` (I'm not going).
- q3 is now `わたし も いきません。`, so the learner reads both も and ません.
- The mnemonic "'sen' … think 'no' with an N at the end" is gone. It now says ません ends in ん, like a firm "mm-mm".

**Lesson 99 (time に), recovered by the Lead.**
- Every example ended in a plain dictionary form (`しちじ に かえる。`), which is casual speech, two lessons after ます. They are now polite: `しちじ に かえります。` and so on.
- **Other fixes:**
  - "Without に it sounds unfinished" is now "With a clock time, the に is needed".
  - The garbled mnemonic ("the pin 'AT' sticks into a clock") now matches lesson 81's pin.
  - The list of words that take no に drops よる, since よる に is common.
- q2 is now `しちじ に たべます` ("I drink at seven" had no object). q3's answer is `はちじ に いきます。`.

**Lesson 109 (い-adjectives).**
- **The leaked self-correction is gone.** T4 now reads: *おおきい かばん is a big bag, and あたらしい ほん is a new book.*
- **Untaught word:** `おおきい いぬ は あそこ に います` used いぬ (dog), never taught. It is now `あたらしい ぎんこう は あそこ です`.
- **Mismatched check:** q3 asked for "This rice is tasty" but stored `これ は おいしい ごはん です` ("This is tasty rice"). The prompt now says "This is tasty rice".
- T5 is now `これ は ちいさい かばん です`, so the adjective + noun + です shape that q3 asks for is shown first (the critic's point).

**Lessons 81, 89, 90, 92, 100 to 103, 111 and 112** needed one to three small edits each (section 1). Lessons 91, 116 and 117 needed none.

## 2.2 F-Kanji: 82, 93, 94 and 104

**F.2.j applied to every lesson:**
- No untaught kanji appears, even as a part.
- Every target kanji has a reading in kana in Teach and a check on it.
- Stroke descriptions match the character.

Readings and primary meanings were checked against KANJIDIC2 (`apps/api/data/sources/kanjidic2-en-3.6.2.json`). Every wave 3 kanji's first meaning fits what the lesson teaches: 行's is "going", 間's "interval" and 分's "part", which is fine. That checks the source data, not the item rows.

**Lessons 94 and 104 (F.2.j, the gate's catch):**
- **94:** 見 is now *the shape for an eye, a tall box with two lines across it*, over two legs. 聞 is now *the shape for an ear* inside *the shape for a gate, a door on each side*. The hints and explanations match.
- **104:** 間 is *the sun, 日, peeking through a gate*. 日 is a target of the same lesson, so naming it is allowed (F.2.j point 2), and the gate is described in words.

**New pattern: verb kanji readings.** This affects 93 (食 飲 読 書) and 94 (行 来 見 聞).
- The drafts taught "見 is read み here" through ます forms.
- Reviews ask *Type a reading for 「見」*. `kanjiReadings` accepts みる and けん, but not a bare み (by design, so 生 can't pass with い).
- **So the learner was taught exactly the answer that review marks wrong.**
- **The fix:** each lesson gets one text block: *Each kanji is read as the start of its verb, and the kana after it stay: 食べる is たべる, 飲む is のむ … When a review asks for a reading of one of these kanji, type the whole verb, such as たべる.* Lesson 94 adds that 来る is くる but 来ます is きます.
- **Typed reading checks:**
  - 93: *How do you read 食べる?* (q2) and *How do you read 読む?* (q6).
  - 94: *How do you read 見る?* (q2).
- The two "which kanji goes in ___みます (drink)" checks lost their English gloss, so they test the reading, not the meaning.
- The recap card already shows `た(べる)`.
- This is section 6.4 and a corrections entry.

**Lesson 82 (上 下 中 外).**
- 外 had no description ("someone standing out beyond the walls", "that lonely shape"). It now has: *The left half is the evening shape you met at the top of 名. On the right stands a single line with a short stroke off it, set apart.* This uses lesson 62's wording.
- Its example `そと に ともだち が います` didn't show 外. It is now `外 に ともだち が います`.

**Lesson 104 (時 間 日 分).**
- 日 had no reading. Teach now says *on its own it is read ひ*, and q6 asks it.
- q6 had used 今日, whose reading きょう is special and untaught, and the 今日 example is removed.
- T0's "You already say … ひ" was false.
- T1's "分 … is the ふん in ふん" was garbled. It now gives ふん, "or ぷん after some numbers".
- Examples are respaced (`何時 です か。`).

**No second F-Kanji strike.** There was no rewrite. Lessons 93, 94 and 104 had moderate edits, 82 a light one.

## 2.3 I-Reading: 83, 95 and 113

**Lesson 95 (daily routine): rewritten.**
- **What was wrong:**
  - The passage used あさ, ひる, ばん and ごご, which lesson 97 teaches after this one, and あう and うち, which are never taught.
  - T1 glossed いきます as "go (polite)", which q2 asks.
  - T5 translated `がっこう に いきます`, which q1 asks.
  - T2 spelled out `ta-be-ma-su` (the gate's catch).
- **The new passage**, built only from taught words: *わたし は がくせい です。 がっこう に いきます。 がっこう で にほんご を はなします。 としょかん で ほん を よみます。 レストラン で ごはん を たべます。 おちゃ を のみます。 コーヒー も のみます。 かえります。 テレビ を みます。*
- **The new Teach:**
  - It glosses the nouns.
  - It names the verbs only in their plain form ("the polite forms of いく, はなす, よむ…"), so "which word means go" isn't answered outright.
  - It explains を, に and で with a sentence that isn't in the passage (`えき で みず を のみます`).
- q1, q2, q3, q8 and q10 were rewritten to the new passage. q3 was "How many times does the person eat", and is now "Where does the student eat?".

**Lesson 83 (directions).**
- The give-away example (`えき / e-ki`) is removed.
- **The wave 2 pattern returned:** T2 translated `えき の ちかく に ぎんこう が あります` (q2's answer), and T4 translated the lines q6 and q10 ask about.
- Both now teach with sentences that aren't in the passage: `がっこう の ちかく に としょかん が あります` and `ホテル の となり に みせ が あります`.

**Lesson 113 (description).**
- T4 was `やま / ya-ma / mountain (just to show how readings work)`, copied from the I-Reading correction note's own example. Removed.
- T5 translated `おおきい です` and `しずか です`, the answers to q1 and q2. It now uses `この かばん は ちいさい です`.

## 2.4 F-Vocab: 98 and 114

**Lesson 98 (telling time).**
- **Added:** that 4, 7 and 9 o'clock are よじ, しちじ (not ななじ) and くじ, and that ふん becomes ぷん in いっぷん, さんぷん, よんぷん, ろっぷん and じゅっぷん.
- `ふん (fun)` gave away q4, and `(han)` is gone too.
- **Examples:** `ごふん です` ("It's five minutes") is now `いま にじ ごふん です` (It's 2:05 now). `にじかん べんきょう` (untaught べんきょう, with a reading that didn't match) is now `えいが は にじかん です` (The film is two hours long).
- q6 had two right answers (`よじ はん` and `よじ はん です か`). The second is now `はん よじ`.

**Lesson 114 (hobbies).**
- **Typing tip fixed:** `onngaku` (rejected by grading) and "おんがく has a long vowel" are gone. The tip now covers the う in りょこう, the い in えいが and the ー in スポーツ, without spelling any answer.
- **Untaught words in examples:** `うた を うたいます` used うたう and `りょこう が すきです` used すき, both untaught. They are now `この うた は いい です` and `りょこう に いきます`.
- T0 now says, truthfully, that えいが and スポーツ are already known: lessons 18 and 38 taught them, and this outline teaches them again.
- **Checks:** the five "Type the rōmaji for X" checks now ask for recall. q8's explanation ("えい is eig") was garbled.

## 2.5 Lesson 120 (I-Writing): approved, held

**Content edits:**
- The leaked "おんがち — oops —" is removed.
- "This is your last lesson!" is gone: it isn't, after the beta.
- "Well done finishing the course!" was praise in an explanation.
- `アメリカ の ひと` is now `アメリカじん`, which lesson 45 taught and which is what people say. It also appears in the passage and the model answer. q12 now tests の with `わたし の ともだち`.
- よろしくおねがいします was glossed "please remember me", which is wrong. Teach now says it is hard to translate and means something like "I look forward to getting to know you".
- Three typed prompts said "in kana".

**The open check (q17).**
- It asked for the introduction "in kana". Learners type rōmaji everywhere else in the course, and the app doesn't depend on a Japanese keyboard (H.2).
- The prompt now says "Rōmaji is fine", and the rubric opens with "The answer may be in kana, rōmaji or a mix".
- It is still the only open check, and its author note asks for it (F.2.i).

**Why held:** section 3.3.

---

# 3. Rulings

## 3.1 The outline order at 86 to 89 (wave3-notes pattern 3)

**Decided and logged as `decisions.md` F.1.d: keep the order.**
- ます stays before を.
- Until を is taught, sentences have no object.
- The pinch cost hand edits to three drafts (86, 87, 88), all at $0.
- Reordering would change four lesson IDs, and every を example would end in a plain form the course hasn't taught.
- ます first gives learners sentences they can say at once (わかります, いきます), which serves "speak early".

## 3.2 Lessons 86 and 87: hand fix, no redraft

Both are fixed by hand and pass the gate, so I'm asking for **no `--force` redraft** ($0 instead of about $0.14).
- 86 needed one example.
- 87 needed a rewrite of its examples, but a redraft would still have used the destination に the gate can't see.

## 3.3 Lesson 120 is held until the open-check follow-up unit lands

- **The rule.** `check-explanation/brief.md` section 5 says a follow-up unit must land before the first lesson with an open check is published. Today a lesson check the grader couldn't judge looks like a miss. F.2.i repeats the rule.
- **Where it stands.** No such unit exists in `ops/work/`. Blocker 9 (Gemini billing) is separate and only matters before real learners.
- **Recommendation to the Lead:** open that unit next, after wave 3 is published.
  - It is the only thing between the course and its last lesson.
  - Lesson 120's draft is ready, so it publishes the moment the unit merges.
  - I'll write the brief when it is started.

---

# 4. Lesson types after wave 3

Every non-audio lesson in the beta is now drafted, so these verdicts steer redrafts and review, not new drafting.

- **F-Grammar: go, with a new watch item.**
  - One rewrite (87), caused by the outline order, not the drafter.
  - **Watch: leaked self-corrections** (99, 109, 120). Read every redraft in full for them (section 6.3).
  - **Watch: a particle used in a way not yet taught** (destination に in 87), which no gate can see.
- **F-Kanji: no second strike.**
  - Components were fixed with words (94, 104).
  - The new problem was verb readings (2.2), now in the corrections log.
- **I-Reading: no change.**
  - One rewrite (95), for untaught words.
  - Two lessons (83, 113) again translated the lines their checks ask about.
- **F-Vocab: go.**
  - The recurring defects are rōmaji give-aways and false "already know" claims.
  - One real correctness error each in 114 (`onngaku`) and 98 (irregular hours).
- **I-Writing (120): approved, held** (3.3).

---

# 5. Corrections log entries added

Four lines appended to `tools/authoring/corrections.jsonl`, each with its pre-edit draft as `original_draft`. Only new patterns are logged; the wave 2 notes already cover "in kana" prompts, false "already know" claims, held sounds and components.

| Type | Original | Note, in short | Who it steers |
|---|---|---|---|
| F-Kanji | lesson 93 | A verb kanji's reading is the whole verb (食べる is たべる, 来る くる and 来ます きます). Say that reviews want the whole verb, and ask for it in a check. Every example shows the target kanji. No words with special readings (今日) | Any kanji redraft |
| F-Vocab | lesson 114 | No rōmaji of a typed-check answer anywhere in Teach, even split up or as a sound-alike (`no-mu`, `go, go`, `ふん (fun)`). Typed checks are recall from English, not "Type the rōmaji for おんがく". ん before a consonant is n (`ongaku`). No untaught words or particles in examples | The audio-wave vocabulary, redrafts |
| F-Grammar | lesson 109 | Write only final text, with no self-corrections. Polite forms once ます is taught. A particle only in a use already taught (destination に). The translation check's English must mean the stored answer. Distractors are taught forms | Redrafts, the audio wave |
| I-Reading | lesson 95 | The passage uses only words taught before this lesson. Don't gloss the exact word a check asks for. Never copy example words from these notes (`やま`) | Redrafts |

All four load through `readCorrections` (F-Kanji 2, F-Vocab 4, F-Grammar 4, I-Reading 4).

---

# 6. For the Tech Lead (new findings, not instructions)

Wave 2's seven findings still stand.
- **Finding 1** (this lesson's words listed as known) recurred in 7 drafts.
- **Finding 4** ("in kana") recurred in 10 checks across 4 drafts (80, 102, 108, 120).
- **Finding 5** (untaught words) recurred with くるま, いぬ, はな, うち, あう, うたう, べんきょう, いう and きょう.

The new findings:

1. **The particle に passes the gate before it's taught.**
   - に is a known word ("two"), and F.2.d says a known one-kana word is never a particle.
   - So lesson 80 used `ぎんこう の となり に びょういん が あります` twice, one lesson before 81 teaches に.
   - A narrower rule for に would catch it: treat it as a particle unless it stands next to a number or counter.
   - A taught particle in an untaught use (destination に in 87) is beyond any gate and stays with review.
2. **Rōmaji give-aways the gate misses.**
   - Five F-Vocab drafts gave away a typed-check answer in Teach:
     - `no-mu` (84) and `go, go` (97): hyphen or comma between syllables;
     - `ふん (fun)` (98): skipped as an English lookalike, though it sits in brackets right after its own kana;
     - `genki` and `yuumei` (110), and `onngaku`, `ryokou` and `eiga` (114).
   - The last group are exact or near matches, so the F.2.g rule seems not to cover F-Vocab Teach for *recall* checks at all.
   - **Suggestion:**
     - remove hyphens, commas and spaces between rōmaji syllables before matching;
     - don't skip a lookalike in brackets right after the kana it spells;
     - check Teach against every typed check's answer, not only typed-reading checks.
3. **Self-corrections reach learner text.**
   - 99 (`しちじ に おきる... wait, let's use words you know`, removed by the Lead), 109 (`... well, you don't know くるま yet`) and 120 (`おんがち — oops —`).
   - A warning on `oops`, `wait,`, `you don't know … yet` and `let's use words you know` is a one-line regex. As a warning, review would see it.
4. **Verb kanji in review.** Reviews ask "Type a reading for 「食」" and accept たべる or しょく, never た.
   - Lessons 93 and 94 now tell the learner to type the whole verb, which is a patch in content.
   - For the eight verb kanji (食 飲 読 書 行 来 見 聞), the review prompt could show the dictionary form (「食べる」), or add "a whole word is fine".
   - Your call. It changes review behaviour, so it may need a decision entry.
5. **An example's Japanese and reading can disagree.**
   - Lesson 115: `すこし... いいえ、やさい が きらい です` was read as `いいえ、おちゃ が きらい です`.
   - Lesson 98: `にじかん べんきょう` was read as `にじかん`.
   - **Mechanical fix:** when an example has no kanji, its reading must equal its Japanese once spaces and punctuation are ignored. That could be an error.

---

# 7. What I could not verify

- **Linguistic correctness of anything**, including every edit and both rewrites (87, 95).
- **Screen fit** at 375pt of the longer Teach blocks I added: the verb-reading block in 93 and 94, and 98's time irregulars. That's for the Alpha.
- **Whether the "type the whole verb" note works for a learner in review.** That's for the Alpha, after 93 and 94 have been reviewed once.
- **The rōmaji open check in 120** under the real AI grader. That's for the follow-up unit.

## 7.1 For the native-speaker sample (Blocker 6), adding to waves 1 and 2

1. **Time:**
   - よじ, しちじ (not ななじ) and くじ;
   - いっぷん, さんぷん, よんぷん, ろっぷん and じゅっぷん (98, 104);
   - "いま, あさ and ひる usually stand alone, with no に" (99).
2. **Kanji pictures:**
   - 外: the evening shape and a lone line (82);
   - 見 (an eye on legs), 聞 (an ear in a gate), 行 (a crossroads) and 来 (a tree with people coming) (94);
   - 食, 飲, 読 and 書 (93);
   - 間: the sun through a gate (104).
3. **Readings:**
   - 日 read ひ on its own (104);
   - the "type the whole verb" readings, and 来ます as きます (93, 94).
4. **Sentences I wrote:**
   - 87: `わたし も たべます`, `はい、のみます`, `たなかさん も きます か` and `わたし は かえります`;
   - 88: `わたし も のみません`, `ともだち は きません` and `わたし は いきません`;
   - `えいが は にじかん です` (98) and `あたらしい ぎんこう は あそこ です` (109);
   - `りょこう に いきます` (114);
   - 95's whole passage, especially `かえります。` alone for "I go home";
   - 83's `がっこう の ちかく に としょかん が あります`.
5. **Glosses:**
   - よろしくおねがいします as "I look forward to getting to know you" (120);
   - たかい as "expensive / tall" (108);
   - げんき as "well, lively" (110);
   - "ふるい for things, not people" (107);
   - じょうず and へた with が (115).

---

# 8. Verification ($0, no model call)

- **Originals kept.** All 38 wave 3 drafts and 32 critiques were copied to the session scratchpad before editing. The four originals that became corrections entries (93, 114, 109, 95) are stored inside those entries.
- **Edits are reproducible.** Every edit is a script applied to the originals, and the rechecked drafts match its output exactly (35 of 35).
- **Offline gate.** I ran `LessonDraftSchema`, the item-ref repoint, the typed-reading transform, `checkCourseRules`, the multiple-choice answer check, target declaration and the open-check scan over all 38.
  - **Result:** 0 errors, and one open check (120 q17, allowed).
  - Run on the originals, the same script reported the gate's known errors (83, 86, 87, 94, 95 and 104) and the 10 "in kana" prompts, so it does test what it claims to.
- **Official recheck.**
  - The 29 edited drafts were moved to `<id>.rejected.json` beside the six real rejects, and run through `pnpm --filter api authoring:draft foundation-ja-ch13 … ch17 --recheck` from the main checkout.
  - **35 rechecked, 0 rejected, $0.0000.** Lessons 91, 116 and 117 weren't edited and weren't rechecked; they pass the offline gate.
- **Critiques.** `--recheck` deletes `<id>.critique.json`. I restored the 29 pre-edit critiques afterwards, as in waves 1 and 2. They describe the drafts before my edits and are stale. The six former rejects have none.
- **Typed answers.** Every typed answer I wrote or reworded was checked against `typedAnswersMatch`.
  - **Accepted:**
    - words: `taberu`, `nomu`, `miru`, `yomu`, `ginkou`, `ongaku`, `ryokou`, `eiga`, `supootsu`, `yuumei`, `genki`, `kirei`, `benri`, `shite`, `ikimashou`;
    - sentences: `watashi mo nomimasu`, `hachiji ni ikimasu`, `kore wa oishii gohan desu`, `hon o yomimasu` (and `wo`), `issho ni gohan o tabemasen ka`.
  - **Rejected:** `onngaku`, `ginko`, `ryoko`, `yumei`, `supotsu` and `ikimasho`. Teach now steers away from each.
- **Sweeps over all 38.**
  - No typed prompt says "in kana".
  - No explanation has praise or more than two sentences.
  - Every remaining "you already know" claim names words an earlier lesson taught.
  - A tokenizer pass leaves only conjugated forms of taught verbs, numbers with counters, names (ハナ, たなか) and kana mentioned on their own.
- **Logged.** One line in `run-log.txt`.

---

# 9. For publishing

**Approved for publishing now, in course order.** For each, the Lead runs `EDITOR=true pnpm --filter api authoring:review <id>`, then `authoring:publish <id>`:

- `foundation-ja-ch13-l01` (78)
- `foundation-ja-ch13-l02` (79)
- `foundation-ja-ch13-l03` (80)
- `foundation-ja-ch13-l04` (81)
- `foundation-ja-ch13-l05` (82)
- `foundation-ja-ch13-l06` (83)
- `foundation-ja-ch14-l01` (84)
- `foundation-ja-ch14-l02` (85)
- `foundation-ja-ch14-l03` (86)
- `foundation-ja-ch14-l04` (87)
- `foundation-ja-ch14-l05` (88)
- `foundation-ja-ch14-l06` (89)
- `foundation-ja-ch14-l07` (90)
- `foundation-ja-ch14-l08` (91)
- `foundation-ja-ch14-l09` (92)
- `foundation-ja-ch14-l10` (93)
- `foundation-ja-ch14-l11` (94)
- `foundation-ja-ch14-l12` (95)
- `foundation-ja-ch15-l01` (97)
- `foundation-ja-ch15-l02` (98)
- `foundation-ja-ch15-l03` (99)
- `foundation-ja-ch15-l04` (100)
- `foundation-ja-ch15-l05` (101)
- `foundation-ja-ch15-l06` (102)
- `foundation-ja-ch15-l07` (103)
- `foundation-ja-ch15-l08` (104)
- `foundation-ja-ch16-l01` (107)
- `foundation-ja-ch16-l02` (108)
- `foundation-ja-ch16-l03` (109)
- `foundation-ja-ch16-l04` (110)
- `foundation-ja-ch16-l05` (111)
- `foundation-ja-ch16-l06` (112)
- `foundation-ja-ch16-l07` (113)
- `foundation-ja-ch17-l01` (114)
- `foundation-ja-ch17-l02` (115)
- `foundation-ja-ch17-l03` (116)
- `foundation-ja-ch17-l04` (117)

**Held:** `foundation-ja-ch17-l07` (120). Its content is approved, but it waits for the open-check follow-up unit (3.3).

**Rejected:** none left.

**Not in this review:** the audio lessons 96, 105, 106, 118 and 119 (Blocker 2).

**Files changed besides the drafts:**
- `decisions.md` (F.1.d)
- `tools/authoring/corrections.jsonl` (4 lines)
- `ops/work/22c-full-batch/run-log.txt` (1 line)
- this file

They're uncommitted in the main checkout, for the Lead's state sync.
