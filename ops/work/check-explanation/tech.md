# Tech plan: what a lesson check tells me after I answer

Unit `check-explanation`. Written by the Tech Lead, 2026-11-15, against `brief.md` (P1 to P6, B.2.a) and the code at `main` `c0626c8`. Technical decisions logged as B.2.b, H.2.d and F.2.e in `decisions.md`.

---

# 0. What the code does today (verified)

- **Explanations are already stored, so no data change is needed.** `checkData()` in `lesson-publisher.ts` writes `data.explanation` on every published check. Live: 45 of 50 checks have one. The 5 without are lesson 1's seed (`the-five-vowels`). Drafts: 273 of 273 have one.
- **Nothing reads the explanation.** `mapCheck()` (`lesson.mapper.ts`) sends only id, prompt, format, target and choices. `ChecksService.grade()` returns `correct`, `correctAnswer` and `feedback`.
- **The check screen** (`LessonPlayer.tsx` `CheckBeat`) prints `Correct!` or `Answer: X` as the last line of the scroll area, under the choices. `Screen` (`ui.tsx`) is a `ScrollView` with a pinned footer that holds the button. There's no `KeyboardAvoidingView`.
- **The typed answer already stays in the box after grading** (`value={typed}`, `editable={false}`). It has to stay that way (brief 6).
- **Typed checks are graded by `WritingEvalService.exactMatch`:** both sides go through `toHiragana`, then a kuromoji join, then `matchesSpoken` (H.2.a). The **gate** (`course-rules.ts`) rejects a closed typed answer with は, へ or を joined to another word once any of them is taught. Before that, no answer can contain one. Known words are exempt.
- **Live typed checks: 11.** Lesson 19 (`ch04-l05`) has 5, lesson 20 (`ch04-l06`) has 5, lesson 43 (`ch08-l03`) has 1. All are hiragana and stored in kana. Wave 1 reading lessons 4, 8 **and 13** (`ch01-l04`, `ch02-l04`, `ch03-l05`) store 13 answers in rōmaji (`ao`, `kasa`, `yama`...). The brief named only 4 and 8.

## Spike results (throwaway, 2026-11-15, real `WritingEvalService`)

| Stored answer | wanakana `toRomaji` | Accepted by the grader today? |
|---|---|---|
| きっぷ, がっこう, おかあさん, しゃしん, ちょっと | kippu, gakkou, okaasan, shashin, chotto | Yes |
| ともだち は いしゃ です | tomodachi **ha** isha desu | Yes. `tomodachi wa isha desu` is also accepted (H.2.a) |
| こんにちは | konnichi**ha** | Yes. `konnichiwa` is also accepted |
| きんよう | kin'you | Yes. `kinyou` is **rejected** (it reads きにょう) |
| ゲーム | geemu | Yes. `ge-mu` is rejected |
| **ノート, コーヒー, スポーツ** | nooto, koohii, supootsu | **No.** `no-to` and `のーと` are rejected too. Only `nouto`, `kouhii` and `supoutsu` pass |

The last row is a **grading bug, not only a display problem.** `toHiragana` turns katakana オー into おう, so ノート is compared as のうと. A learner who types the normal spelling of ノート is marked wrong. No live check is affected yet, but lesson 39 (`ch07-l07`, wave 1) teaches ノート, コーヒー and スポーツ. Fixed in this unit (H.2.d, section 1.4).

Outline words with は, へ or を inside a word: ごはん, はは and おはようございます (all said "ha", which is what wanakana writes), plus こんにちは and こんばんは (already special-cased). Nothing else needs a special spelling.

---

# 1. Approach

## 1.1 The explanation travels in the grading response (P1, P4, P6)

- `ChecksService.grade()` adds `explanation` to `CheckResultDto` when `data.explanation` is a non-blank string, on every result, right or wrong, for every format. Nothing else changes.
- It reaches the app only after the learner has answered, the same way `correctAnswer` does (brief 6). The lesson payload stays as it is.
- A check without one gets no key at all. The app renders nothing in its place (P6).
- **Rejected:**
  - Putting it in the lesson payload and hiding it in the app: it gives the answer away to anyone reading the network traffic, which is the reason `answer` is withheld.
  - A separate `GET /checks/:id/explanation`: a second round trip, and a delay before the explanation shows, for no gain.

