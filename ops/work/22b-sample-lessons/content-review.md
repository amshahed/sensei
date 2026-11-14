# Content review: 22b sample lessons

Unit `22b-sample-lessons`. Written by the Project Manager, 2026-11-14. Reviews the drafts in `tools/authoring/output/` against `brief.md`.

**What approval means.** Fit for closed beta: tone, flow, naturalness, whether a beginner can follow it, and whether it keeps the brief's promises. It does **not** mean linguistically verified (hard constraint, OM.1). Every lesson here goes to the native-speaker sample (Blocker 6) before wider beta.

---

# 1. Verdicts

| # | Lesson | Type | Verdict | Edits |
|---|---|---|---|---|
| 2 | `foundation-ja-ch01-l02` The K row | F-Kana | **APPROVE WITH CORRECTIONS** | 3, all small |
| 19 | `foundation-ja-ch04-l05` The small っ pause | F-Vocab, sound | Not reviewed | Excluded: gate rejected both drafts; Tech Lead fixing |
| 20 | `foundation-ja-ch04-l06` Reading real words | I-Reading | **APPROVE WITH CORRECTIONS** | 10 small, incl. 1 added gloss block. Borderline, see 2.2 |
| 21 | `foundation-ja-ch05-l01` Hello and goodbye | F-Vocab, phrases | **APPROVE WITH CORRECTIONS** | 5 wording edits |
| 43 | `foundation-ja-ch08-l03` A は B です | F-Grammar | **APPROVE WITH CORRECTIONS** | 8, incl. 1 removed block and 1 added check. Most edited |

- Nothing is sent back. Every flaw was fixable by hand for less risk than a redraft, which with no `temperature` would give a different lesson with different flaws.
- Three systematic flaws went into `tools/authoring/corrections.jsonl` (section 3), so 22c drafts of those types are steered away from them.
- **Verified after editing (offline, no API spend):** all four edited drafts parse against `LessonDraftSchema` and pass `validateStructure` and `checkCourseRules` with zero errors and zero warnings, the same as the originals. No kanji in any learner-facing field (P9). Originals are kept in the session scratchpad and inside the corrections entries.

---

# 2. Per lesson

## 2.1 Lesson 2, The K row (F-Kana)

