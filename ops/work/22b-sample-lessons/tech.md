# Tech plan: typed reading on sound lessons, the particle gap, N6

Unit `22b-sample-lessons`. Written by the Tech Lead, 2026-11-14, against `main` at `0625966`. Inputs: `brief.md`, `content-review.md`, the 2026-11-14 entry in `ops/journal.md`.

In the Lead's priority order:
1. **Blocking:** lesson 19 rejected twice because its typed checks were recall from English, not reading.
2. Untaught particles passed the gate and the critic in lessons 20 and 43.
3. N6: a kana answer that differs only by punctuation is marked wrong.

**Evidence.** From an offline spike: scratchpad scripts, no repo change, no API call.

| Fact | Result |
|---|---|
| Lessons with `typedReading` in the outline | 6, lessons 15 to 20. Lesson 20 is live, 15 to 18 aren't drafted, 19 is rejected. Lesson 39 (katakana sounds) has the flag off. **5 lessons are exposed, not 7** |
| Why lesson 19 failed | All 5 typed checks have the right `correctAnswer` (the word in kana) and a recall prompt ("Type the kana word that means 'school'"). Nothing else in the draft breaks a rule |
| Transform (1.1) on the rejected draft | Gate errors go from 5 to 0. It rewrites q2, q4, q6, q8 and q10 in place and keeps their explanations. Running it a second time changes nothing |
| Transform on the 4 approved drafts | No change |
| Particle rule (1.2) on the 4 approved drafts | Lessons 2, 21 and 43 are clean. Lesson 20 fails: と and の in its passage, の in q5's explanation |
| Particle rule on the PM's pre-edit originals | Lesson 20: と, の. Lesson 43: か in the preview block, か and を as q1 distractors, か in q2. Every untaught-particle finding in `content-review.md`. It doesn't catch みて |
| Particle rule on 16 hand-made cases | Every case gave the expected result: kana rows, sound-lesson text, English mentions and a known phrase written across spaces all pass. The one-kana known-word exemption is specified below but wasn't spiked |
| Grader on the rōmaji of all 30 typed-reading targets (wanakana) | 30 of 30 accepted |
| N6 | `ともだちはいしゃです。` against stored `ともだち は いしゃ です` is wrong. **Also wrong:** `わたしはがくせいですか` against `… です か？`, so any stored ？ or ！ breaks a kana answer. Rōmaji is unaffected |
| Does the app show `explanation`? | **Never.** A wrong answer shows `Answer: <correctAnswer>` (`LessonPlayer.tsx`) |

---

# 1. Approach

## 1.1 Typed reading: the pipeline owns the check (F.2.b)

The model got the hard part right twice (the right word and the right answer) and the mechanical part wrong twice (the prompt wording). The wording is a fixed string, so code should write it.

**`addTypedReadingChecks(draft, ctx)`**, a pure function, runs after the model returns and before the validator and the gate, only when `ctx.typedReading`. For each target word:
1. **A fair typed check exists**, judged by the gate's own test (the prompt shows the word and has no rōmaji). The draft is left alone. Lesson 20 is this case.
2. **Otherwise, a closed typed check on the target has the word as its `correctAnswer`.** Its prompt is rewritten in place to `Read this word and type how it sounds: <word>`, the PM's approved wording from lesson 20. Id, position and explanation stay. Lesson 19 is this case.
3. **Otherwise**, append `{ id: next free qN, targetItemId, that prompt, answerType: "typed", correctAnswer: <word>, explanation: "<word> is read \"<rōmaji>\"." }`. The rōmaji comes from wanakana, the library the grader already uses, so it is always an accepted answer.

- The gate's typed-reading rule stays as the safety net for hand edits and at publish. Its fairness test becomes one exported function that both the gate and the transform use, so they can't drift apart.
- The prompt line at `lesson-prompter.ts:151` stays. It costs nothing when the model follows it (lesson 20).
- Typed reading can now never fail the gate for lessons 15 to 19, at no cost per draft.

