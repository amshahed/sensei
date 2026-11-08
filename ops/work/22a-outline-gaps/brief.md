# Brief: fix the beta outline so lessons can be drafted from it

Unit `22a-outline-gaps`. Written by the Project Manager, 2026-11-08. Target outline in the appendix. Decisions logged in `decisions.md` as D.2.a, E.1.b, F.1.a, G.4.b, G.4.d and M.1.a.

---

# 1. Problem

The outline at `tools/authoring/output/skeleton.json` (15 chapters, 113 lessons) teaches things that depend on material it never teaches. Drafting from it produces lessons a beginner cannot follow. Audit: `ops/journal.md`, "state audit". Re-checked and extended for this brief.

**Confirmed from the audit**
- No item exists for こんにちは, ありがとう, すみません, はじめまして, よろしく, 日本.
- No か, の, ます form or て-form, yet ませんか, ましょう, たいです and てください are taught.

**Found while re-checking (not in the audit)**

| Gap | Evidence |
|---|---|
| Sounds used before they exist | 81 of the 162 outline words need a voiced sound, combination, small っ or long vowel. The first is テレビ at lesson 30 |
| Kanji asked before they are taught | 125 of 162 words are spelled with kanji. In 121 of them at least one kanji is untaught at that point, and in 77 a kanji is never taught in the slice. Reviews then ask "Type the reading for 「鉛筆」" (G.4.a) |
| Word never taught | 一緒 appears only in a speaking lesson (old ch13-l09) |
| Particle before verbs | で (old ch11-l05) comes before any verb |
| Possession without の | Old ch10 is titled "Possession" and has no possessive |
| Questions before か | Old ch09 teaches question words with no way to ask |
| Adjectives with no grammar | Old ch14 teaches 15 adjectives and no way to use them |
| Age before 何 | Old ch08 asks for age; question words arrive in ch09 |
| Thin sound practice | Only 2 of 162 words contain っ (がっこう, いっしょ). The ぱ row appears in 2 words |

**Consequence if unfixed:** the absolute beginner hits unreadable words by lesson 30 and unanswerable reviews right after. That persona has already quit one app.

---

# 2. Users and use cases

- **Absolute beginner (primary).** No kana, 15 minutes a day on a phone, often tired, wants a basic conversation on a trip within a year. Needs every step readable from what came before, and real Japanese early.
- **Returning learner (secondary).** Knows kana and some words. Skip-tests already serve them. The new chapters must be skippable like any other.

---

# 3. Decisions

## 3.1 Set phrases: 20 new items, 25 phrases taught

All 20 have a JMdict entry (the canonical dictionary, E.1). Phrases with no entry were rejected: わかりました, そうですか, げんきです, だいじょうぶです. They are compositions, and an AI-invented phrase item would breach the correctness constraint.

| Lesson | New items (JMdict id) | Already in the item table |
|---|---|---|
| Hello and goodbye | こんにちは 1289400, おはようございます 1002340, こんばんは 1289480, さようなら 1291050, おやすみなさい 1001780 | |
| Thank you and sorry | ありがとう 1586820, ありがとうございます 1541040, すみません 1295060, ごめんなさい 1270680, どういたしまして 1009030 | |
| Yes, no and please | おねがいします 1001720 | はい, いいえ, どうも, どうぞ |
| Meeting someone | はじめまして 1625780, よろしくおねがいします 2133750, こちらこそ 1004510, おげんきですか 2272760, そうです 2837492 | |
| Table and shop | いただきます 1410800, ごちそうさまでした 1005080, いらっしゃいませ 1000930, もういちど 2005860 | ください |

- **Also added, as ordinary words:** 日本 1582710, 日本語 1464530. Total new rows: 22.
- **Displayed in kana, always in this slice.** Several have kanji forms containing kanji far beyond N5 (お願い, 宜しく).
- **Bare よろしく rejected.** JMdict's first sense is "well; properly". The full phrase has its own entry.
- **Rejected for this persona:** いってきます, いってらっしゃい, ただいま, おかえりなさい. They are household phrases and a traveller rarely needs them. They wait for later Foundation.
- **"I don't understand"** arrives as わかりません in the ません lesson, using the existing わかる. It is too useful to leave out and has no phrase entry.

## 3.2 Grammar: 10 added, 5 cut, 24 in the slice

**Added.** These are prerequisites of the Tanos points, not extra content.

