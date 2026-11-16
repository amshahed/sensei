# Test: what a lesson check tells me after I answer

Unit `check-explanation`. Written by the Tester, 2026-11-15. PR [#78](https://github.com/amshahed/sensei/pull/78).

---

# Verdict: PASS, on `ad7aadb` (`ad7aadb44e69c3d856c24051b5eeab27d7bf25c6`)

- **One condition, which doesn't block the merge but does block wave 2 drafting.** Finding F1 is a real defect in the new P5 gate rule: ordinary English words trip it. The Tech Lead has to resolve it before wave 2 (lessons 41 to 77) is drafted, because wave 2 holds three exposed words (lessons 57, 61 and 67).
- Everything a learner sees was checked against the real API on a throwaway Neon branch, and rendered on the `Sensei 22a SE3` simulator: P1, P2, P3, P4 and P6 hold. P5 holds for every live lesson and is enforced by the gate, with the gaps listed under F2.
- Any new commit voids this PASS.

---

# 1. Evidence

All runs used my own detached worktree `.claude/worktrees/test-78` at `ad7aadb`. For the before/after comparisons I used a second worktree at `main` `c0626c8`, which I've since removed.

| What | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck --force` (turbo cache bypassed) | 4/4 tasks, exit 0 |
| Lint | `pnpm lint --force` | exit 0 |
| Tests | `pnpm test --force` | 59 suites, 1,357 tests, all passed |
| CI | `gh pr view 78` | `verify` SUCCESS on head `ad7aadb` |
| iOS bundle | `expo export --platform ios` (clean PR code) | Bundled, 800 modules, no errors |
| Code review | `/code-review high 78` | 10 findings, each judged in section 3 |
| API, real server | PR build (`node dist/src/main.js`) on port 3078, dev-stub auth, `DATABASE_URL` set to throwaway branch `test-78-check-explanation` (endpoint `ep-shiny-meadow`, checked to differ from the live endpoint `ep-royal-night`) | See below |
| Simulator | `xcrun simctl` on `Sensei 22a SE3` (iPhone SE, 375×667 pt), Expo Go, Metro running from the PR worktree, API as above | 9 screenshots. The key ones are in `test-shots/` |
| Gate scan | PR and `main` `checkCourseRules` run in memory over every draft in `tools/authoring/output/` and `published/` | 45 files, 436 checks, 71 typed: 0 new errors, 0 removed, 0 new warnings |
| Grading diff | Old and new `WritingEvalService.exactMatch` (real kuromoji), 776 stored answers × variant typings = 4,894 comparisons | 126 verdicts changed, every one involving ー or a typed hyphen (section 2, F3) |

## 1.1 Tester-API proof (tech.md P3 row), log in `test-shots/api-proof.log`

`POST /checks/:id/answer` for each of the 11 live typed checks: a miss (`xyzq`), then the returned `answerForms.romaji`, then `answerForms.kana`.

- **11 of 11:** the miss returns `correct:false`, the explanation and both forms. Retyping the rōmaji and the kana each returns `correct:true`.
- **Forms returned:** `tomodachi`, `gakkou` ×2, `okaasan`, `shashin`, `chotto` ×2, `issho`, `kippu`, `zasshi`, and lesson 43's `ともだち は いしゃ です` / `tomodachi wa isha desu`. None spells the particle は as `ha`.
- **All 39 multiple-choice checks**, answered right and wrong:
  - The explanation comes back on both answers whenever the check has one, and is byte-identical to `Check.data.explanation`.
  - `answerForms` never comes back.
  - Lesson 1's 5 seed checks return only `checkId, correct, correctAnswer`: no `explanation` key at all.
- **Lesson payload, all 6 lessons:** check keys are `id, position, prompt, format, targetItemId, choices`, with no `answer`, `explanation`, `answerForms` or `data`. No explanation text appears anywhere in the payload.
- **Unknown check id:** 404.

## 1.2 Simulator evidence (P1, P2, P3, P6)

Nothing in this session can tap the simulator. I drove it with a throwaway harness in my worktree, never committed and reverted afterwards (`git status` clean at `ad7aadb`). The harness:
- set `App.tsx`'s first flow to a given lesson;
- started `LessonPlayer` at a given check;
- had `CheckBeat` submit a preset answer through its own `submit()` after a delay.

`ResultPanel`, `Screen`, the `CheckBeat` markup, the network call and `Keyboard.dismiss()` all ran unchanged against the real API. The harness skipped the Teach and Practice beats and the taps. Every screenshot was taken with `xcrun simctl io screenshot`, without touching the screen.

| Shot | Scenario | What it shows |
|---|---|---|
| `s1-l43q5-mc-wrong.png` | Lesson 43 q5 (longest check), picked "I am a student." | `Not quite.`, `Answer: I am a teacher.`, then the 94-character explanation on 3 whole lines, then Finish. The picked choice is red and the right one green. The panel sizes to its content, with no inner scroll |
| `s2-l43q4-typed-wrong.png` | Lesson 43 q4, typed `tomodachi ga isha desu` (tallest panel) | `Not quite.`, `Answer: ともだち は いしゃ です`, `tomodachi wa isha desu`, then the 2-line explanation and Next. All in view, nothing cut off. The typed answer stays in the box |
| `s3-l19q8-kipu.png` | Lesson 19 q8, typed `kipu` | `Answer: きっぷ`, `kippu`, "In rōmaji, きっぷ is kippu: the っ doubles the p." |
| `s8` (scratch) | Lesson 19 q8, typed `kippu` | `Correct!` plus the explanation, and no rōmaji line |
| `s4-l43q1-right.png` | Lesson 43 q1 right | `Correct!` plus the explanation, no tap |
| `s5` (scratch), `s6-l1q1-wrong.png` | Lesson 1 seed q1, right and wrong | Right: `Correct!` only. Wrong: `Not quite.`, `Answer: あ`. No blank space, placeholder or error, and the panel shrinks to fit |
| `s7a` (scratch), `s7b-keyboard-after.png` | Lesson 43 q4 with `autoFocus`. The keyboard is up, then the submit runs while it's up | Before: the keyboard covers the footer. After: the keyboard is dismissed and the full panel is in view. `tomodachi ha isha desu` is accepted (H.2.a) |
| `s9-l20q4-gakko-miss.png` | Lesson 20 q4, typed `gakko` | `Answer: がっこう`, `gakkou`. Lesson 20's text doesn't give the rōmaji, so the answer line supplies it, as brief 3.3 intends |

Side effects of the run, all off the live database:
- The dev user's intake was completed on the throwaway branch, so that `OnboardingGate` would pass.
- Mastery rows were written on the throwaway branch for the dev user and for `tester-78-api`.
- Expo Go's two first-run flags (`EXDevMenuIsOnboardingFinished`, `ExpoGoOnboardingFinished`) are now set on SE3, so its dev-menu sheet no longer covers the app at launch.

---

# 2. Promises

| | Status | How checked |
|---|---|---|
| **P1** An explanation after every answer, right or wrong, with no tap | **Holds** | API: every check with an explanation returns it on right and wrong answers, for both formats. Simulator: s1, s2, s3, s4, s7b, s8 and s9 show it with the verdict, with no tap |
| **P2** Verdict, answer and explanation in view at once on an SE, no scroll, nothing cut off | **Holds on the simulator** | s1 (lesson 43 q5) and s2 (q4 typed, the tallest panel) on SE3, at default text size. The panel sits above the button and is sized to its content: about 210 pt for s1 out of a 300 pt cap. The question area above still scrolls. In s1 the 4th choice is partly under the panel and scrolls, but the answer line repeats the right choice. Not seen: a real finger tap or the Return key (section 4) |
| **P3** A missed typed check shows kana and rōmaji (kippu, `wa` for は), and what's shown is accepted | **Holds** | All 11 live checks: the miss, then the shown rōmaji and kana each accepted (1.1). Simulator s2, s3 and s9. All 70 closed typed answers in the current drafts get forms the real grader accepts, none with a particle `ha`. That includes the 22 stored in rōmaji in lessons 4, 8, 13, 38 and 39 |
| **P4** No explanation contradicts how I did | **Holds on live content** | Scan of all 45 live explanations for praise and verdict words (nice, great, correct, right, wrong, not quite, perfect, "!" and others). Only hits: "good night" twice, which is a meaning. Lesson 43 q4 on the branch copied from live today reads "Topic ともだち, then は (said 'wa'), then いしゃ, then です." The prompt carries rule 2 (spec). Future waves rely on PM review, by design |
| **P5** No explanation shows how to type a word before the lesson asks for it | **Holds on live content. Gate works, with gaps** | Live: 0 giveaways across the 11 typed checks. Gate probes on real drafts: `kippu`, `Kippu!`, `kippū` and the full lesson 43 sentence are all caught. A check's own explanation and later ones are allowed, as is "は is wa". Gaps and false positives: F1, F2 |
| **P6** No explanation: verdict and answer only, with no blank or placeholder | **Holds** | API: no `explanation` key on lesson 1's checks. Simulator s5 and s6. Gate: a missing or blank explanation is an error (probe) |

---

# 3. Findings

Severity: High means a learner is hurt or data is wrong. Medium means real breakage outside the learner path. Low means an edge case or inconsistency. Info means no action is needed in this PR.

| # | Sev | Where | Failure scenario | Status |
|---|---|---|---|---|
| **F1** | Medium | `apps/api/src/authoring/course-rules.ts:358-411` (`foldedWords`, `giveawayProblems`), wired in at `:484` | Whole-word matching can't tell rōmaji from English, and the vowel folding adds collisions (いい → `i`, どう → `do`). Reproduced on lesson 43's draft (section 5). "I am a teacher." before a typed いい is rejected with `spells out "ii"`. The same happens for どう after "do", そう after "so", あれ after "are" and まで after "made". In the outline this hits あれ (lesson 57), どう (61), まん → `man` (67), ふん → `fun` (98) and いい (107). Lessons 57, 61 and 67 are **wave 2**. F-Vocab lessons do get typed checks (lesson 39: "Type ノート in rōmaji."). Each false rejection costs a told-why redraft whose reason misleads the model, and after two it costs a PM hand edit | **Not fixed. Justified for the merge, blocking for wave 2.** Authoring only, never learner-facing, and it fails loudly. No current draft or live lesson is affected (scan: 0). tech.md's risk table gives the remedy to the Tech Lead (downgrade to a warning, or narrow the match), and the Developer escalated it (`dev.md` 7). **The Tech Lead decides and lands the change before wave 2 is drafted.** Note that skipping needles of three letters or fewer doesn't cover `made`, `same` or `name` |
| **F2** | Low | `course-rules.ts:358-410` | P5 false negatives that the gate misses: <ul><li>a hyphen (`kip-pu`) or a curly apostrophe (`kin’you`)</li><li>a sentence spelled with `ha` (`tomodachi ha isha desu` before q4)</li><li>one word of a multi-word answer (`isha means doctor` before typing `ともだち は いしゃ です`)</li></ul>All reproduced. The last is the plan's choice (tech.md 1.5 matches the whole answer) | **Not fixed. Justified:** the live content has 0, the drafter prompt carries the rule, and PM review is the backstop. Tech Lead to consider these with F1 |
| **F3** | Low | `apps/api/src/common/answer-romaji.ts:5-23` (`spellLongVowels`) | H.2.d's text says "Hiragana is unchanged". In practice, a typed hyphen is now accepted for any long vowel spelled with the same vowel. Newly accepted: `oba-san` (おばあさん), `oishi-`, `o-ki-` (おおきい), `to-` (とお), and in kanji reading reviews `ju-` (ジュウ), `kyu-` and `shu-`. `gakko-`, `arigato-` and `gakkoo` stay wrong. My diff found no accepted spelling lost apart from the intended katakana ー ones (25, all おう/えい spellings of ー such as `nouto` and `kouhii`) | **Not fixed. Justified:** it only accepts more, and only spellings that sound right. Nothing shown to the learner changes. The Tech Lead should amend H.2.d's wording, or narrow the pass to ー that came from katakana |
| **F4** | Low | `course-rules.ts:316-329` (`isFairTypedReading`) | Still uses wanakana's rōmaji, so a prompt giving `konnichiwa` would count as fair | **Not fixed. Justified:** typed reading is on only for lessons 15 to 20 (checked in the outline), and none of their targets is a spoken word. Latent. Tech Lead backlog (`dev.md` 7) |
| **F5** | Low | `course-rules.ts:352` (`ONE_SOUND`) | Only small ゃ, ゅ and ょ count as one sound. A typed ティ or ファ is treated as a word, so "ティ is ti" in an earlier explanation would be rejected, although the brief allows pointing out one kana's sound | **Not fixed. Justified:** the current drafts give 0 errors, including katakana lesson 38. Fold into the F1 decision |
| I1 | Info | `LessonPlayer.tsx` CheckBeat | Before submitting, the keyboard covers the footer's Check button (s7a). This was already the case before the PR. Return submits, and when the result arrives the PR dismisses the keyboard (s7b). Code-review finding 7's "Retry hidden under the keyboard" doesn't happen on the Return path, because Return already blurs a single-line input | Pre-existing, outside this unit |
| I2 | Info | `ResultPanel` | The grader's `feedback` isn't shown, and an ungradable open check reads `Not quite.` | Out of scope (brief 5, with its trigger). None is live |
| I3 | Info | `writing-eval.service.ts:109-112`, `checks.service.ts:119` | Half of the self-check is always true, and the forms are computed on right answers too | It costs microseconds. I agree with the Developer's choice to keep it |
| I4 | Info | `typed-reading.ts:69` (code-review finding 2) | An appended reading check can make the gate reject an earlier explanation | I agree with the Developer that this is a true positive under P5 |
| I5 | Info | `lesson-prompter.ts:175` | The Developer worried the new line pushes English typed answers out. None of the 60 typed checks in wave 1 has an English answer (22 are rōmaji, all of prompt kana), so the practical risk is small. Watch wave 2's first drafts | Watch item for the PM |

---

# 4. Not verified

- **A real tap or Return key on the device.** The harness submits through `submit()` in code, so the touch path and the `onSubmitEditing` path weren't exercised. The keyboard-up case (s7b) is the worse version of the Return case, and it passed. The Alpha run taps for real (brief 4, P2 on device).
- **Large accessibility text sizes.** Outside P2, which is scored at default size. The 45% cap exists for this, and I didn't see it trigger.
- **A physical device, and Clerk auth mode.** Dev-stub auth only.
- **The live database.** By instruction, only the throwaway branch, copied from the default branch today, after lesson 43's republish.

---

# 5. Reproductions for the Developer and Tech Lead (F1, F2)

The script is at `<scratchpad>/t78/gate-probe.ts` this session. It's easy to rebuild. Run it from `apps/api` with `TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register -r tsconfig-paths/register`. It loads `published/foundation-ja-ch08-l03.json` and the outline's context, mutates the draft in memory, and runs `checkCourseRules`.

```text
q1.explanation = "I am a teacher.";       q4.correctAnswer = "いい"  -> check q1: the explanation spells out "ii" before check q4 asks for it
q1.explanation = "Why do we say it?";     q4.correctAnswer = "どう"  -> ... spells out "dou" ...
q1.explanation = "Things that are far.";  q4.correctAnswer = "あれ"  -> ... spells out "are" ...
q1.explanation = "It is made of paper.";  q4.correctAnswer = "まで"  -> ... spells out "made" ...
L19 q1.explanation = "A ticket (kip-pu)."                            -> no error (F2)
L43 q1.explanation = "Type tomodachi ha isha desu."                  -> no error (F2)
L43 q1.explanation = "isha means doctor."                            -> no error (F2, plan choice)
```