**`--recheck` recovers a paid rejected draft at $0.** `authoring:draft <slug> --recheck` makes no model call. For each lesson with a `<id>.rejected.json`, it drops `courseRuleErrors`, applies the transform, and reruns the validator and the gate through the same code path as a fresh draft. A pass is written exactly as a fresh pass is. A fail rewrites the rejected file with the new errors. Lesson 19's second draft passes this way, so it reaches review without a third paid draft. In 22c it recovers any rejections that a later code fix cures.

**Rejected**
- **Stronger prompt wording, then redraft.** About $0.07 per try (lesson 19's draft was 2,078 tokens in and 2,501 out on Opus 4.8), and the model already ignored a clear instruction twice.
- **Always drop the model's typed checks and append the pipeline's.** It loses their position and explanations, and tests a word twice when the model's check was already fair.
- **Generate every check in code for sound lessons.** Larger, and the model's meaning checks were fine.
- **A retry loop inside `authoring:draft`.** It pays for every retry and guarantees nothing.

## 1.2 Particles: reject an untaught particle standing alone in Japanese (F.2.c, amends F.2.a)

F.2.a left particles to review because kana "can't be told apart mechanically". The course rule that every word is spaced changes that for a particle that stands alone. The PM's idea is right, but used literally it would reject good drafts. It needs one guard.

**Rule A, every learner field.** Split the text on whitespace and strip punctuation from each token. A token that is exactly an untaught particle is an error **when a neighbouring token is a kana word of two or more characters**.
- The neighbour condition separates a use in Japanese (`ともだち と がっこう`) from a mention in English (`the little word と (and)`) and from a kana row (`は ひ ふ へ ほ`). So kana and sound lessons need no exemption. **This was wrong. Rule A is replaced in Round 1, R1.1.**
- Known words and taught grammar surfaces count as words and aren't inspected, including when written across spaces (`おげんき です か` at lesson 24). This follows H.2.b and reuses `maskKnown`. A known word of one kana is spared too: に means "two" from lesson 65.

**Rule B, choices and closed answers.** In a lesson with no kana targets and no kana cards, a choice or a closed `correctAnswer` that is exactly an untaught particle is an error. This catches lesson 43's distractors. Kana and sound lessons are left out because their choices are characters.

**When a particle counts as taught:** once any of its grammar items is in `ctx.grammar`.

| Particle | Taught by item (lesson) |
|---|---|
| は | `は` (43) |
| か | `か` (44) |
| の | `の` (46) |
| も | `も` (53) |
| が | `があります` (74), `がいます` (75), `がすきです` (116) |
| に | `に` (81), `にへ` (90) |
| を | `を` (89) |
| へ | `にへ` (90) |
| で | `で` (91) |
| な | `な-adjective` (111) |
| と | `と` (112) |
| ね, よ, や, から, まで | Never taught in the slice |

**An error, not a warning.** Using a particle early breaks the course rules exactly as using ます before lesson 87 does. F.2.a's gate exists so that review never picks up such a draft. A warning would still send every case to PM hand-editing, and each one counts as a strike under brief 3.4. A rejection costs one draft (about $0.05 to $0.09) and no PM time. Two cheap measures make rejections cheaper:
- **A redraft is told why the last draft failed.** When `--force` redrafts a lesson that has a `.rejected.json`, its `courseRuleErrors` go into the prompt: "Your last draft of this lesson was rejected for: … Fix every one." Today a redraft is blind, which is why lesson 19 failed the same way twice.
- **Run `--recheck` first** whenever a code change could cure the rejection.

**What it still misses.** The critic and PM review remain the backstop, and the PM keeps full review of I-Reading and F-Grammar (`content-review.md` section 4).
- A particle joined to a word (`ともだちと`).
- Verb forms such as みて. Without morphological analysis, which F.2.a rejected, a て-form can't be told apart from a word that ends in て (すべて, はじめて).
- The particle に in lessons 65 to 80, hidden by the number に. Accepted, because the alternative rejects lesson 65 itself (`いち に さん`) on every draft.
- A preview written only in English.

**Lesson 20, as published, fails the new rule** (と and の in its passage). Its live rows are untouched, and nothing republishes it. But `authoring:publish foundation-ja-ch04-l06` will now refuse until the passage is revised. That is correct, because the gloss was a workaround for exactly this break. **For the PM:** whether and when to revise it. Not blocking.

**Rejected**
- **Warning only** (reasons above).
- **The PM's literal rule: any lone particle, with no neighbour condition.** It rejects every kana row containing は or へ, every sound lesson that says "turn か into が", and the PM's own lesson 20 gloss.
- **Every Japanese token must be a known word.** It is the strongest rule, but conjugations, numbers with counters and names make false positives likely. Revisit once 22c shows what still gets through.
- **Asking the critic harder.** It was told the taught grammar and still passed both lessons on all nine points.

## 1.3 N6: ignore punctuation when comparing typed answers (H.2.c), in this PR

- `WritingEvalService.exactMatch` strips `、。,.!?！？` from both normalised strings before comparing. The rōmaji path (`matchesSpoken`) already does this.
- **It belongs in this fix.** Lesson 43's q4 is live, and the fix is about two lines plus tests in one function. A separate unit would need its own Developer and Tester runs, and agent usage is the scarce resource (`ops/CHECKPOINT.md`).
- **It can't make a right answer wrong.** Strings that were equal stay equal after the same characters are removed from both. The change only adds answers that differ by punctuation. A wrong kana stays wrong (`わ。` for は on a kana target).
- Chapter tests and reviews get the fix too, because they call the same `exactMatch` (`recall-grader.service.ts`).

**Rejected:** a separate unit, for the cost reason above.

---

# 2. Changes

Everything is in `apps/api`. No mobile change, so the PR needs no bundle check or simulator run. No new dependency.

| File | Change |
|---|---|
| `src/authoring/course-rules.ts` | Export `isFairTypedReading(question, surface)`, used by `typedReadingProblems`. Add the particle table and Rules A and B to `checkCourseRules` |
| `src/authoring/typed-reading.ts` (new) | `addTypedReadingChecks(draft, ctx): LessonDraft`. Pure and idempotent: a second run changes nothing |
| `src/authoring/draft.ts` | Apply the transform after `generateDraft`. Extract the shared validate, gate and write step, so a fresh draft and `--recheck` take one path. Add the `--recheck` flag, refused alongside `--force`. On a `--force` redraft, read `courseRuleErrors` from an existing `.rejected.json` |
| `src/authoring/lesson-prompter.ts` | `buildDraftPrompt` and `generateDraft` take an optional `previousErrors: string[]` and add the rejection block when it's present. The prompt is otherwise unchanged |
| `src/writing-eval/writing-eval.service.ts` | Strip punctuation in `exactMatch` |
| `tools/authoring/README.md` | Document `--recheck` and the redraft feedback |

**Contracts.** `LessonDraftSchema` and the signature of `checkCourseRules` are unchanged. The options of `runDrafts` gain `recheck?: boolean`, and `DraftRunSummary` gains `rechecked: number`.

---

# 3. Data

- **No schema change and no migration. The PR changes no live data.** N6 changes grading behaviour only.
- **After merge**, publishing lesson 19 adds one lesson with its lesson items and checks, upserted by slug. That is additive and pre-approved under OM.1. No other lesson is republished.
- **How it's tested.** Unit tests run in CI. The drafts are gitignored and exist only in the main checkout, so CI can't see them. The Developer reads them by absolute path from the worktree, without copying them, runs the new gate over `tools/authoring/published/*.json` and the transform over those 4 drafts and lesson 19's rejected draft, and records the output in `dev.md`. The expected results are in the evidence table.
- **Rollback:** revert the PR. Once lesson 19 is published, it is corrected by republishing, never deleted. Deleting live rows is on the stop list.

---

# 4. Promise map

Only the brief's promises this plan touches are mapped to code. The rest are untouched and are proven by the Alpha run.

| Promise | Implementation | Test that proves it |
|---|---|---|
| **P4** (small っ: type がっこう, きっぷ and ざっし with no rōmaji shown, and be accepted) | Transform (1.1), then `--recheck` on lesson 19 | `typed-reading.spec.ts`: lesson 19's recall checks become reading checks in place, pass the gate, and stay the same on a second run. `draft.spec.ts`: a recall-style reply is saved as a draft, not rejected. Rōmaji test: every typed-reading target is accepted. Then PM review and the Alpha run |
| **P5** (reading lesson: type how words sound, no hint) | The transform leaves lesson 20's fair checks alone and protects future reading lessons | `typed-reading.spec.ts`: a fair check is left alone. The same rōmaji test |
| **P2** ("I can finish each one using only what it shows me") | Rules A and B: no untaught particle in a new draft | `course-rules.spec.ts`, cases in Task 3 |
| **P7** (A は B です: no Japanese left unexplained, and "wa" accepted) | Rules A and B for grammar drafts. N6 for kana answers with 。 | `course-rules.spec.ts` lesson 43 cases. `writing-eval.service.spec.ts` N6 cases |
| P1, P3, P6, P8, P9, P10 | Not touched. The kanji rules behind P9 are unchanged | Alpha run |

---

# 5. Risks

| Risk | What would show it | Response |
|---|---|---|
| The particle rule rejects a good draft | A `.rejected.json` whose only errors are particle errors on a mention, not a use | The Lead reads the rejected file before any redraft, which is free. Tighten the rule, then `--recheck` at $0 |
| Untaught grammar still gets through (joined particles, て-forms, に in lessons 65 to 80) | PM review | The PM keeps full review of I-Reading and F-Grammar |
| The transform turns a recall check the model meant into a reading check | PM review of lesson 19 | Accepted. In a `typedReading` lesson the reading check is the requirement |
| Redraft feedback makes the model overcorrect elsewhere | PM review of the redrafted lesson | It's only used after `--recheck` fails. Remove the block if it misbehaves |
| Republishing lesson 20 is refused | An `authoring:publish` error | Expected. The PM decides about the passage |
| N6 accepts something it shouldn't | Can't happen by construction | Tests pin the kana-target rejections |

---

# 6. Tasks

One PR on branch `fix/22b-typed-reading-gate`, from a worktree. One commit per task, in this order.

1. **Typed-reading transform.**
   - Export `isFairTypedReading` from `course-rules.ts` and use it in `typedReadingProblems`. The existing tests stay green unchanged.
   - Add `typed-reading.ts` and `typed-reading.spec.ts`, building fixtures from the compiled outline as `course-rules.spec.ts` does. Cases:
     - Lesson 19's recall-style typed checks are rewritten in place, keeping id and explanation.
     - A target with no typed check gets one appended, with a unique id.
     - A fair check is left alone.
     - A lesson without `typedReading` is unchanged.
     - An open typed check is never rewritten.
     - The result passes `checkCourseRules` with no typed-reading error, and a second run changes nothing.
   - Rōmaji test: for every `typedReading` lesson in the outline, `toRomaji(surface)` passes `WritingEvalService.exactMatch` for each target, with the tokenizer loaded.
   - Call the transform in `runDrafts` before the validator and the gate. In `draft.spec.ts`, a recall-style reply for a `typedReading` lesson is written to `<id>.json`.
2. **`--recheck`.** Extract the shared validate, gate and write step. Tests:
   - A rejected draft shaped like lesson 19's becomes `<id>.json` with no model call and $0 spent.
   - A rejected draft that still fails stays rejected, with its errors updated.
   - A lesson with no rejected file is skipped.
   - `--recheck` together with `--force` is refused.
3. **Particle rule.** In `course-rules.spec.ts`:
   - **Rejects** (lesson number in brackets): `ともだち と がっこう` (20, と). `おかあさん の しゃしん` (20, の). `あなた は せんせい です か` (43, か). Choices `か` and `を` (43). `そう です ね` (24, ね).
   - **Accepts:** the same か sentence (44). `わたし の ほん` (46). `へや に いぬ が います` (83). `か き く け こ` (2). `は ひ ふ へ ほ` (7). `Two small marks turn か into が` (15). Choices `が, か, ざ, さ` (15). `The little words と (and) and の ('s)` (20). `おげんき です か` (24). `いち に さん` (65).
   - Run the gate over `tools/authoring/published/*.json` and record the result in `dev.md`. Expected: 2, 21 and 43 clean, and 20 failing on と and の only.
4. **Rejection reasons in the redraft.**
   - `lesson-prompter.spec.ts`: the block appears when there are errors and not otherwise.
   - `draft.spec.ts`: a `--force` redraft of a lesson that has a `.rejected.json` sends its errors in the request.
5. **N6.** In `writing-eval.service.spec.ts`, on both tokenizer paths:
   - Accept `ともだちはいしゃです。` for `ともだち は いしゃ です`, and the reverse.
   - Accept `わたしはがくせいですか` for `わたし は がくせい です か？`.
   - On a kana target, accept `は。` for `は`, and still reject `わ。` for `は` and `wa` for `は。`.
   - The existing lists stay green.
6. **Wrap-up.** Update the README. Run `pnpm typecheck && pnpm lint && pnpm test`. Write `dev.md` with the local results from Tasks 1 and 3.

**After merge (Lead, main checkout per brief 3.5).** About $0.01 of the roughly $2.06 left in the 22b cap.
1. `authoring:draft foundation-ja-ch04-l05 --recheck` ($0).
2. `authoring:critique` on the result (about $0.01).
3. PM review of lesson 19, then publish.
4. Only if the PM sends it back on content: redraft with `--force --max-cost 0.3` (about $0.08). The redraft now carries its rejection reasons.

**For the PM's per-type ruling (3.4), technical view only:** typed reading can no longer fail, so a fresh sound-lesson draft adds no evidence on it. The content quality of lessons 15 to 18 is covered by PM review in 22c.

---

# 7. Not in this plan (for the PM)

- **The app never shows `explanation`.** After a miss, the learner sees `Answer: がっこう`, the kana they just failed to read, not "gakkou". The PM's explanation edits in lesson 20 are invisible to learners. This bears on P2 ("shows the right answer") and on P4. Small mobile unit, a candidate for triage.
- **Placeholder "Type in rōmaji or kana" and hiding a duplicate reading line** (`content-review.md` 5.2 and 5.4). These are small mobile changes, kept out so this PR stays API-only.
- **Lesson 39 (katakana sounds) has `typedReading` off.** If the PM wants no-hint typed reading there too, it's one flag in the outline spec, and the transform then covers it.
- **Lesson 20's passage** now breaks the gate (1.2).

---

# Round 1 findings (Tester FAIL on `b16f481`, PR #74)

Tech Lead, 2026-11-14. Inputs: `test.md` round 1 and the open question in `dev.md` (review finding 4).

| # | Ruling |
|---|---|
| **F1** High | **Accepted. My premise in 1.2 was wrong.** Rule A is replaced (R1.1). It needs no lesson-type exemption |
| **F2** Low | **Fix.** The transform appends only for targets the draft declares (R1.2) |
| **F3** Low | **Fix.** Answers are compared without punctuation (R1.3) |
| F4, F5 | Justified as in `dev.md`. No change |
| Observation: untaught particles absent from the first-draft prompt | **Yes** (R1.4) |
| Observation: partial rōmaji in a model-written reading prompt | **Deferred.** It isn't lesson 19's case, and the PM reviews every sound lesson. Closing it means the gate forbids any Latin beyond the fixed wording, which would also bind the PM's hand edits. Revisit if a 22c review finds one |
| Observation: particles next to kanji words | **Not extended** (R1.1, rejected options) |
| Observations for the PM and the Lead (N6 character set, `sync-state.sh`) | Theirs |

## R1.1 Rule A, replaced

**Why the first version failed.** It looked at both neighbours and ignored punctuation. In a kana lesson the target kana sits right before its example word (`と そと`, `で: でんわ`) or right after a word in which it's being pointed out (`はな, は`). Two facts separate those from a real use:
- A Japanese particle comes after the word it marks, never before it.
- A sentence doesn't run through a colon, comma, bracket or English word.

**The rule:**
1. Split each learner field into **stretches**: maximal runs of kana (`ぁ-ゖ`, `ァ-ヺ`, `ー`) and whitespace. Any other character ends a stretch: punctuation, symbols, Latin letters, digits and kanji.
2. In each stretch, mask known phrases as the PR does today: whole words, across spaces, keeping the guards from deviations 3 and 11. A masked phrase counts as a word.
3. Split the stretch on whitespace. A token that is exactly an untaught particle, and is not itself a known word (に, "two", from lesson 65), is an error only when both of these hold:
   - **(a)** the token before it in the stretch is a word: a masked phrase, or two or more kana;
   - **(b)** the token after it, if there is one, is not a single kana. A row after a word, such as `こえ か き く け こ`, is a listing, not a sentence.
4. The message quotes the trimmed stretch: `uses the particle と before it is taught, in "ともだち と がっこう"`. A redraft then sees the exact phrase to fix, and the Lead can tell a use from a mention without opening the file.

- Rule B is unchanged.
- Deviation 4 (a punctuation-only token stays as a non-word) is subsumed, because punctuation now ends the stretch.

**Evidence.** Offline spike of exactly this rule, in the scratchpad, with no repo change:
- **37 of 37 cases come out as expected:** the Tester's 9, every case in Task 3, and 12 new ones (R1.5).
- **The real drafts give the same results as on `b16f481`:**
  - Lessons 2, 21 and 43 are clean.
  - Lesson 20 has the same 3 errors.
  - Lesson 20's original is still caught on と and の.
  - Lesson 43's original is still caught: its preview `あなた は いしゃ です か 。` by Rule A, its distractors by Rule B.
  - Lesson 19's rejected draft is clean.

**Rejected**
- **Exempt Rule A in lessons with kana targets** (the Developer's option). It leaves lessons 15 and 16 exposed, because が and で are cards there, not targets. It also drops lessons 4, 8 and 13, where the PM expects real particle use (`はな と ひと`).
- **Skip a token that is this lesson's own target kana or card** (the Tester's narrower option). It still rejects a base kana pointed out in a sound lesson, such as `は: はな` in lesson 16 (は is neither a target nor a card there), and an earlier kana compared in a kana lesson.
- **Count kanji as words, so `日本 から` is caught** (Tester observation). A kanji followed by its reading would then be rejected: `名 な` in lesson 62, `二 に` in a number list. Kanji appear only in F-Kanji lessons, so PM review stays the backstop.

**Residual, accepted**
- **Still rejected:** a mention written right after a word with no punctuation between them (`はな は says ha`). R1.4 tells the drafter to set a lone kana apart.
- **Missed:**
  - a particle before a one-kana word (`ねこ の え`);
  - a particle after a kanji (`日本 から`), as before.

## R1.2 F2: append only for declared targets

`addTypedReadingChecks` considers only the `ctx.targets` whose id is in `draft.targetItemIds`. A draft that drops a target then fails the gate's typed-reading rule, as it did on `main`.

**Not chosen:** letting a validator failure reject the draft. That is a wider change to the F.3 validator, which is advisory today.

## R1.3 F3: compare answers without punctuation

`isFairTypedReading` and the transform's step 2 compare `correctAnswer` with the surface using `bare()`, which strips spaces and punctuation. This matches H.2.c: the grader already treats `がっこう。` and `がっこう` as the same answer.

## R1.4 The first-draft prompt names the untaught particles

- Export `untaughtParticles(ctx)` from `course-rules.ts`. The gate and `courseContextBlock` both use it, so they can't drift apart.
- When the list isn't empty, add this line to the course-context block:

  `PARTICLES NOT TAUGHT YET: <list>. Don't use them as particles in Japanese. A kana shown on its own is fine when punctuation or English sets it apart, as in "と: そと" or "In はな, は says ha."`

- It costs about 40 input tokens per draft, and it prevents a rejection instead of paying for one. It steers kana lessons toward the phrasings the rule accepts without telling them to avoid their own target kana.

## R1.5 Tests (permanent, in the specs named)

**`course-rules.spec.ts`, Rule A must accept** (`onlyParticles(errors(text, n))` is `[]`):

| Text | Lesson |
|---|---|
| `た ち つ て と そと くつ` | 5 |
| `な に ぬ ね の ねこ いぬ` | 6 |
| `ま み む め も もも あめ` | 9 |
| `や ゆ よ やま ゆき` | 10 |
| `と: そと (outside)` | 5 |
| `In はな, は says ha.` | 7 |
| `かさ (か + さ)` | 4 |
| `Two small marks turn か into が: かぎ (key)` | 15 |
| `で: でんわ (phone)` | 16 |
| `こえ か き く け こ` (a row after a word) | 2 |
| `いぬ な に ぬ ね の` | 6 |
| `ね ねこ ねずみ` | 6 |
| `Words with ね: ね, ねこ` | 6 |
| `か: かさ` | 2 |
| `名 な, 何 なに` (kanji ends the stretch) | 62 |
| `The little words と (and), の ('s) and みて (look) come later in the course.` (the PM's gloss, verbatim) | 20 |

The first 9 are the Tester's reproduction. The existing Task 3 accept list and the deviation tests stay as they are.

**Rule A must reject:**
- The existing Task 3 reject list, unchanged. The spike confirms every case still rejects.
- `はな と ひと` at 8: the kana reading lessons stay covered.
- `ねこ と いぬ` at 9: an example sentence in a kana lesson.
- Lesson 43's original preview at 43, verbatim: `To ask a question, just add か at the end: あなた は いしゃ です か 。 means 'Are you a doctor?' Easy, right?`. It is rejected on か, a sentence-final particle before 。.
- `にほん から きました` at 49: から.
- `それ で した` at 60, unchanged from deviation 6.
- The message: `ともだち と がっこう` at 20 gives `uses the particle と before it is taught, in "ともだち と がっこう"` after the field prefix.
- **Pinned limitation:** `はな は says ha` at 7 is rejected. Add a comment: known residual, and R1.4 steers the drafter away from it.

**`typed-reading.spec.ts`**
- **F2:** lesson 20's shape with `ja:vocab:写真` removed from `targetItemIds` and its checks dropped. The transform adds no check for 写真, and `checkCourseRules` reports `needs a typed check showing しゃしん`.
- **F3:** lesson 19's shape with q2 set to the reading prompt and `correctAnswer: 'がっこう。'`. There is exactly one typed check on 学校, unchanged, and `isFairTypedReading` is true for it.

**`lesson-prompter.spec.ts`**
- Lesson 20's prompt lists と and の under `PARTICLES NOT TAUGHT YET`.
- Lesson 44's prompt lists neither か nor は.
- Lesson 120's prompt lists only ね, よ, や, から and まで.

**Real drafts** (`dev.md`, scratchpad copies as in round 0). Run the gate over `published/*.json`, the three originals in `corrections.jsonl` and lesson 19's rejected draft. Expected: the round 0 results, with the stretch quoted in lesson 20's messages. `--recheck` on lesson 19 still saves it at $0.

## R1.6 Tasks (Developer, same PR)

1. R1.1: rewrite Rule A, with its tests.
2. R1.2 and R1.3: transform and fairness fixes, with their tests.
3. R1.4: export `untaughtParticles` and add the prompt line, with its tests.
4. README: describe the revised Rule A and the prompt line, including the phrasings that pass and the one that doesn't.
5. Run `pnpm typecheck && pnpm lint && pnpm test`, then `/code-review high` on the diff since `b16f481`. Add a round 1 section to `dev.md` with the real-draft results.

**Re-test** is scoped to the diff since `b16f481`, plus the Tester's `harness-kana.ts` and the 9-case reproduction. No paid call is needed.

---

# Decision to log

### F.2.b The pipeline writes typed reading checks, and a rejected draft can be rechecked for free (amends F.2.a) (decided by Tech Lead, 2026-11-14)

**Decision:** In a `typedReading` lesson, after the model returns, the pipeline makes sure each target word has a typed check that shows the word in kana with no rōmaji. It keeps a fair check, rewrites the prompt of a typed check whose answer is the word, or appends a check. The gate's rule stays as the safety net. `authoring:draft --recheck` reruns the transform, validator and gate on a `.rejected.json` with no model call.

**Why:** Lesson 19 was rejected twice for the same cause. The model wrote the right answers with recall prompts, ignoring an explicit instruction. The prompt wording is a fixed string, so code should own it. With about $19 for the whole batch, a draft already paid for should be recoverable when a code fix cures its rejection.

**Rejected:** Stronger prompt wording and a redraft (paid, and already failed twice). Always appending the pipeline's check (duplicates checks and loses their position). Generating every check in code (larger, and the model's meaning checks were fine). A retry loop (pays for every retry).

**Reverse:** Remove the `addTypedReadingChecks` call from `draft.ts` and the `--recheck` flag.

### F.2.c The gate rejects an untaught particle standing alone in Japanese, and a redraft is told why its last draft failed (amends F.2.a) (decided by Tech Lead, 2026-11-14)

**Decision:** A whitespace-separated token that is exactly an untaught particle is an error when a neighbouring token is a kana word of two or more characters. The particles are は, か, の, も, が, に, を, へ, で, な and と, plus ね, よ, や, から and まで, which the slice never teaches. Known words and taught grammar surfaces are spared, including across spaces. In a lesson with no kana targets or cards, a choice or closed answer that is exactly an untaught particle is an error. A `--force` redraft of a rejected lesson gets that rejection's errors in its prompt.

**Why:** F.2.a left particles to review because kana can't be split mechanically, but the spacing rule makes a particle that stands alone visible. Lessons 20 and 43 passed the gate and the critic with と, の, か and を before they were taught. The neighbour condition keeps kana rows, sound-lesson text and English mentions from tripping the rule. Telling a redraft why it failed is free, and a blind redraft is why lesson 19 failed the same way twice.

**Rejected:** A warning (sends every case to PM hand-editing, and each counts as a strike under the 22b quality bar). Any lone particle with no neighbour condition (rejects kana rows and sound lessons). Requiring every token to be a known word (likely false positives on conjugations, numbers and names). Morphological analysis (F.2.a).

**Known gaps:** Particles joined to a word, て-forms, and the particle に in lessons 65 to 80, hidden by the number に. Lesson 20 as published fails the rule, so its passage must be revised before it can be republished.

**Reverse:** Remove the particle rules from `course-rules.ts` and the previous-errors block from the draft prompt.

### H.2.c Punctuation is ignored when a typed answer is compared (amends H.2) (decided by Tech Lead, 2026-11-14)

**Decision:** `exactMatch` strips 、。,.!?！？ from both sides before comparing, for kana and rōmaji input alike.

**Why:** A kana answer with 。, or one missing a stored ？ or ！, was marked wrong while the same answer in rōmaji passed (N6). Lesson 43's live typed check exposes it. Stripping punctuation can only accept answers that differ by punctuation.

**Rejected:** Leaving it to a later unit (a full Developer and Tester cycle for a two-line fix).

**Reverse:** Remove the strip from `exactMatch`.

## Round 1

F.2.b, F.2.c and H.2.c are already in `decisions.md`, so F.2.c isn't rewritten. Append this amending entry. F2 and F3 restore planned behaviour and need no entry.

### F.2.d A particle counts as used only right after a word in one stretch of Japanese, and the first draft is told which particles aren't taught (amends F.2.c) (decided by Tech Lead, 2026-11-14)

**Decision:** F.2.c's Rule A is replaced. Each learner field is split into stretches of kana and spaces, broken by any other character: punctuation, symbols, Latin letters, digits and kanji. A token that is exactly an untaught particle is an error only when the token before it in the same stretch is a word (two or more kana, or a known phrase) and the token after it, if there is one, is not a single kana. The error quotes the stretch. The draft prompt lists the particles not taught yet and says to set a lone kana apart with punctuation or English. Rule B is unchanged.

**Why:** F.2.c looked at both neighbours and ignored punctuation, so it rejected correct kana and sound lessons. It caught a target kana before its example word (と そと, で: でんわ) and after a word in which it was being pointed out (はな, は): 13 of the 16 lessons from 4 to 16, Tester F1 on PR #74. A Japanese particle follows the word it marks, and a sentence doesn't run through a colon, comma or bracket. The revised rule passes all of those cases and still catches every untaught particle the PM found in lessons 20 and 43. Naming the untaught particles in the prompt is free, and it prevents rejections instead of paying for them.

**Rejected:** Exempting lessons with kana targets (leaves sound lessons 15 and 16 exposed, and drops the kana reading lessons, where particle use is likely). Exempting the lesson's own target kana and cards (still rejects a base kana pointed out in a sound lesson). Counting kanji as words (a kanji followed by its reading, such as 名 な, would be rejected).

**Known gaps:** In addition to F.2.c's, a mention written right after a word with no punctuation between them (はな は says ha) is still rejected. A particle before a one-kana word (ねこ の え) or after a kanji (日本 から) is missed.

**Reverse:** Restore F.2.c's neighbour test in `course-rules.ts` and remove the prompt line.