## 1.2 A missed typed check gets the answer as kana and rōmaji, from the server (P3)

`CheckResultDto` gains `answerForms?: { kana: string; romaji: string }`. It's present only on a closed TYPED check whose stored answer has exactly one spelling of each. The app shows it after a miss only (brief 3.3: "rōmaji after a right answer as well" was rejected).

**How the rōmaji is built.** A new pure function, `answerRomaji(answer, { kanaTarget })`, in `apps/api/src/common/answer-romaji.ts`:
1. It splits the stored answer into words exactly as `matchesSpoken` does: on whitespace and `ANSWER_PUNCTUATION`.
2. If any word isn't kana-only (kanji, Latin letters), it returns `null`.
3. On a kana-target check whose answer is one kana, that kana's own sound: は is `ha` (H.2.b).
4. Otherwise, word by word: a word in the **spoken table** takes its spoken spelling (は `wa`, へ `e`, を `o`, こんにちは `konnichiwa`, こんばんは `konbanwa`). Every other word is `toRomaji(word)`. The words are joined with single spaces.

**One table for grading and display.** The spoken table moves out of `writing-eval.service.ts` into `answer-romaji.ts`. Each entry carries both the grading pattern (`[はわ]`) and the display spelling (`wa`). `matchesSpoken` reads the same table, so the two can't drift apart.

**How the kana is built.**
- **Stored in kana:** the stored answer, as written.
- **Stored in rōmaji** (lessons 4, 8 and 13): the kana is taken from the check's own prompt, which the PM reviewed. Each run of kana in the prompt, and each word within it, is a candidate. The first one the grader judges equal to the stored answer (`exactMatch(stored, candidate)`) is the kana. The rōmaji is the stored answer, lowercased and trimmed. If no candidate matches (an English answer such as `cat`), there are no forms and the screen shows `Answer: X` as it does today.
- **Rejected: `toHiragana(stored)`.** It would print のおと for a rōmaji-stored ノート and わ for a particle.

**Self-check, which proves "if I type what's shown, it's accepted".** `WritingEvalService.answerForms()` returns the pair only if `exactMatch(romaji, stored)` and `exactMatch(kana, stored)` both pass, with the check's `kanaTarget`. Otherwise it returns `null`, and the learner sees kana only. So the app can never show a spelling the grader would reject.

**Particles: is the 3.3 fallback needed? No.** The rōmaji for a sentence spells は as `wa` whenever it is a whole word, and the gate (H.2.a, H.2.b) guarantees that every particle in a closed typed answer is a whole word from the moment one is taught. Before that, no answer contains one. The only way to get `ha` for a particle would be an answer that bypassed the gate. Every published lesson passes the gate at publish, and lesson 1's seed has no typed checks. The self-check is the backstop for anything else. So sentences keep their rōmaji, and the blanket "kana only for sentences" fallback is not built.

**Rejected:**
- **Building the rōmaji in the app with wanakana.** A new mobile dependency, a second copy of the grading rules, and `konnichiha` (the same reasons as B.3.a).
- **Storing the rōmaji on `Check.data` at publish.** Lesson 20 can't be republished, and it's a data change for something that can be computed.
- **Finding particles with kuromoji part-of-speech tags.** H.2.a already rejected this as unreliable on kana-only text, and grading doesn't use it, so display would disagree with grading.

## 1.3 The result sits in the pinned footer, above Next (P2)

- When a result arrives, `CheckBeat` moves the verdict, answer and explanation out of the scroll area into the `Screen` footer, as a `ResultPanel` directly above the Next button. The footer is pinned, and the `ScrollView` shrinks to make room, so the panel is in view whatever the question's length. Nothing is truncated: no `numberOfLines` anywhere in the panel.
- **Size:** the longest explanation published or drafted is 94 characters (lesson 43 q5), about 3 lines on an SE. The worst panel is a missed typed sentence: about 4 lines plus the button, roughly 230 pt of the SE's 667. The question area keeps about 330 pt and scrolls.
- **Order (brief 3.2):**
  - **Right:** `Correct!` (green), then the explanation.
  - **Missed:**
    1. `Not quite.` (red)
    2. `Answer: <kana, or the stored answer if there are no forms>`
    3. The rōmaji on its own line, if there are forms
    4. The explanation

  This mirrors the Teach beat's example block: Japanese first, then the reading under it.