| # | Point | Needed by |
|---|---|---|
| 1 | か (question) | Every question from Ch8 on |
| 2 | の (linking nouns) | 私の名前, position phrases, family |
| 3 | じゃありません (is not) | Basic self-description |
| 4 | ます (polite verb) | を, に/へ, で, ましょう, たいです |
| 5 | ません (polite negative) | ませんか, わかりません |
| 6 | ました (polite past) | Talking about what you did |
| 7 | て-form | てください |
| 8 | い-adjective use | The adjectives in Ch16 |
| 9 | な-adjective use | The adjectives in Ch16 |
| 10 | 〜がすきです (in kana, because 好 is never taught, G.4.d) | Self-introduction milestone |

**Cut:** のがすきです (replaced by the simpler 〜がすきです, needs no verb-to-noun step), のがじょうずです, てもいいです, にいく, から.

**Retained Tanos points (14):** です, は, も, があります, がいます, で, に/へ, に, を, ませんか, ましょう, てください, と, たいです.

**Limits.** ます and the て-form are taught only for verbs the learner already knows, not as complete conjugation tables. The て-form is the hardest thing in the slice and one lesson is tight. Check it first at content review. If it fails, teach てください as a fixed pattern for the known verbs and drop the て-form item.

## 3.3 Sound variants: the trade-off is right, with three conditions

**Verdict: accept for closed beta.** No new item type. D.2 stands.

**Why it is right for this persona**
- Voiced sounds are one rule on shapes already known (か → が). Separate items would add about 58 flashcards per script (about 116 for hiragana and katakana) for rules, not knowledge, to a tired 15-minute learner who already quit one app.
- Many combinations occur in no word in the slice. Scheduling them would drill sounds the learner never meets.
- Reading real words matches the product's position: comprehension over memorisation.

**Condition 1: lessons target words, never the base kana.** The audit's route was to target か for a lesson on が. Rejected. A miss on が would push か back into review and tell a learner who knows か that they don't. Sound lessons are vocabulary lessons carried by words that contain the sound. A miss lands on the word, which is true.

**Condition 2: a coverage floor.** "Vocabulary drills them" is only true if the words exist. Today it is false for っ and thin for the ぱ row. The target outline has:

| Group | Words in the slice |
|---|---|
| が row / ざ row / だ row | 24 / 18 / 21 |
| ば row / ぱ row | 7 / 4 |
| Combinations | 17 |
| Small っ | 7 |
| Long vowels | about 41 |

Floor from here on: at least 3 words per voiced row, 5 for combinations, 5 for small っ, 5 for long vowels.

**Condition 3: a reversal trigger.** If first-attempt misses on words in one sound group run more than 30% above other words of the same age in closed beta, or Alpha reports learners cannot read a group on sight, reopen D.2 and add items for that group only. The 30% is my judgment and a starting point, not a measured threshold.

**Costs accepted, stated plainly**
- No per-sound signal. A learner weak on ぴょ gets no targeted review of it.
- Rare sounds (にゃ, ぢ, づ) are shown once and may never recur.
- **The sound lessons are currently silent.** The player skips audio until Azure is provisioned (`apps/mobile/src/lesson/teach.ts`). Rōmaji carries が and きゃ well. It carries long vowels and っ badly, because those are about timing. Fine for Alpha, not good enough for closed beta. Blocker 2 undercounts this: it lists 11 lessons, but every kana and sound lesson wants audio.

## 3.4 Script: words appear in kana until their kanji is taught

Reordering cannot fix the kanji gap: light kanji (M.1) can't cover 121 words. Rule: a word is shown in kana until the learner has been taught every kanji in it. While in kana, reviews ask its meaning, as they already do for kana-only words.

- Keeps E.1.a's "teach what real text uses" once the kanji is known.
- Makes the sound drill stronger: every kana word in review must be decoded.
- **Acceptable fallback if per-learner switching is costly:** all vocabulary stays in kana for the beta, and kanji appear only in kanji lessons. P9 holds either way.
- **Rejected:** kanji with kana readings above (furigana) in reviews, which answers the reading question itself. Teaching 120 more kanji, which contradicts M.1.

**Ruling on placement and skip-tests (tech.md section 5, G.4.d).** The Tech Lead's reading is right for the tests and incomplete for what follows them.

