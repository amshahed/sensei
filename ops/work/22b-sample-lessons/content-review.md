# Content review: 22b sample lessons

Unit `22b-sample-lessons`. Written by the Project Manager, 2026-11-14. Reviews the drafts in `tools/authoring/output/` against `brief.md`.

**What approval means.** Fit for closed beta: tone, flow, naturalness, whether a beginner can follow it, and whether it keeps the brief's promises. It does **not** mean linguistically verified (hard constraint, OM.1). Every lesson here goes to the native-speaker sample (Blocker 6) before wider beta.

---

# 1. Verdicts

| # | Lesson | Type | Verdict | Edits |
|---|---|---|---|---|
| 2 | `foundation-ja-ch01-l02` The K row | F-Kana | **APPROVE WITH CORRECTIONS** | 3, all small |
| 19 | `foundation-ja-ch04-l05` The small っ pause | F-Vocab, sound | **APPROVE WITH CORRECTIONS** | 12 wording edits: 2 in Teach, 10 check explanations the app doesn't show yet. Reviewed after `--recheck`, see section 7 |
| 20 | `foundation-ja-ch04-l06` Reading real words | I-Reading | **APPROVE WITH CORRECTIONS** | 10 small, incl. 1 added gloss block. Borderline, see 2.2 |
| 21 | `foundation-ja-ch05-l01` Hello and goodbye | F-Vocab, phrases | **APPROVE WITH CORRECTIONS** | 5 wording edits |
| 43 | `foundation-ja-ch08-l03` A は B です | F-Grammar | **APPROVE WITH CORRECTIONS** | 8, incl. 1 removed block and 1 added check. Most edited |

- Nothing is sent back. Every flaw was fixable by hand for less risk than a redraft, which with no `temperature` would give a different lesson with different flaws.
- Three systematic flaws went into `tools/authoring/corrections.jsonl` (section 3), so 22c drafts of those types are steered away from them. A fourth, for sound lessons, was added with lesson 19 (section 7.4).
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

- **No F-Vocab entry at first, on purpose.** The Tech Lead's lesson 19 redraft is F-Vocab and would pick it up, which muddies the test of their fix. Lesson 21's issues are also naturalness judgements I'm not sure enough of to push into every phrase lesson. *Update:* lesson 19 was recovered by `--recheck` with no redraft, so an F-Vocab entry for sound lessons now exists (section 7.4). It still says nothing about phrase lessons.
- Notes steer a model that has already ignored explicit rules: lesson 20 ignored "only the grammar listed", and lesson 19 ignored TYPED READING twice. They help, but they are not a guarantee. Section 5 has the deterministic fix.

---

# 4. Batch-quality gate (brief 3.4), all five lessons

| Lesson | Course-rules gate | PM review: small edits only | Critic: no critical finding left | Cost (draft + critique) ≤ $0.30 |
|---|---|---|---|---|
| 2 F-Kana | Pass, 1st draft | Pass | Pass (example-feel fixed by edit 2) | Pass, $0.071 |
| 19 F-Vocab sound | **Failed both drafts; 2nd passes after the F.2.b code fix**, via `--recheck` at $0 | Pass (12 wording edits, nothing rewritten or replaced) | Pass, but missed the untaught typing rule | Pass, about $0.15 for both drafts and the critique |
| 20 I-Reading | Pass, 1st draft | **Pass, borderline** | Pass, but missed two real problems | Pass, $0.079 |
| 21 F-Vocab phrases | Pass, 1st draft | Pass | Pass | Pass, $0.090 |
| 43 F-Grammar | Pass, 1st draft | Pass (one added check, nothing replaced) | Pass, but missed the か preview | Pass, $0.055 |

**Ruling per type**

- **F-Kana: go.**
- **F-Vocab phrases: go.**
- **F-Grammar: go, on watch.** Lesson 43 counts as one strike, because untaught grammar got past gate and critic. A second F-Grammar draft that previews later grammar or uses untaught distractors makes the type no-go under 3.4 until the gate catches it.
- **I-Reading: go, on watch.** Lesson 20 is one strike on the same grounds. Five more I-Reading lessons (4, 8, 13, 32, 38) come before any grammar is taught, so the same flaw is likely. A second strike makes I-Reading no-go.
- **F-Vocab sound: go, on watch** (was no-go; updated after the lesson 19 review in section 7).
  - *The gate failure is fixed at its cause.* Both rejections were recall prompts on the typed checks. Code now owns that wording (F.2.b), so it can't recur in lessons 15 to 18. I accept the Tech Lead's view that a fresh paid draft would add no evidence on it. The `--recheck` of lesson 19 counts as 3.4's "sample once more".
  - *No strike.* The one real content gap, no rule for typing っ, traces to my own 22a author note ("rōmaji only in the cards"), not to the drafter. The drafter's `kkou` was the right instinct. The other flaws are in explanations the app doesn't show yet.
  - *On watch* because only one sound lesson has been reviewed, and it's the one whose typing differs from its cards. Lessons 15 to 18 (and 39, katakana sounds) get a full PM review in 22c. If one needs a rewritten Teach beat or a replaced check, the rest of the type stops for a prompt fix before it's published.