- **The verdict text `Not quite.` is user-facing copy.** The PM may change it at review without changing this plan.
- `Keyboard.dismiss()` runs when the result arrives, because the keyboard would otherwise cover the footer. The typed answer stays in the disabled box.
- Multiple choice still marks the right choice green and the picked one red. The answer line repeats the right choice's text as it does now.
- **Rejected:**
  - Auto-scrolling the result into view: it depends on layout timing and still pushes the question off screen.
  - Shrinking the choice text to fit: it breaks on the next long question.

## 1.4 Katakana ー is compared as the vowel before it (H.2.d)

- `normalizeJapanese` becomes `toHiragana(text, { convertLongVowelMark: false })`, then one pass that replaces each ー after a kana with that kana's vowel: ノ + ー becomes のお.
- Both sides go through the same steps. Spiked results:
  - `nooto`, `no-to`, `のーと` and `ノート` all equal ノート, and `koohii` and `ko-hi-` equal コーヒー.
  - `nouto` and `kouhii` are now **rejected**. They spell different words (のうと).
  - Hiragana is untouched: `gakkoo` and `arigato` stay wrong, as decided under H.2.a and the checkpoint's `arigato` note.
- The display then shows `toRomaji(word)`: `nooto`, `koohii`, `geemu`. That is the doubled-vowel spelling the lessons use for hiragana long vowels (okaasan, oneesan).
- **Who's affected:** no live typed check has ー (all 11 are hiragana). No kanji item has ー (Neon: 0), so kanji reading reviews, the only other caller of this function, can't change. Katakana vocabulary in reviews is graded by meaning (G.4.a), not by this path.
- **Rejected:**
  - Showing `nouto`: it teaches a wrong spelling.
  - Keeping `nouto` accepted alongside the new spellings: two normalisations for a spelling no learner has ever been accepted with.
  - Leaving grading alone and relying on the self-check: lesson 39 would mark `koohii` wrong and show no rōmaji.

## 1.5 Explanation rules: drafter prompt plus two gate errors (P4, P5, P6)

- **Drafter prompt (`lesson-prompter.ts`, "Rules").** Add brief 3.5 as four lines. The exact text is in section 2.
- **Gate error: every check needs an explanation** (`check qN: needs an explanation`). From 22c on a missing explanation is a content defect (brief 3.4). An error is caught by the free redraft loop (F.2.c) instead of relying on review. 0 of 273 drafted checks lack one, so this costs nothing today.
- **Gate error: no explanation spells out a typed answer before its first typed check** (P5, brief rule 4).
  - For each closed typed check whose answer isn't a single kana, take its `answerRomaji`, or for a rōmaji-stored answer the stored answer.
  - Find the first typed check with that answer. Every explanation before it is tested. The answer's own explanation and later ones are allowed.
  - The match is whole-word, case-insensitive, with macrons stripped and doubled vowels and `ou` folded on both sides, so `gakkō`, `gakko` and `gakkou` are all caught.
  - Message: `check q2: the explanation spells out "gakkou" before check q8 asks for it`.
  - One kana's sound ("は is ha") is never caught, because single-kana answers are skipped.
  - An error, not a warning, because P5 is a promise and the gate runs again at publish.
- **The typed-reading transform** (`typed-reading.ts`) writes its appended explanation with `answerRomaji`, not raw `toRomaji`, so it can never print `konnichiha`.
- **Not built:**
  - **A praise-word warning.** On current drafts it flags "nice to meet you" and "Perfect reply when someone gives you something", both fine. The noise would teach reviewers to ignore it. Rule 2 stays with the prompt and PM review.
  - **A length warning.** The footer panel fits any one or two sentences.
  - **Adding the rules to the critic prompt.** The brief puts them in the drafter. The critic is kept repeatable at `temperature: 0`, and changing its prompt mid-batch shifts verdicts on wave 1.