- **The tests keep kanji.** They exist to check what a learner already knows, and a learner can decline them. An absolute beginner never gets kanji in placement, which runs only after "a fair amount" or "refresher" at signup. Without kanji there, kanji chapters could not be skipped honestly. P9's old wording ("never") was too broad, so it is narrowed.
- **The leak is afterwards.** A placement skip or a passed skip-test schedules the chapter's untested items for review, including kanji (`placement.service.ts` `inferable`, `assessments.service.ts` `seedUntested`). A kanji missed on a passed skip-test is scheduled too. Since vocabulary is now answered in kana (G.4.c), passing a chapter says nothing about kanji, yet the learner would get "Type a reading for 「母」" with no lesson behind it. That breaks P9 outright.
- **Rule:** a kanji reaches reviews or practice only if I studied it in a lesson or got it right on a test.
- **Same check caught a grammar case:** 〜が好きです would have shown 好, which is never taught. It is now 〜がすきです.

## 3.5 Teaching order

The appendix is binding (F.1.a). Principles:

1. Hiragana, then its changed sounds, then phrases, then katakana. Real words now start at lesson 15 (old outline: 30). Everyday phrases start at lesson 21, around day 11 at two lessons a day (old outline: lesson 33, and it had no way to say hello at all).
2. か, の and じゃありません straight after は/です.
3. Questions before numbers and age, so 何歳 works.
4. Objects, then position words, then に for where things are.
5. All verbs, then ます, then ません, then を, に/へ, で, then ました.
6. ませんか and ましょう after ません. て-form immediately before てください.
7. Adjective grammar straight after its vocabulary.

I checked the appendix by script: every word uses only sounds already taught, every integration item was taught earlier, and every grammar prerequisite comes first, using a dependency map I wrote myself. No ordering failures. The script's only two flags were lookup misses on ください and わかる, and both are confirmed in the live item table.

## 3.6 Scope: 120 lessons

113 + 23 new − 16 removed = 120.

**New (23):** 7 sound lessons, 5 phrase lessons, 10 grammar, 1 extra lesson for に (location, ahead of time).

**Removed (16)**

| What | Why |
|---|---|
| 3 kana "Review" lessons (old ch01-l04, ch02-l04, ch03-l05) | Scheduled reviews already do this, and each chapter keeps its reading lesson |
| 3 kanji lessons (old ch11-l07, ch14-l07, ch15-l07) | M.1 says light kanji. ch14-l07 and ch15-l07 repeat 大, 小, 生 |
| Siblings and Parents (old ch07-l02) | 両親, 兄弟 not needed for the milestone; 弟, 妹 move to Immediate Family |
| Polite Family Terms (old ch07-l03) | Absorbed: its words carry the long-vowel lesson |
| Days of the Week (old ch08-l06) | Not needed for introducing yourself |
| School Supplies (old ch10-l01) | 紙 and others are low value for a trip; ノート and 鉛筆 move to sound lessons |
| Public Spaces (old ch11-l02) | 公園 not essential; 図書館 and 大学 move |
| 5 grammar lessons | See 3.2 |

Also dropped as words: 外国人, どうして, 言う, 郵便局, 紙, 公園, 両親, 兄弟, 月曜日 to 日曜日.

**Totals:** 120 lessons, 17 chapters, 185 words, 24 grammar points, 41 kanji. M.1's 150 to 200 words holds. Grammar is 24 against "15 to 20" because M.1 assumed prerequisites were on the list. Logged as M.1.a.

---

# 4. Promises

Every promise can be checked by reading and typing. None needs audio.

- **P1.** Every word I meet is made only of sounds I have already been taught. I never see が, きゃ, っ or a long vowel in a word before the lesson that teaches it.
- **P2.** After the "sounds that change" chapter, I can read any word from that chapter and type how it sounds, with no hint.
- **P3.** When I miss a word containing が, that counts against the word. か is not marked weak and doesn't come back sooner because of it.
- **P4.** In the course list I can find at least 3 words for each voiced row and at least 5 each for combinations, small っ and long vowels, and those words come back in my reviews.
- **P5.** By lesson 25, before katakana, I know 25 everyday phrases, and each lesson tells me when to say them, not only what they mean. I can pick the right phrase for greeting, thanking, apologising and meeting someone.
- **P6.** Phrases I learned come back in reviews, and a correct meaning in my own words is accepted.
- **P7.** No lesson uses grammar I haven't been taught. I learn か before I'm asked a question, の before possessives, ます before ませんか, ましょう and たいです, and the て-form before てください.
- **P8.** Every grammar point I complete comes back in reviews with a question I can answer.
- **P9.** In lessons, reviews and practice I am never asked to read a kanji I haven't been taught. Words and grammar patterns whose kanji I don't know appear in kana. The only place I can meet an untaught kanji is a placement quiz or skip-test, which exist to check what I already know and which I can decline. A kanji I neither studied in a lesson nor answered correctly on one of those tests never comes back in my reviews or practice.
- **P10.** After the last chapter I can write a short self-introduction on my own: greeting, name, where I'm from, what I do, something I like, and a closing phrase, without opening an earlier lesson.
- **P11.** The course list shows about 120 lessons in 17 chapters, in the order of the appendix.