**Works**
- Opens with "Great work on the vowels!", so it follows lesson 1 cleanly.
- "K plus each vowel you already know" is the right mental model. The mnemonic that every row keeps the a-i-u-e-o order sets up the next 18 kana lessons.
- Five mnemonics (key, keg, bird's beak) are memorable. Checks drill both directions: kana to sound and sound to kana.

**Edits**
1. Example `こ え` / `ko e` → `こえ` / `koe`. The course rule is a space between *words*. The drafter put one between the kana of a single word, which teaches a false word boundary.
2. Example `か き` / persimmon → `えき` / `eki` / station. Resolves the critic's only failure (example-feel). The persona is a traveller, and えき is a canonical outline surface (`ja:vocab:駅`, taught at lesson 78), so it previews a word they will need.
3. q10 `How do you read the word こ え?` → `こえ`. Choices `ko e, ka e, ki e, ku e` → `koe, kae, kie, kue`. Correct answer and explanation to match.

**Noted, not changed**
- Every check is multiple choice. P3's "type how each sounds" is first exercised in the chapter 1 test, which asks "Type the rōmaji for 「か」" (`recall-question.ts`). That matches the seed lesson and is acceptable.
- The こ mnemonic ("a COrd coiled up") is the weakest of the five. It's not wrong, so I left it.

## 2.2 Lesson 20, Reading real words with every sound (I-Reading)

**Works**
- Passage first, then guidance on each tricky sound (っ, long vowels, small ゃ), then reading and typing. The right shape for the type.
- All five typed checks show the word in kana with no rōmaji, and rōmaji input is accepted: `gakkou`, `okaasan`, `chotto` pass and `gakko` and `choto` fail, checked against `WritingEvalService.exactMatch` (P5).

**Problems found**
- **The passage uses grammar from much later lessons.** `ともだち と がっこう。 おかあさん の しゃしん。 ちょっと みて。` uses と (taught at lesson 112), の (46) and みて (て-form, 102; みる, 84). The course rules forbid it. The gate can't tell particles apart in kana, and the critic was told the taught grammar and passed it anyway.
- **q5 ("Whose photograph is in the passage?") depends on の.** ともだち is also in the passage, so without の a learner can't tell whose photo it is. That breaks P2: "I can finish each one using only what it shows me."
- **The long-vowel explanation was wrong.** It said おかあさん has "a long お-あ sound" and repeated "お-あ at the start" in a practice hint and in q6. The kana show the held sound is かあ: the あ lengthens か. No linguistic expertise is needed to see this.

**Edits**
1. Added a text block right after the passage: *Here's what it says: "Friends and school. Mum's photo. Take a look!" The little words と (and), の ('s) and みて (look) come later in the course. For now, just read every sound.* This makes q5 answerable and leaves no Japanese unexplained, without rewriting the passage.
2. Long-vowel text → *In おかあさん, the あ after か makes か last two beats. In がっこう, the う after こ does the same to こ. Hold each one a little longer.*
3. Practice hint for おかあさん → *The あ after か makes it last two beats.* (Practice hints aren't shown in the current app, but the text should still be correct.)
4. q6 explanation → *おかあさん — the あ after か makes a long vowel, so it needs both か and あ.*
5. q2 explanation `four plain kana, no tricky sounds here` → *four kana, with no pause and no long vowel in this one.* だ is a changed sound, so "plain" contradicted P5's "changed sounds".
6. to 10. All five typed prompts, `Read the word and type exactly how it sounds in kana: X` → `Read this word and type how it sounds: X`. The input box shows Latin letters. "In kana" tells a learner without a Japanese keyboard they can't answer, when rōmaji is exactly what the check wants (P4, P5).

**Why approve rather than send back.** Neither the passage nor any check was rewritten or replaced, so it meets the 3.4 bar. But it is borderline: the lesson's centrepiece broke a course rule and was patched with a gloss. I count it as **one strike for I-Reading** (section 4).

**Noted, not changed**
- Example blocks have `reading` identical to `japanese` (`ともだち` / `ともだち`), so the app prints the word twice. Rōmaji there would give away the typed answers, and the schema forbids an empty reading. App-side fix suggested in section 5.

## 2.3 Lesson 21, Hello and goodbye (F-Vocab, phrases)

**Works**
- Keeps the author note fully: when *and* to whom for all five phrases, five situation checks (P6), phrases taught whole.
- Situations reuse known words in kana (がっこう, としょかん, かぞく; all taught by lesson 20). Good reinforcement.
- The clock mnemonic is clear, and さようなら "for walking away, a longer parting" is the right framing.

**Edits** (each removes a usage I think a native reader would query; none adds a new claim)
1. こんにちは: `Say it to almost anyone — a neighbour, a shop worker, a friend` → *Say it to people you meet during the day — a neighbour, a shop worker, someone you're meeting*.
2. おはようございます: removed `or just greeting your おかあさん at breakfast`. The polite form to your own mother is stiff. Now *arriving at school or at work, or passing a neighbour*.
3. こんばんは: `a friend, a shopkeeper, a neighbour` → *a neighbour, a shopkeeper, someone you're meeting*.
4. q2: `you walk into a としょかん` → *you meet a neighbour outside the としょかん*. You don't greet anyone on walking into a library. This keeps the known word.
5. q6: `you meet a ともだち outside` → *you meet a neighbour outside*. Consistent with 1 and 3. Together with q2 it shows the same person at two times of day getting two greetings.

**Noted, not changed**
- School and teacher situations (q3, q7) suit a child more than our adult persona. They are harmless (adults attend classes) and reinforce がっこう. 22c phrase lessons should favour adult situations: work, hotel, shop, neighbours.
- No typed check, so `konnichiwa` is first typed in the chapter 5 test. The server accepts it (H.2.a).

## 2.4 Lesson 43, A は B です (F-Grammar)

**Works**
- は read as "wa" is explained plainly, with a "spelling stays は, sound is wa" line, a mnemonic, and q3 (P7).
- Examples use only taught words (わたし, あなた, せんせい, がくせい, いしゃ, ともだち).
- Typed q4 accepts `tomodachi wa isha desu`, with or without spaces and with a full stop (checked against `exactMatch`).

**Problems found**
- **It taught lesson 44's grammar.** A whole Teach block introduced か for questions. か is lesson 44's target ("Questions with か"), so lesson 43 stole it.
- **Untaught particles as distractors** (wrong answer choices): か and を in q1, か in q2.
- **Thin checks.** Four questions and none asked what a whole sentence means, which is half of P7 ("understand and build"). This is the template for 24 more grammar lessons.
- Awkward gloss: "A, as for it, is B".

**Edits**
1. Removed the か Teach block (`To ask a question, just add か at the end...`). The core beat is intact.
2. `Think of it as 'A, as for it, is B.'` → *Think of it as 'As for A, it is B.'*
3. `です (desu)` → *です (desu, usually said like 'dess')*. With no audio, the rōmaji alone invites a two-syllable "de-su".
4. q1 choices `です, は, か, を` → *です, は, さん, あなた* (さん and あなた taught at lesson 41).
5. q2 choices `か` → *あなた*. Also `___ 。` → `___。`
6. q3 prompt `In あなた は せんせい です 。 how is は pronounced?` → *How is は pronounced in あなた は せんせい です?*
7. q4 prompt `Type this sentence in kana:` → *Type this sentence in Japanese (rōmaji is fine):*. Same keyboard reason as lesson 20, and it tells the learner "wa" will work (P7).
8. **Added q5** (multiple choice, target `ja:grammar:は`): *What does わたし は せんせい です mean?* Choices *I am a teacher. / You are a teacher. / I am a student. / My friend is a teacher.* It tests both the topic and the predicate. Existing ids are unchanged.
- Also removed the space before 。 in the three examples, so they match lesson 20's passage.

**Noted, not changed**
- さん (now a distractor), わたし, あなた, せんせい, がくせい and いしゃ come from lessons unpublished in the sample. That is the 3.3 artefact, and each is glossed where it carries meaning.

---

# 3. Corrections log entries added

Three lines appended to `tools/authoring/corrections.jsonl`, in the README format, with the **pre-edit** draft as `original_draft`. The drafter feeds the `notes` of the five most recent entries of the same type into every later draft of that type.

| Type | Note, in short |
|---|---|
| F-Kana | No spaces inside a word (こえ, not こ え). Prefer traveller words (えき) over rare ones (かき) |
| I-Reading | With no grammar taught, the passage uses only known words: no particles (と, の, を, に, が, か) and no verb forms (みて). Questions must be answerable from known words. Describe a long vowel by the held kana (おかあさん: か lasts two beats, not お-あ). Word typed checks "Read this word and type how it sounds" |
| F-Grammar | Teach only this lesson's grammar, no preview of the next point. Distractors must be taught too. Include a whole-sentence meaning check. Typed checks say "rōmaji is fine". No space before 。 |

- **No F-Vocab entry, on purpose.** The Tech Lead's lesson 19 redraft is F-Vocab and would pick it up, which muddies the test of their fix. Lesson 21's issues are also naturalness judgements I'm not sure enough of to push into every phrase lesson.
- Notes steer a model that has already ignored explicit rules: lesson 20 ignored "only the grammar listed", and lesson 19 ignored TYPED READING twice. They help, but they are not a guarantee. Section 5 has the deterministic fix.

---

# 4. Batch-quality gate (brief 3.4), so far

| Lesson | Course-rules gate | PM review: small edits only | Critic: no critical finding left | Cost (draft + critique) ≤ $0.30 |
|---|---|---|---|---|
| 2 F-Kana | Pass, 1st draft | Pass | Pass (example-feel fixed by edit 2) | Pass, $0.071 |
| 19 F-Vocab sound | **Fail, both drafts** | Not reached | Not reached | About $0.145, no usable draft |
| 20 I-Reading | Pass, 1st draft | **Pass, borderline** | Pass, but missed two real problems | Pass, $0.079 |
| 21 F-Vocab phrases | Pass, 1st draft | Pass | Pass | Pass, $0.090 |
| 43 F-Grammar | Pass, 1st draft | Pass (one added check, nothing replaced) | Pass, but missed the か preview | Pass, $0.055 |

**Ruling per type**

- **F-Kana: go.**
- **F-Vocab phrases: go.**
- **F-Grammar: go, on watch.** Lesson 43 counts as one strike, because untaught grammar got past gate and critic. A second F-Grammar draft that previews later grammar or uses untaught distractors makes the type no-go under 3.4 until the gate catches it.
- **I-Reading: go, on watch.** Lesson 20 is one strike on the same grounds. Five more I-Reading lessons (4, 8, 13, 32, 38) come before any grammar is taught, so the same flaw is likely. A second strike makes I-Reading no-go.
- **F-Vocab sound: no-go.** Lesson 19 failed the gate on both drafts. Per 3.4: fix, then sample lesson 19 once more. 22c can't draft the sound lessons until that passes.

**Overall: no full go for 22c yet.** It waits on lesson 19. Cost is not a concern: the worst lesson is $0.090, under a third of the bar, and 22b has spent about $0.44 of its $2.50 cap.

**Lesson for 22c review effort.** The Haiku critic passed lessons 20 and 43 on all nine points, though it was told the taught grammar and both broke it, and lesson 20 taught a wrong long-vowel rule. A critic pass is weak evidence of course-rule compliance. In 22c the PM will review every I-Reading and F-Grammar draft in full and skim F-Kana and phrase lessons.

---

# 5. For the Tech Lead (findings, not instructions)

1. **Gate gap: untaught particles and て-forms.** Drafts must put a space between words, so a space-separated lone particle (と, の, を, に, が, か, も, で) is a particle. The gate could reject one used before it is taught, except where a single kana is what's being taught (kana lessons and their choices). This would have caught lesson 20 (と, の) and lesson 43 (か, を) for free, and makes the I-Reading and F-Grammar strikes in section 4 preventable. みて also got past the verb-ending check. How is yours.
2. **Typed input says nothing about rōmaji.** The placeholder is "Type your answer". "Type in rōmaji or kana" would fix every typed check at once, including lessons written before this review's wording fix.
3. **Kana answer with a trailing 。 is marked wrong** (backlog N6): `ともだちはいしゃです。` fails for lesson 43 q4, while rōmaji with a full stop passes. A learner with a Japanese keyboard will hit it in a sample lesson.
4. **Example blocks print the reading twice** when `reading` equals `japanese` (lesson 20). Hide the reading line when they match.

---

# 6. What I could not verify

- **Linguistic correctness of anything**, including my own edits and the lesson 20 gloss. AI reviewing AI shares blind spots.
- Screen fit at 375pt and whether any text is cut off (P2). That's for the Alpha on the simulator.
- Whether the walker experiences the sample-artefact words (3.3) as confusing. That's for the Alpha and triage.

## 6.1 For the native-speaker sample (Blocker 6)

Ask specifically about:
1. **Word spacing with particles split off** (`わたし は いしゃ です`). The course rule and the grading of typed answers (H.2.a, H.2.b) depend on it. Children's books space by phrase (`わたしは いしゃです`). Is ours acceptable learner text or does it read as wrong?
2. **Lesson 21, who you say each greeting to:** こんにちは and こんばんは to friends and shop staff; おはようございます within family; さようなら to a teacher at day's end.
3. **Lesson 43, あなた in `あなた は せんせい です`.** It is grammatical, but real speech often uses a name instead. Should lesson 41 or 43 say so? Is "dess" a fair description of です?
4. **Lesson 20 passage and gloss**: is `ちょっと みて` natural, and is "Take a look!" a fair gloss? Is ちょっと as "a little" (q9) acceptable when the passage uses it as "for a moment"?
5. **Lesson 2 mnemonics**: nothing specific, but they were invented by the model.