---

# 2. Changes

| File | Change |
|---|---|
| `apps/api/src/common/answer-romaji.ts` (new) | `SPOKEN` table (grading pattern and display spelling) and `answerRomaji(answer, { kanaTarget })`. Pure, with no kuromoji |
| `apps/api/src/writing-eval/writing-eval.service.ts` | `matchesSpoken` reads the shared table. `normalizeJapanese` gets the ー pass (H.2.d). New `answerForms(answer, { kanaTarget, prompt }): { kana; romaji } \| null`, self-checked |
| `apps/api/src/checks/checks.service.ts` | `grade()` returns `explanation` (non-blank only) on every result, and `answerForms` on closed TYPED checks when it isn't null |
| `packages/types/src/index.ts` | `CheckResultDto`: `explanation?: string`, `answerForms?: { kana: string; romaji: string }`. Additive and optional; older clients ignore them |
| `apps/mobile/src/lesson/LessonPlayer.tsx` | `ResultPanel` in the footer above Next. The inline result line is removed. `Keyboard.dismiss()` runs on result. Order and copy as in 1.3 |
| `apps/api/src/authoring/course-rules.ts` | The two gate errors (1.5) |
| `apps/api/src/authoring/typed-reading.ts` | The appended explanation uses `answerRomaji` |
| `apps/api/src/authoring/lesson-prompter.ts` | Four rule lines (below) |
| `apps/api/src/testing/typed-answers.ts` (new) | Committed fixture (the drafts are gitignored). Contents: <ul><li>the 11 live typed answers with their prompts and targets</li><li>every typed answer in the wave 1 drafts (the section 0 scan)</li><li>the katakana outline words ノート, コーヒー, スポーツ, シャツ, ポケット, テレビ, ラジオ, カメラ, ホテル, レストラン, アメリカ, トイレ, ゼロ</li><li>こんにちは, こんばんは, おはよう ございます, ごはん, はは</li></ul> |

No new dependencies. `wanakana` is already an API dependency, and the app needs nothing new.

**Drafter prompt lines.** These replace and extend the current "Write Japanese in kana..." line where noted:

```text
- Every check question has an "explanation": one or two short sentences the learner reads straight after answering, whether they were right or wrong. Say why the answer is the answer. No praise ("Nice!", "Great work!") and nothing that assumes a wrong answer ("Not quite").
- For a typed question, the explanation says why the answer is spelled that way, for example "the っ doubles the k". It may give the rōmaji.
- Explanations are shown before the later questions, so until a question has asked the learner to type a word, no explanation spells that word out in rōmaji. Pointing out one kana's sound is fine.
- Write Japanese in kana, with a space between words. A typed correctAnswer is always the Japanese in kana, never rōmaji: the app shows the rōmaji and accepts either.
```

Rule 5 (only taught Japanese, no kanji outside F-Kanji) is already enforced on explanations, because `learnerFields` includes `q.explanation`.

---

# 3. Data