**Overall: go for 22c.** All five types pass the 3.4 bar. Three are on watch (F-Grammar, I-Reading, F-Vocab sound), and none has a second strike. The four corrections entries are in place. Cost is not a concern: the worst lesson is about $0.15 including a wasted draft, half the bar. 22b has spent about $0.45 of its $2.50 cap.

**What does not block 22c drafting:** the Tech Lead's particle-gate backlog (`test.md` N1, N2) and the mobile items in section 5. PM review is the backstop for the first, and the second changes the app, not the drafts. Section 5 item 5 should still land before the 22c Alpha run, because it decides whether a learner who misses a reading check ever sees the right rōmaji.

**Lesson for 22c review effort.** The Haiku critic passed lessons 20 and 43 on all nine points, though it was told the taught grammar and both broke it, and lesson 20 taught a wrong long-vowel rule. It also passed lesson 19 on `learner-confusion`, though the lesson asked the learner to type something it never taught. A critic pass is weak evidence. In 22c the PM will review every I-Reading, F-Grammar and sound-lesson draft in full, and skim F-Kana and phrase lessons.

---

# 5. For the Tech Lead (findings, not instructions)

1. **Gate gap: untaught particles and て-forms.** Drafts must put a space between words, so a space-separated lone particle (と, の, を, に, が, か, も, で) is a particle. The gate could reject one used before it is taught, except where a single kana is what's being taught (kana lessons and their choices). This would have caught lesson 20 (と, の) and lesson 43 (か, を) for free, and makes the I-Reading and F-Grammar strikes in section 4 preventable. みて also got past the verb-ending check. How is yours.
2. **Typed input says nothing about rōmaji.** The placeholder is "Type your answer". "Type in rōmaji or kana" would fix every typed check at once, including lessons written before this review's wording fix.
3. **Kana answer with a trailing 。 is marked wrong** (backlog N6): `ともだちはいしゃです。` fails for lesson 43 q4, while rōmaji with a full stop passes. A learner with a Japanese keyboard will hit it in a sample lesson.
4. **Example blocks print the reading twice** when `reading` equals `japanese` (lesson 20, and all five examples in lesson 19). Hide the reading line when they match.
5. **A missed reading check shows the kana the learner just failed to read** (your own `tech.md` section 7). After a miss on lesson 19 q8 the app says `Answer: きっぷ`, never "kippu". Lesson 19's typed explanations now carry the rōmaji (`In rōmaji, きっぷ is kippu: the っ doubles the p`), so showing `explanation` after a miss would fix this for every reading check that has one. How is yours. I'll rule on priority in triage, but I want it before the 22c Alpha run.

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
6. **Lesson 19, describing っ with no audio.** Is "a short silent beat" fair for いっしょ and ざっし, where the beat may be a held s-sound rather than silence? Is "then hit the next sound a bit harder" helpful, or does it push English speakers toward stress? Is "がっこう has four beats: が, っ, こ, う" an accurate way to count it?

---

# 7. Lesson 19, The small っ pause (F-Vocab, sound)

Reviewed 2026-11-14, after `--recheck` (F.2.b) rewrote its five typed prompts to `Read this word and type how it sounds: <word>`. Draft: `tools/authoring/output/foundation-ja-ch04-l05.json`. The critic passed it on all nine points.

**Verdict: APPROVE WITH CORRECTIONS.** 12 wording edits. No Teach beat rewritten, no check replaced, and the prompts are untouched, because code owns them.

## 7.1 Works

- The shape suits a silent sound lesson: what っ is (a small つ with no sound of its own), the one rule, a kana card (っ / short pause), one worked word, the five words, then a mnemonic. The player skips the audio block, as intended.
- P4's "makes clear in words that っ is a short pause" is met four times: in the first text block, the rule block, the card and the mnemonic ("a speed bump").
- The checks alternate meaning (multiple choice) and reading (typed) for each word. Every distractor is a word from this lesson, and the five typed prompts show only kana.
- The mnemonic's "がっこう turns into 'gakou'" is a good contrast: one k means no pause.
- There's no kanji in any learner-facing field (P9). Every word is built from sounds taught in lessons 15 to 18 (ざ, ぷ, しょ, ちょ, long おう) plus っ.

## 7.2 The Tester's question: does "ga … kkou" help or confuse?

**The lesson has to spell a worked word out. This spelling only half helps, so I changed it.**

- **Why it's necessary.** The check accepts rōmaji (wanakana, the library the grader uses to fold rōmaji into kana, turns `kippu` into きっぷ), and cards are the only place the course gives rōmaji. Every other sound in lessons 15 to 18 has a card that says how to type it (が = ga, しょ = sho). っ has no rōmaji of its own, and its card says "short pause". The doubled letter is a convention a learner can't work out. Without one worked example, q4 to q10 ask for something the lesson never taught.
  - My 22a author note caused this. "Write the sound in rōmaji only in the cards" didn't foresee a sound with no rōmaji. The drafter broke the note, and it was right to.