---

# 5. Out of scope

- Audio and speaking. 12 of the 120 lessons (8 speaking, 4 listening) stay blocked on Azure (Blocker 2).
- Foreign-sound katakana (ティ, ファ) and writing your own name in katakana. The milestone is spoken or typed with a name the learner already knows.
- New item types, per-sound scheduling, and any data-model change for sounds.
- でした, ませんでした, plain forms, ね and よ as taught points. Drafts must not rely on them.
- Drafting lessons: units 22b and 22c.

---

# 6. Notes for the Tech Lead

Facts found while checking. The approach is yours.

- `multi_word` (D.2) does not exist anywhere in the code.
- The outline loader only reads items tagged N5. アメリカ is N4, and the 22 new rows have no level. New rows must not claim a Tanos level (E.1.b).
- The outline prompt hard-codes about 100 lessons and "the first 15–20" grammar points. A model cannot be trusted to reproduce a fixed order, so P11 needs enforcing or a hand-built outline.
- F-Vocab lessons accept only vocabulary targets, which suits 3.3. The drafter's kana-card instruction is F-Kana only, so sound lessons need it too.
- P9 changes what reviews ask (amends G.4.a, see G.4.b).
- 人 has two items, ひと and じん. Once shown as 人, a review prompt can't distinguish them. Keep じん in kana.
- All 40 grammar items have no meaning text, so P8 depends on authoring writing one for all 24. Supplied in `grammar-meanings.json`.
- P9 now also covers what placement and a passed skip-test schedule for review (3.4, G.4.d). `tech.md` section 4 has no implementation or test for that yet.

---

# 7. Risks and what I cannot judge

- **Credits.** 120 lessons at about $0.15 is about $18, against about $19.50 left, before the outline (about $0.50) and critic passes. Blocker 1 will probably trigger. Draft in course order, audio-blocked lessons last, so the budget buys a continuous course.
- **Language correctness.** I am not a Japanese expert. Phrases are confirmed to exist in JMdict. Whether the order is the best teaching order, and the usage notes and grammar explanations drafted later, are not verified. This is "fit for closed beta" only (OM.1, Blocker 6).
- **Tally caveats.** Sound-group counts are script tallies from readings. The long-vowel count is a heuristic and approximate.

---

# Appendix: target outline

`*` marks a lesson that is new or has changed contents. Others keep the items of the old lesson.