- **No schema change and no migration.** The explanation is already in `Check.data`. `answerForms` is computed on each request.
- **Grading behaviour change (H.2.d)** affects no stored data. It is reversed by reverting `normalizeJapanese`.
- **Lesson 43 republish (the Lead's job).** Content only, through the existing publish path.
  - `publishLesson` replaces the lesson's 5 `Check` rows in one transaction (`deleteMany` then `createMany`).
  - Nothing references `Check` rows except `Lesson` and `Item`, as checked in `schema.prisma`. FSRS and mastery rows are keyed by item, and completion by lesson. No learner data is touched.
  - This is the same routine path 22b used. It is reversible, so it isn't on the stop list.
  - **Rollback:** republish the backed-up copy.
- **Tester's API proofs write mastery rows.** Run them against a throwaway Neon branch, not the default branch, because the Alpha run needs a fresh learner.

**When to republish lesson 43:** now, before the Tester's simulator run. It needs no code from this unit, and the Tester needs the fixed q4 text to score P4.

**Gotcha:** the PM edited `tools/authoring/output/foundation-ja-ch08-l03.json`. `authoring:publish` reads `tools/authoring/published/`, which still says "...then です. Great work!" (checked 2026-11-15). Steps:
1. Copy `published/foundation-ja-ch08-l03.json` aside.
2. Put the edited `output/` draft in `published/`, through `authoring:review` APPROVE or a copy, since the PM has already approved the edit.
3. Run `authoring:publish foundation-ja-ch08-l03`. The gate runs again.

After this PR merges, the Developer's gate scan (T6) also covers lesson 43 under the new rules.

---

# 4. Promise map

Test locations:
- **API unit tests (Jest)** run in `pnpm test`, in CI.
- **Tester-sim** means simulator evidence on `Sensei 22a SE3` against the PR build: screenshots in `test.md`.
- **Tester-API** means `POST /checks/:id/answer` against a local API on a throwaway Neon branch.

| Promise | Implementation | Test that proves it |
|---|---|---|
| **P1** Explanation after every answer, right or wrong, no tap | 1.1 `explanation` on every `CheckResultDto`. 1.3 `ResultPanel` renders it with the verdict | <ul><li>`checks.service.spec.ts`: `explanation` is returned on a right and a wrong answer, for MULTIPLE_CHOICE and TYPED, and on an open check</li><li>`lesson.mapper.spec.ts`: `CheckDto` has no `explanation` or `answer` key even when `data` has both (withheld until answered)</li><li>Tester-sim: lesson 43 q1 right and q5 wrong, and lesson 19 one right and one wrong, each showing the explanation with no tap</li></ul> |
| **P2** Verdict, answer and explanation in view at once, no scroll, nothing cut off, on lesson 43 q5 | 1.3 panel pinned in the footer, no truncation | <ul><li>Tester-sim on SE3: lesson 43 q5 answered wrong, and q4 typed wrong (the tallest panel). Screenshot taken without touching the screen, with all lines whole</li><li>Also with the keyboard up when Return is pressed</li><li>Mobile `tsc` and `expo export` bundle check</li></ul> |
| **P3** Missed typed check shows kana and rōmaji: kippu, `wa` for は, and what's shown is accepted | 1.2 `answerRomaji` from the shared table, `answerForms` self-check, kana from the prompt for rōmaji-stored answers. 1.4 ー fix. 1.3 shows it after a miss only | <ul><li>`answer-romaji.spec.ts`: きっぷ→`kippu`. ともだち は いしゃ です→`tomodachi wa isha desu`. へ→`e`, を→`o`. こんにちは→`konnichiwa`. は on a kana target→`ha`. ごはん→`gohan`. ノート→`nooto`. 日本→null</li><li>`writing-eval.service.spec.ts`: every fixture answer has forms, `exactMatch` accepts both forms, and no particle は is spelled `ha`. `ao` gives あお from its prompt, `cat` gives null. ー cases as in 1.4, and all existing cases still pass</li><li>`checks.service.spec.ts`: `answerForms` on a typed miss, none on multiple choice</li><li>Tester-API: for each of the 11 live typed checks, post a wrong answer, then post the returned `answerForms.romaji` and expect `correct: true`</li><li>Tester-sim: lesson 19 q8 typed `kipu` shows きっぷ and kippu. Lesson 43 q4 miss shows `tomodachi wa isha desu`</li></ul> |
| **P4** No explanation contradicts how I did | 1.5 drafter prompt rule 2. Lesson 43 republished (section 3) | <ul><li>`lesson-prompter.spec.ts`: the prompt carries the rule</li><li>Tester: SQL scan of every live `Check.data.explanation` for praise or verdict words, with each hit read and judged in `test.md`. Lesson 43 q4 must read "...then は (said 'wa'), then いしゃ, then です."</li><li>PM review of every 22c wave against rule 2</li></ul> |
| **P5** No explanation shows how to type a word before the lesson asks me to type it | 1.5 gate error (runs at draft and publish), plus prompt rule 4 | <ul><li>`course-rules.spec.ts` errors when: q1's explanation has `gakkou` and q4 types がっこう; the spelling is `gakkō`; the answer is a rōmaji-stored `kasa`</li><li>`course-rules.spec.ts` passes when: the explanation is on its own check; it comes after the first typed ask (lesson 13's `yama` q1 and q4); it is "は is ha" before a typed は sentence</li><li>T6: the gate run over every current draft in `output/` and `published/`, with the results in `dev.md`</li></ul> |
| **P6** No explanation: verdict and answer only, no blank or placeholder | 1.1 key omitted. 1.3 panel renders nothing for it. 1.5 gate error so new lessons always have one | <ul><li>`checks.service.spec.ts`: no `explanation` key when the explanation is missing, `""` or `"   "`</li><li>`course-rules.spec.ts`: a missing explanation is an error</li><li>Tester-sim: lesson 1 seed (`the-five-vowels`) answered right and wrong, with no gap or placeholder under the verdict</li></ul> |