- **Why this spelling confuses.**
  1. It mixes a sound description with a spelling rule. `kkou` after a pause reads as a doubled, harder k, and the same sentence said "then say the next sound strongly". A learner takes away force, not timing.
  2. It never says why there are two k's, so the learner has to guess the typing rule.
  3. Rōmaji used as a pronunciation guide invites English readings: "kou" can come out as "cow".
  4. A split form copied into the answer box fails. Wanakana turns `ga-kkou` into がーっこう and `gak kou` into がk こう. `ga kkou` happens to pass.
- **What replaced it.** The sound is given in kana and beats, and the rōmaji once, unbroken, as the typed form: *Take がっこう (school). It has four beats: が, っ, こ, う. Say が, stay silent for one beat on っ, then say こう. In rōmaji, a small っ doubles the next letter, so you type がっこう as gakkou.*
  - "Beats" is already the course's timing word (lesson 18's note, lesson 20's approved text). It frames っ as time, which is the point.
- **The other four words get no rōmaji in Teach.** The learner applies the rule to きっぷ and ざっし, which is what P4 tests. Each follows from the rule and earlier cards:
  - き + っ + ぷ (pu) = kippu
  - ざ (za) + っ + し = zasshi
  - い + っ + しょ (sho) = issho
  - ちょ (cho) + っ + と = chotto
  - All five are accepted by the grader.

## 7.3 Edits

1. Teach block 1: `Have you noticed the tiny っ inside some words?` → *Some words have a tiny っ inside them.* The learner hasn't seen っ yet (22a P1), so the question invites the answer "no".
2. Teach block 4: the worked example above. It replaces `Pause where the っ sits, then say the next sound strongly: がっこう (school) — say 'ga', pause, then 'kkou'.`
3. to 7. Typed explanations q2, q4, q6, q8 and q10. Each opened with praise (`Nice!`, `Perfect!`) and gave no rōmaji. The explanation is the only field that can tell a learner who missed what to type, and praise is wrong after a miss.
   - Now *In rōmaji, がっこう is gakkou: the っ doubles the k.* The others follow the same pattern: issho (s), chotto (t), kippu (p), zasshi (s).
8. to 12. Multiple-choice explanations q1, q3, q5, q7 and q9. Each spelled out the word's rōmaji (`ki-(pause)-ppu`) one question before the typed check that asks for it. The 22a triage rejected that pattern: the answer one tap before a check.
   - Now they give the meaning only: *きっぷ means 'ticket'.*

- **Edits 3 to 12 are invisible today**, because the app doesn't show `explanation` (section 5 item 5). They are published, though, so I fixed them now. The change that shows them should find correct text.
- **Not changed:**
  - The practice hints still spell out `ki-(pause)-ppu`. They are never published or shown, so they cost nothing.
  - "Hit the next sound a bit harder" stays in the rule block. It's a common simplification and I can't judge it, so it goes to the native speaker (6.1 item 6).
- **Verified after editing** (offline, no API spend):
  - It parses against `LessonDraftSchema`.
  - It passes `validateStructure` and `checkCourseRules` with zero errors and zero warnings, the same as before.
  - The typed-reading transform leaves it unchanged, so a later recheck or publish won't touch it.
  - It has 10 questions and no kanji in learner-facing fields.
  - The pre-edit draft is kept in the corrections entry and the session scratchpad.

## 7.4 Corrections log

I added one F-Vocab line, scoped to "a sound lesson with typed reading checks" so that phrase lessons aren't affected. In short:
- Timing in beats, and sound in kana.
- Rōmaji only in cards, except one worked example for a sound with no rōmaji of its own.
- Typed explanations give the rōmaji answer and no praise.
- No rōmaji in other explanations or hints.
- No "Have you noticed" about a sound not yet taught.

The next F-Vocab drafts are lessons 15 to 18, all sound lessons.

## 7.5 P4, and what the Alpha should watch

- **P4 is met on the page.**
  - "っ is a short pause" is said in words four times.
  - The typed prompts show kana only.
  - The typing rule is stated once, with one example.
  - `gakkou`, `kippu` and `zasshi` are accepted.
- **Risk 1: a miss teaches nothing.** The app shows `Answer: きっぷ`. A learner who typed `kipu` sees the kana they misread and no rōmaji (section 5 item 5).
- **Risk 2: macrons.** `gakkō` is rejected. The lesson never shows a macron, so I accept this.
- **Risk 3: kana twice.** Each example prints the word twice (section 5 item 4). It looks odd but isn't confusing.

## 7.6 What I could not verify

- Whether any description of っ in words lets a beginner produce the sound. Without audio, this lesson can teach the rule and the typing, but not the sound. That's Blocker 2, acceptable for alpha only.
- Whether "silent beat", "harder" and "four beats" are linguistically accurate (6.1 item 6).