**Ch1. Hiragana: vowels, K, S** (4 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 1 | F-Kana | The five vowels | 5 items |
| 2 | F-Kana | The K row | 5 items |
| 3 | F-Kana | The S row | 5 items |
| 4 | I-Reading | Reading first syllables | 6 items |

**Ch2. Hiragana: T, N, H** (4 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 5 | F-Kana | The T row | 5 items |
| 6 | F-Kana | The N row | 5 items |
| 7 | F-Kana | The H row | 5 items |
| 8 | I-Reading | Reading simple words I | 6 items |

**Ch3. Hiragana: M, Y, R, W, N** (6 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 9 | F-Kana | The M row | 5 items |
| 10 | F-Kana | The Y row | 3 items |
| 11 | F-Kana | The R row | 5 items |
| 12 | F-Kana | W row and ん | 3 items |
| 13 | I-Reading | Reading simple words II | 6 items |
| 14 | I-Writing | Writing full hiragana | 8 items |

**Ch4. Hiragana: the sounds that change** (6 lessons) (new chapter)

| # | Type | Lesson | Items |
|---|---|---|---|
| 15 | F-Vocab | Voiced sounds: が and ざ rows * | 鍵 御飯 家族 水 地図 |
| 16 | F-Vocab | Voiced sounds: だ, ば and ぱ rows * | 友達 電話 子供 かばん 鉛筆 |
| 17 | F-Vocab | Combination sounds: きゃ, しゅ, ちょ * | 医者 お茶 辞書 写真 図書館 |
| 18 | F-Vocab | Long vowels * | お母さん お父さん お兄さん お姉さん 映画 |
| 19 | F-Vocab | The small っ pause * | 学校 一緒 ちょっと 切符 雑誌 |
| 20 | I-Reading | Reading real words with every sound * | 友達 学校 お母さん 写真 ちょっと |

**Ch5. First phrases** (6 lessons) (new chapter)

| # | Type | Lesson | Items |
|---|---|---|---|
| 21 | F-Vocab | Hello and goodbye * | こんにちは おはようございます こんばんは さようなら おやすみなさい |
| 22 | F-Vocab | Thank you and sorry * | ありがとう ありがとうございます すみません ごめんなさい どういたしまして |
| 23 | F-Vocab | Yes, no and please * | はい いいえ どうも どうぞ おねがいします |
| 24 | F-Vocab | Meeting someone * | はじめまして よろしくおねがいします こちらこそ おげんきですか そうです |
| 25 | F-Vocab | At the table and in the shop * | いただきます ごちそうさまでした いらっしゃいませ ください もういちど |
| 26 | I-Speaking | Greetings out loud * | こんにちは ありがとうございます すみません はじめまして |

**Ch6. Katakana: vowels through N** (6 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 27 | F-Kana | Katakana vowels | 5 items |
| 28 | F-Kana | Katakana K row | 5 items |
| 29 | F-Kana | Katakana S row | 5 items |
| 30 | F-Kana | Katakana T row | 5 items |
| 31 | F-Kana | Katakana N row | 5 items |
| 32 | I-Reading | Reading katakana loanwords I | 5 items |

**Ch7. Katakana: H through ン, and its sounds** (8 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 33 | F-Kana | Katakana H row | 5 items |
| 34 | F-Kana | Katakana M row | 5 items |
| 35 | F-Kana | Katakana Y row | 3 items |
| 36 | F-Kana | Katakana R row | 5 items |
| 37 | F-Kana | Katakana W, ヲ, ン | 3 items |
| 38 | I-Reading | Reading katakana loanwords II | 5 items |
| 39 | F-Vocab | Katakana sounds: ー, ッ, ャ and voiced marks * | ノート コーヒー スポーツ シャツ ポケット |
| 40 | F-Vocab | Loanword vocabulary | テレビ ラジオ カメラ ホテル レストラン |

**Ch8. Meeting people** (10 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 41 | F-Vocab | I and you | 私 あなた さん 皆さん |
| 42 | F-Vocab | People around us * | 人 先生 学生 |
| 43 | F-Grammar | A は B です * | です は |
| 44 | F-Grammar | Questions with か * | か |
| 45 | F-Vocab | Name and origin * | 名前 国 日本 アメリカ 人 |
| 46 | F-Grammar | Linking nouns with の * | の |
| 47 | F-Grammar | Is not: じゃありません * | じゃありません |
| 48 | I-Speaking | Saying your name | です は 私 名前 |
| 49 | F-Kanji | Kanji: person, big, small | 人 大 小 |
| 50 | I-Listening | Hearing introductions | です さん 名前 学生 |

**Ch9. Family and work** (6 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 51 | F-Vocab | Immediate family * | 父 母 兄 姉 弟 妹 |
| 52 | F-Vocab | Work and school * | 会社 仕事 大学 学校 |
| 53 | F-Grammar | Me too: も * | も |
| 54 | F-Kanji | Kanji: mother, father, child | 母 父 子 女 男 |
| 55 | I-Reading | Reading about family | は も 家族 父 母 |
| 56 | I-Speaking | Talking about your job | です 仕事 会社 学生 |

**Ch10. This, that and questions** (8 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 57 | F-Vocab | This and that (things) | これ それ あれ どれ |
| 58 | F-Vocab | This and that (modifiers) | この その あの どの |
| 59 | F-Vocab | Here and there | ここ そこ あそこ どこ |
| 60 | F-Vocab | Question words | 何 誰 いつ どなた |
| 61 | F-Vocab | How much and how many * | いくら いくつ どう |
| 62 | F-Kanji | Kanji: what, name, now | 何 名 今 |
| 63 | I-Listening | Hearing simple questions | です 何 これ どこ |
| 64 | I-Speaking | Asking what something is | です は これ 何 |

**Ch11. Numbers and age** (7 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 65 | F-Vocab | Numbers one to five | 一 二 三 四 五 |
| 66 | F-Vocab | Numbers six to ten | 六 七 八 九 十 |
| 67 | F-Vocab | Bigger numbers and yen | 百 千 万 ゼロ 円 |
| 68 | F-Kanji | Kanji: numbers 1 to 5 | 一 二 三 四 五 |
| 69 | F-Kanji | Kanji: numbers 6 to 10 | 六 七 八 九 十 |
| 70 | F-Vocab | Age and birthdays * | 歳 誕生日 |
| 71 | I-Speaking | Stating your age | です 歳 誕生日 一 |

**Ch12. Things around you** (6 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 72 | F-Vocab | Things you carry * | 本 財布 傘 めがね |
| 73 | F-Vocab | In the room * | 時計 机 椅子 |
| 74 | F-Grammar | There is (things): があります * | があります |
| 75 | F-Grammar | There is (people, animals): がいます * | がいます |
| 76 | F-Kanji | Kanji: book and study | 本 学 校 生 |
| 77 | I-Reading | Reading an object list * | があります 本 机 かばん |

**Ch13. Places and directions** (6 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 78 | F-Vocab | Around town * | 駅 銀行 店 病院 トイレ |
| 79 | F-Vocab | Position words | 上 下 中 外 前 |
| 80 | F-Vocab | Nearby and direction | 後ろ 隣 近く 右 左 |
| 81 | F-Grammar | Where things are: に * | に |
| 82 | F-Kanji | Kanji: up, down, in, out | 上 下 中 外 |
| 83 | I-Reading | Reading directions * | があります に 駅 近く 右 |

**Ch14. Daily actions** (13 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 84 | F-Vocab | Basic verbs I | 食べる 飲む 見る 聞く |
| 85 | F-Vocab | Basic verbs II | 行く 来る 帰る する |
| 86 | F-Vocab | Reading, writing and languages * | 読む 書く 話す わかる 日本語 英語 |
| 87 | F-Grammar | Polite verbs: ます * | ます |
| 88 | F-Grammar | Do not: ません * | ません |
| 89 | F-Grammar | Object marker を * | を |
| 90 | F-Grammar | Going to: に / へ * | にへ |
| 91 | F-Grammar | Where you do it: で * | で |
| 92 | F-Grammar | Did: ました * | ました |
| 93 | F-Kanji | Kanji: eat, drink, read, write | 食 飲 読 書 |
| 94 | F-Kanji | Kanji: go, come, see, hear | 行 来 見 聞 |
| 95 | I-Reading | Reading a daily routine * | ます を にへ 食べる 行く |
| 96 | I-Speaking | Describing what you do * | ます を にへ 読む 行く |

**Ch15. Time, suggestions and requests** (10 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 97 | F-Vocab | Times of day | 朝 昼 夜 今 午後 |
| 98 | F-Vocab | Telling time | 時 分 半 時間 |
| 99 | F-Grammar | At a time: に * | に |
| 100 | F-Grammar | Shall we? ませんか * | ませんか |
| 101 | F-Grammar | Let's: ましょう * | ましょう |
| 102 | F-Grammar | The て-form * | て-form |
| 103 | F-Grammar | Please do: てください * | てください |
| 104 | F-Kanji | Kanji: time and day | 時 間 日 分 |
| 105 | I-Listening | Hearing an invitation | ませんか ましょう 今 行く |
| 106 | I-Speaking | Making a suggestion | ませんか ましょう 一緒 食べる |

**Ch16. Describing things** (7 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 107 | F-Vocab | Common adjectives I | 大きい 小さい 新しい 古い いい |
| 108 | F-Vocab | Common adjectives II | 高い 安い 暑い 寒い おいしい |
| 109 | F-Grammar | Using い-adjectives * | い-adjective |
| 110 | F-Vocab | な-adjectives | 元気 静か 綺麗 便利 有名 |
| 111 | F-Grammar | Using な-adjectives * | な-adjective |
| 112 | F-Grammar | And, with: と * | と |
| 113 | I-Reading | Reading a description * | です い-adjective 大きい 静か |

**Ch17. Likes and self-introduction** (7 lessons)

| # | Type | Lesson | Items |
|---|---|---|---|
| 114 | F-Vocab | Hobbies and pastimes * | 音楽 歌 旅行 映画 スポーツ |
| 115 | F-Vocab | Like and dislike words | 好き 大好き 嫌い 上手 下手 |
| 116 | F-Grammar | I like: がすきです * | がすきです |
| 117 | F-Grammar | I want to: たいです * | stem-たいです |
| 118 | I-Listening | Hearing a self-introduction * | です がすきです 名前 音楽 |
| 119 | I-Speaking | Full self-introduction * | です も がすきです はじめまして 私 名前 好き よろしくおねがいします |
| 120 | I-Writing | Writing your introduction * | です は の はじめまして 私 名前 学生 よろしくおねがいします |