---

# 5. Risks

| Risk | What would show it |
|---|---|
| Display and grading drift apart in a later grading change | The self-check returns null, so kana only and never a wrong spelling. The fixture property test fails in CI |
| The ー change rejects `nouto` for ノート, which today passes | Intended. No live check has ー, and no kanji reading has ー (Neon, 2026-11-15). A wave 1 lesson 39 typed check would show it in review |
| The P5 gate rule rejects a fair explanation (false positive) and blocks a publish | T6 scan over all current drafts. If one is a false positive, the Tech Lead downgrades the rule to a warning (logged) rather than loosening the match silently |
| An approved wave 1 draft breaks a new gate rule at publish | T6 scan lists them. The PM fixes the text by hand, as in 22b. It doesn't block code |
| A rōmaji-stored answer whose prompt doesn't show the kana gets no forms, so it shows `Answer: ao` only, as today | The fixture covers all 13 such answers in lessons 4, 8 and 13. The new prompt line stops new ones |
| The keyboard covers the footer panel | `Keyboard.dismiss()` on result. The Tester takes a screenshot after a Return submit |
| Very large accessibility text sizes crowd the screen | Outside P2 (default text size). The panel still sits above the button, and the question area scrolls |
| Lesson 43 republished from the stale `published/` copy, so "Great work!" stays live | The Tester's P4 SQL check fails. Section 3 gives the exact steps |
| Lesson 1 seed replaced before the Alpha run, so no check without an explanation is left to meet | The Tester's P6 evidence stands, and the PM accepts it in triage (brief 4) |

---

# 6. Tasks (one Developer pass, one PR, in this order)

1. **T1 Shared rōmaji.** Create `common/answer-romaji.ts` (table and `answerRomaji`) with its spec. `matchesSpoken` reads the table. The existing `writing-eval.service.spec.ts` passes unchanged.
2. **T2 ー normalisation (H.2.d)** in `normalizeJapanese`, with spec cases for ノート, コーヒー, ゲーム, ラーメン, `nouto`, and `gakkoo` and `arigato` still wrong.
3. **T3 `answerForms`** in `WritingEvalService` with the self-check. Add the `testing/typed-answers.ts` fixture and the property spec.
4. **T4 Contract.** Add the two optional fields to `CheckResultDto`. `ChecksService.grade` returns them. Add the `checks.service.spec.ts` cases, and a `lesson.mapper` spec for withholding.
5. **T5 App.** `ResultPanel` in the footer, the inline result removed, `Keyboard.dismiss()`, copy and order as in 1.3. Run `pnpm --filter mobile typecheck`, then `expo export --platform ios` (per `PROJECT.md`). Take a simulator screenshot of lesson 43 q5 for `dev.md`. This one is for the Developer's own check; the Tester's evidence is separate.
6. **T6 Authoring.** Add the two gate errors with their specs. The typed-reading transform uses `answerRomaji`. Add the prompt lines with their spec. Run the gate (`--recheck`, no model cost) over every draft in `output/` and the 5 `published/` copies from the main checkout, and list every new error in `dev.md`.
7. **T7** Run `pnpm typecheck && pnpm lint && pnpm test`, then `/code-review high`, then open the PR. Record any deviations from this plan in `dev.md`.

**Out of scope here and not to be touched:** open-check grader comments, the input placeholder, chapter tests, reviews, practice and placement (brief 5).
