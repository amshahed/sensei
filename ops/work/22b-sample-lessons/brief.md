# Brief: five sample lessons before the full batch

Unit `22b-sample-lessons`. Written by the Project Manager, 2026-11-14. Decision logged in `decisions.md` as M.5.

---

# 1. Problem

- Only lesson 1, the hand-seeded five vowels, is published. No AI-drafted lesson has reached a learner, so nobody knows whether drafts from the 22a outline are any good.
- The full batch costs about $7 to $18 against a balance of about $19.40. If the drafter has a systematic flaw, paying for 120 lessons first would waste most of the remaining credit.
- Several systems have only been tested on fixtures: the course-rules gate, the course context in prompts, the kana-only words, the new phrase rows and the open grading of meanings. They need real lessons in a real app.

---

# 2. Users and use cases

- **Absolute beginner (primary).** Opens the app, taps Continue, and expects each lesson to follow from the last.
- **The batch decision (internal).** The team needs evidence, per lesson type, that a draft is publishable with little or no editing.

---

# 3. Decisions

## 3.1 The sample: lessons 2, 19, 20, 21 and 43

| # | Id | Type | Lesson | Why this one |
|---|---|---|---|---|
| 2 | `foundation-ja-ch01-l02` | F-Kana | The K row | Sits right after the live lesson 1, so the first steps of the walk are genuine. F-Kana is 20 lessons, the biggest single group early on |
| 19 | `foundation-ja-ch04-l05` | F-Vocab, sound | The small っ pause | The hardest sound lesson: it has to explain timing with no audio, and it uses kana cards and a no-hint typed reading (22a P2, P3). It also tests the words-only targets and long vowels (がっこう) |
| 20 | `foundation-ja-ch04-l06` | I-Reading | Reading real words with every sound | The only integration type in the sample. It is in the same chapter as 19, so it adds no extra chapter test |
| 21 | `foundation-ja-ch05-l01` | F-Vocab, phrases | Hello and goodbye | Phrase rows, when-to-say-it (22a P5), situation checks, and meanings in the learner's own words graded by AI (22a P6). It also tests `konnichiwa` (H.2.a) |
| 43 | `foundation-ja-ch08-l03` | F-Grammar | A は B です | The first grammar lesson, the template for 24 more, and the most explanatory text a non-expert team has to stand behind. It tests は read as "wa" (H.2.b) |

None needs audio.

**Rejected**
- **Three adjacent lessons (2, 3, 4).** The walk would be perfect, but it would test only the easiest type, and the expensive risks (phrases, grammar, sounds) would reach the batch unseen.
- **Lesson 49 (F-Kanji) in place of 20.** Kanji are 10 lessons, and their gate was tested on fixtures in 22a. The reading lessons are a different template (a passage, then comprehension questions), so they carry more unknown risk.
- **Lesson 120 (open self-introduction).** It depends on the whole course. The walker can't attempt it honestly after five lessons, and the open grading path was proven in 22a.
- **Redrafting lesson 1.** The seed is a known good comparison. 22c drafts it, replacing the seed in place (F.1.b).

## 3.2 What a gap in the course does, checked in code

- **Missing lessons and chapters are hidden, not blocking.** `curriculum.service.ts` drops chapters with no published lessons, and lessons are ordered by position. The walk is lesson 1 → 2 → chapter 1 test → 19 → 20 → chapter 4 test → 21 → chapter 5 test → 43 → chapter 8 test.
- **Each chapter ends with its test** (I.4.d.a). The sample has four chapters, so four tests, two of them after a single lesson. That is a sample artefact, accepted, and not counted against the design.
- **The end is handled.** With nothing left, Home says "You're through everything published so far".
- **Publishing fills the gaps later.** `authoring:publish` upserts by slug and takes positions from the outline, so lessons 3 to 18 slot in around these. No reordering, nothing deleted.
- **Cost of the gap for the walker.** Lessons 19 onward assume all kana and lessons 41 and 42 have been taught. Section 3.3 handles this.

## 3.3 How the Alpha User walks it

- Persona: the **absolute beginner**, with one stated simulation: they have learned the full hiragana chart outside the app, standing in for lessons 3 to 18. The Lead gives them the chart and says nothing else.
- At a chapter intro they choose "Start chapter", not the skip-test.
- Words a lesson relies on from unpublished lessons (わたし, せんせい in lesson 43) are a sample artefact. The Alpha reports them, and the PM sorts them in triage. They don't fail a promise unless the lesson's own target is left unexplained.

## 3.4 Draft quality gate for the batch (PM, in `content-review.md`)

The Alpha User judges the experience. The PM judges whether the batch can start.

| Check | Bar |
|---|---|
| Course-rules gate | Each lesson passes on the first or second draft |
| PM review | Approved with only small edits: no rewritten Teach beat, no replaced check |
| Critic | No critical finding left after PM review |
| Cost | Draft plus critique, measured, at most $0.30 per lesson |

- **Go for 22c** if all five pass. **Per type, no-go** if a type fails twice: fix its prompt or author note first, then sample that type once more. Other types go ahead.
- **Spending cap for this unit: $2.50** (`--max-cost`). That covers five drafts, five critiques and some redrafts.

## 3.5 Drafts here count toward the batch

- They have to be drafted from the main checkout. `skeleton.json` and the drafts are gitignored and exist only there, and 22c skips any lesson that already has a draft (F.2.a). A draft made in a worktree would be lost and paid for twice.
- An approved draft stays approved if prompts change before 22c. It is redrafted only if this unit's review says so.

## 3.6 Ruling: the beta is 18+ (M.5)

- **Yes.** The Gemini API terms (Age Requirements, read 2026-11-14) require users to be 18 or over and bar use in a service "likely to be accessed by individuals under the age of 18". Every vocabulary review now goes through the Gemini grader.
- **Cost now: none.** Both personas are adults, and the closed beta is invite-only.
- **What it means:**
  1. Invite only adults. The founder does the inviting (stop list 6).
  2. Sign-up asks for a one-tap "I am 18 or older" before the intake questions. That is a new small unit, needed before any real learner, alongside Blocker 9 billing.
  3. Rate the app for adults at store submission (founder, stop list 6).
- **Pushback on the long term:** a Japanese course is the kind of app teenagers look for. A tick box may not satisfy "likely to be accessed by", and I can't judge that legally. Before any public launch, decide between staying adult-only on purpose and moving runtime grading to a provider whose terms allow teenagers, which `LlmClient` (the shared wrapper for model calls) makes possible. Flagged for the founder at that point, under stop list 4.

---

# 4. Promises

Scored on the iOS simulator, in the walk described in 3.3.

- **P1.** From Home, tapping Continue takes me through every published lesson and each chapter test in course order. I never hit a dead end, a blank screen or an error. At the end the app tells me I'm through everything published so far.
- **P2.** Each of the five lessons teaches, lets me practise, then checks me, and fits on my phone screen with no text cut off. I can finish each one using only what it shows me. Every check tells me whether I was right and shows the right answer when I wasn't.
- **P3.** After the K row lesson, I can read か, き, く, け and こ and type how each sounds, with no hint.
- **P4.** With no sound to play, the small っ lesson makes clear in words that っ is a short pause. I can type how がっこう, きっぷ and ざっし sound (for example "gakkou") when the question shows no rōmaji, and my answer is accepted.
- **P5.** In the reading lesson I read real words with changed sounds, long vowels and っ, and type how they sound with no hint. Every word in it is made of sounds I have learned.
- **P6.** The hello and goodbye lesson tells me when and to whom to say each of its five phrases. At least one question gives me a situation and I pick the right phrase. If I'm asked to type こんにちは, "konnichiwa" is accepted.
- **P7.** After the A は B です lesson I can understand and build sentences saying who or what someone is. The lesson tells me this は is said "wa", and "wa" is accepted when I type it. No Japanese in the lesson is left unexplained, apart from the words in 3.3.
- **P8.** In a chapter test, when I'm asked what a phrase or grammar point means, a correct answer in my own words is accepted and a wrong one isn't.
- **P9.** I never see a kanji anywhere in the sample: lessons, cards, checks or chapter tests.
- **P10.** Tapping a recap card always shows me something new: the sound for a kana, the meaning for a word or a grammar point.

---

# 5. Out of scope

- The other 115 lessons (22c). Audio, speaking and listening (Blocker 2).
- Whether the Japanese is linguistically correct. PM approval means fit for closed beta only (OM.1, Blocker 6).
- Building the 18+ confirmation (new unit, M.5).
- Reviews spaced over days. The walk takes one sitting, so P8 is scored in chapter tests, which ask the same question as reviews (G.4.a).

---

# 6. Notes for the Tech Lead

- Draft, critique, review and publish from the main checkout (3.5). Publishing adds rows on live Neon and replaces nothing, because the seed lesson 1 isn't touched.
- **The walker's progress outlives the run.** After the Alpha, chapters 1, 4, 5 and 8 are passed for the dev user. When 22c publishes lessons 3 to 18, they will show as skipped for that user (`curriculum-state.ts`: an unfinished lesson in a passed chapter). There are no real learners, so nothing is harmed, but the 22c Alpha run needs a fresh learner. How is yours to decide.
- Record the measured tokens and cost per lesson in `dev.md`. 22c's Batches API estimate depends on it.
