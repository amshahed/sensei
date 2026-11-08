# Test: fix the beta outline so lessons can be drafted from it

**Round 5, simulator check only. Verdict: PASS** on commit `c04027110842d0d664b8d7caf4bc1d9908402327` (PR #70, branch `feat/22a-outline-gaps`).

The recap card has now been seen rendered on a 375pt iPhone for all four item types, and all four of F2's conditions hold, so F2 closes. The code verification is round 4's, on this same commit. CI `verify` is SUCCESS on this SHA and the PR state is CLEAN, both rechecked at the end of this round.

A first attempt in this round stopped because the simulator tool refused the device. On the rerun the tool accepted it, and the whole check went through that tool.

Nothing blocks this PR. Open and non-blocking: N4 and N6 (existing code), D2 (decision-log entry for the Lead), T1 (tooling), V1 and V2 (cosmetic). A new commit voids this PASS.

# Evidence: round 4, on `c040271`

Own worktree `.claude/worktrees/test-70`, detached at the PR head, no uncommitted changes after the run.

| What | Result |
|---|---|
| `TURBO_FORCE=true pnpm typecheck`, `lint`, `test` | Each exit 0, `0 cached`. 56 suites, 940 tests |
| CI on `c040271` | `verify` SUCCESS, run 42529777201, `headSha` matches. PR state CLEAN |
| Diff reviewed | `9eed6f6..c040271`, 1 commit, 5 files, all in `apps/api` |
| `/code-review high` on that range | 10 candidates, each checked below |
| 14 mutations of the N1, N3, N5 and D1 code, my own set | 12 caught, none by a compile error. 2 survive, both harmless: `kanaTarget` defaulting to true (`ChecksService` always passes it, and 0 of 103 kanji accept a lone は, へ or を) and dropping `ja:grammar:にへ` from the start set (は at lesson 43 always starts the rule first) |
| Gate on the real compiled outline, N2 table | 14 of 14. The rule first applies at lesson 43 |
| Every known word alone, in every lesson it is known | 11,405 checks, 0 particle false positives |
| Every known word with は, を or へ joined on, lessons 43 to 120 | 30,627 checks, all rejected |
| Words containing は, へ or を past the first character, paired with every known word, sampled every 7 lessons from 43 | 7,601 checks, 0 false positives |
| `exactMatch` default path with the real tokenizer | 15 of 15 from the F3 table |

## N1 and N5 over real HTTP, real tokenizer, real Postgres

`node dist/src/main.js` built from `c040271`, on the throwaway branch, dev-stub auth, no LLM keys. 35 TYPED checks through `POST /checks/:id/answer`, every response 201, no error lines in the API log. 28 of 28 rows with an expected result held. The other 7 are the rows marked observed.

| Target | Stored | Typed | Result |
|---|---|---|---|
| `ja:kana:ha` | は, ha | wa | wrong, as N1 ruled |
| `ja:kana:he` | へ | e | wrong, as N1 ruled |
| `ja:kana:kata-ha` | ハ | wa | wrong, as N1 ruled |
| `ja:kana:ha` | は | wa. | wrong |
| `ja:kana:ha` | は。 | wa | wrong |
| `ja:kana:he` | へ | e. | wrong |
| `ja:kana:ha` | こんにちは, こんにちは！ | konnichiwa | **right, N5 fixed** |
| `ja:kana:ha` | こんばんは | konbanwa | **right, N5 fixed** |
| `ja:kana:ha` | はな。 | hana | **right, N5 fixed** |
| `ja:kana:ha` | は | ha., ha! | **right, N5 fixed** |
| `ja:kana:ha`, `kata-ha`, `he` | は, ハ, へ | ha, は, ha, he | right |
| `ja:kana:ha` | はな | hana / wana | right / wrong |
| `ja:kana:wo` | を | wo / o | right / wrong (candidate 5) |
| `ja:grammar:は` | は | wa, ha | right |
| `ja:grammar:は` | わたし は がくせい です, and with か？ | watashi wa gakusei desu, … ka | right |
| `ja:vocab:こんにちは` | こんにちは, こんにちは！ | konnichiwa | right |
| `ja:vocab:こんばんは` | こんばんは | konbanwa | right |
| `ja:kana:ha` | は ひ ふ へ ほ | ha hi fu he ho | right, observed |
| `ja:kana:ha` | は ひ ふ へ ほ | wa hi fu e ho | **right, observed** (candidate 4) |
| `ja:kana:ha` | は | は。 | **wrong, observed** (N6) |
| `ja:kana:ha` | はな。 | はな | **wrong, observed** (N6) |
| `ja:vocab:こんにちは` | こんにちは | こんにちは！, こんにちは。 | **wrong, observed** (N6) |
| `ja:vocab:こんにちは` | こんにちは！ | こんにちは | **wrong, observed** (N6) |

**Spend.** No Gemini and no Anthropic calls. Neon: the throwaway branch only. My probe lesson, its checks and its user are removed, and the branch is back to 4 lessons, 1,625 items, 0 mastery rows, 0 completions. `tools/authoring/output/skeleton.json` untouched, modified time still 4 Nov. API server stopped. No simulator was booted, and nothing was downloaded.

## Simulator check: done (round 5)

Device: `Sensei 22a SE3`, iPhone SE (3rd generation), iOS 26.4, 375 by 667 points, Expo Go 56.0.4. Worktree `.claude/worktrees/test-70` on `c040271`, no uncommitted changes. API from `dist/src/main.js` on the throwaway branch, dev-stub auth, no LLM keys. `expo start --offline --port 8081` with the Clerk key empty, opened with the tool's `open_url` on `exp://127.0.0.1:8081`. Bundle served, 0 error lines in the Metro log, no download attempted.

The app reached the API from the simulator: intake saved, Home and all four lessons loaded, and each lesson's completion carried through to the next. Walked as a total beginner from a first-run intake through all four lessons to the Practice beat and on to "Lesson complete". Screenshots are in `ops/work/22a-outline-gaps/test-screens/`.

| Type | Lesson | Front | Back on tap | Screenshots |
|---|---|---|---|---|
| Kana | `the-five-vowels` | あ い う え お | a, i, u, e, o | `01-kana-before.png`, `02-kana-after.png` |
| Word | `fixture-vocab` | よろしくおねがいします | please remember me; please help me; please treat me well; I look forward to working with you | `03-word-before.png`, `04-word-after.png` |
| | | ありがとうございます | thank you | same |
| | | ごちそうさまでした | thank you for the meal; that was a delicious meal; what a wonderful meal | same |
| | | かぎ | key | `05-word-after-last-card.png` |
| Grammar | `fixture-grammar` | に | Marks where something is (in, at, on), when something happens (at, on), or where you are going (to). | `06-grammar-before.png`, `07-grammar-after.png` |
| | | 〜がすきです | I like. The thing you like comes before が. | same |
| | | 〜たいです | I want to. Goes on the end of a verb to say what you want to do. | same |
| Kanji | `fixture-kanji` | 生 | life, then 19 readings from セイ・ショウ to む(す)・う | `08-kanji-before.png`, `09-kanji-after.png` |
| | | 一 | one, then イチ・イツ・ひと・ひと(つ) | same |

Line above the cards reads "Tap each card to test yourself before the check.", as the PM ruled. Tapping a revealed card hides the back again. The kanji text on screen is identical to the API's `recap`.

| F2 condition (`triage.md`) | Result | What I saw |
|---|---|---|
| 1. Back matches the PM's table, never repeats the front, never empty | **Holds** | All 14 cards above, four item types |
| 2. Long fronts fit, nothing clipped or pushed off | **Holds** | よろしくおねがいします: one line, all 11 characters, no ellipsis, inside the card's padding. It is the longest word front among all 342 outline items, by script on the spec. あ, 一 and かぎ stay full size, matching the 40pt あ on the Teach beat. Glosses, the 100-character に meaning and 生's 19 readings wrap in full. Last card and "Start check" are reachable and clear of the footer in every lesson |
| 3. No rōmaji on a word's card | **Holds** | All four word cards show meaning only |
| 4. Seen rendered, at least one lesson of each type | **Holds** | 375pt device, the narrowest available |
| `tech.md`: no `-` or `.` in a kanji reading | **Holds** | Screen, and the API's `recap` by script |

Also seen working, nothing broken: first-run intake, Teach beat, Check beat with "Correct!", "Lesson complete", Home moving from one lesson to the next and then to the chapter assessment, streak line, and Curriculum, where an expanded lesson shows kana and meaning with no duplicate reading (`10-curriculum-words.png`).

Not defects: the developer menu on first open is Expo Go's own. One card missed a tap when my taps were fired milliseconds apart, and it responded when tapped on its own.

**Spend and cleanup, round 5.** No Gemini or Anthropic calls, no keys in the API's environment. Nothing downloaded or installed. Ports 3000 and 8081 free after both servers stopped. Simulator left booted.

**The branch now holds this run's progress.** No Neon branch was created or deleted, and the default branch wasn't touched. The app itself wrote to the throwaway branch as the dev-stub user: intake, four lesson completions, and whatever check results, mastery and streak rows those produce. I did not clean these up. A rerun on this branch starts at the chapter assessment, not at intake.

**The same data over HTTP.** Carried from round 3, because the mapper, `recapBackFor` and the mobile code are unchanged. The real compiled API on real Postgres, `GET /lessons/:slug`:

| Lesson | Front | `recap` |
|---|---|---|
| Kana, tracer | あ い う え お | a, i, u, e, o |
| Word | よろしくおねがいします | please remember me; please help me; please treat me well; I look forward to working with you |
| Word | ありがとうございます / ごちそうさまでした | thank you / thank you for the meal; that was a delicious meal; what a wonderful meal |
| Word, stored as 鍵 | かぎ | key |
| Grammar | に | Marks where something is (in, at, on), when something happens (at, on), or where you are going (to). |
| Grammar | 〜がすきです / 〜たいです | I like. The thing you like comes before が. / I want to. Goes on the end of a verb to say what you want to do. |
| Kanji | 生 | life, then 19 clean readings |
| Kanji | 一 | one, then イチ・イツ・ひと・ひと(つ) |

The screen matched this table on every card.

# Round 3 findings, rechecked

| Finding | Status | How checked |
|---|---|---|
| N5 Low, strict mode on every kana target | **Fixed** | Table above, over HTTP. A mutation that skips the table on every kana target fails 10 tests |
| D1, `ja:grammar:へ` matched nothing | **Fixed in code**, the decision log is D2 | `course-rules.ts:45` names `ja:grammar:にへ`, confirmed against the compiled outline |
| N1 Medium | **Still fixed** | Seven rows above, including with punctuation |
| N2, N3 | **Still fixed** | Gate scans rerun on this commit, mutations caught |
| N4 Low, 6,000-character answer returns 500 | Open, outside this unit, doesn't block | Unchanged. Backlog in `dev.md` |
| F2 Medium, recap card | **Fixed, seen rendered in round 5** | See "Simulator check" |

# Promises

Status at code level. "Later" means final delivery needs drafted content and an Alpha run.

| # | Status | How checked |
|---|---|---|
| P1 | Holds, Later | Round 2 gate probes carried, this diff doesn't touch that path |
| P2 | Holds, Later | Round 2 |
| P3 | Holds, Later | Round 1 |
| P4 | Holds, Later | Round 1 |
| P5 | Holds, Later | Round 1, `triage.md` |
| P6 | Holds, Later | Round 1 grader check. The 22 rows exist on real Postgres (round 3) |
| P7 | Holds, Later | Round 2 F1 table |
| P8 | Holds on real Postgres, Later | Round 3: exactly 24 grammar meanings, verbatim. Default-branch ingest is after merge |
| P9 | Holds, Later | Round 1 |
| P10 | Holds, Later | Round 1 |
| P11 | Holds, Later | Round 3: real `authoring:outline` on the branch, 120 lessons, 17 chapters |

**PM constraint on F3** ("must never be marked wrong"): now holds for rōmaji on every target, kana targets included. `konnichiwa` passes on all of them.

# Findings

**F2. Medium. Fixed and closed.** All four conditions seen on a 375pt device. See "Simulator check".

**T1. Tooling, not this PR's code. Doesn't block.** `expo start --ios` exited with code 7 after bundling, from an unhandled error in its own window-activation step: `osascript -e tell app "System Events" to count processes whose name is "Simulator" or name is "DeviceHub" exited with non-zero code: 1`. It took Metro with it. The log doesn't carry `osascript`'s own error text, so a missing macOS Automation permission is a guess, not confirmed. **Workaround, confirmed working:** `expo start --offline` with no `--ios`, then the simulator tool's `open_url` with `exp://127.0.0.1:8081`. `pnpm --filter mobile ios` in `ops/PROJECT.md` runs the same `expo start --ios`, so an Alpha run from this kind of session would hit this, and the Lead may want the workaround recorded there.

**V1. Low, cosmetic, this PR's card. `apps/mobile/src/lesson/LessonPlayer.tsx:250` (the back's `Text`). Doesn't block.** The back wraps wherever the line runs out, so 生's readings split inside a reading: `い` / `(ける)`, `う(ま` / `れ)`, `む` / `(す)`. Nothing is lost or clipped, and F2 asks for full wrapping, which holds. A grammar meaning can also leave a short last line, such as `が.` for 〜がすきです. Separately, for the PM: 19 readings on one card is what the table asks for and it fits, but it is a lot for a beginner, and the PM may want to look at it when real kanji lessons are reviewed at 22b.

**V2. Low, cosmetic, existing code, not from this PR. `apps/mobile/src/lesson/LessonPlayer.tsx:435`. Doesn't block.** On "Lesson complete" the Done button is only as wide as its label, so the text almost touches the button's edges. Seen on all four lessons. The PR doesn't touch `DoneScreen` or `ui.tsx`.

**N6. Low. Existing code, not from this PR. `apps/api/src/writing-eval/writing-eval.service.ts:105`. Doesn't block.** The Developer flagged half of this. It's wider than the note says: punctuation is forgiven only for rōmaji input, so a learner typing the exact kana can be marked wrong in either direction. A stored `こんにちは！` marks a typed `こんにちは` wrong, and a stored `こんにちは` marks a typed `こんにちは！` or `こんにちは。` wrong. The gate lets a stored `こんにちは！` through. `main` has the same equality check with no separator handling, so this PR neither caused nor worsened it. The absolute-beginner persona types rōmaji, so it mainly reaches a returning learner with a Japanese keyboard. The fix is to strip `SEPARATORS` from both sides before the equality check. It belongs with N4 as a small new unit, and the PM can choose to pull it forward.

**D2. Documentation only. Doesn't block. `decisions.md` H.2.b.** It now misdescribes the code in three ways: it says the allowance applies only to non-kana targets, while after `c040271` a kana target loses it only for a lone kana; it says the outline never teaches へ (it does, at lesson 90); and its "Reverse" names `writing-eval.service.ts` for the kana-target check, which sits at `checks.service.ts:148`. The log is append-only, so it needs a new entry from the Lead or Tech Lead.

## Code review candidates

| # | Candidate | Disposition |
|---|---|---|
| 1 | A lone は on a vocab target still accepts `wa` (歯) | Confirmed in principle, not reachable in the beta. `ja:vocab:歯` and `ja:vocab:葉` exist but are not among the outline's 342 items. Worth revisiting if a later chapter adds them |
| 2 | Kanji reading recall accepts `wa` for a reading は | Not reachable. Run on all 103 live kanji: 103 reading questions, 0 accept a lone は, へ or を |
| 3 | Punctuation forgiven for rōmaji only | Confirmed, **N6** |
| 4 | Spaced kana such as `は ひ ふ へ ほ` escape the lone-kana rule, so `wa hi fu e ho` passes | Confirmed over HTTP, and not blocking. A check has one `targetItemId`, so drafts write one question per kana, and the learner would have to type `wa` for は in a row drill before the course has mentioned it (kana targets end at lesson 38, particles start at 43). The Developer's spec pins `wa o` for `は を` on purpose. `words.every((w) => w.length === 1)` would close it if the Tech Lead wants it |
| 5 | `o` for を is wrong on a kana target | Not a defect, as in round 3. The stored rōmaji is `wo`, reviews accept only `wo`, `main` is the same |
| 6 | では and それでは can't be matched by `dewa` | Not reachable. Both rows exist, neither is in the outline. The outline's only words with は, へ or を past the first character are ごはん, こんにちは, おはようございます, こんばんは and はは. Only the two greetings read は as wa, and both are in the table |
| 7 | `ha.` is right in a lesson check but wrong in a review | Existing, separate path. Reviews have always compared rōmaji exactly. Not a change from this PR |
| 8 | `SPOKEN_PARTICLES` ids aren't validated | Hardening, Tech Lead's call. The id is right today |
| 9 | Comment at `checks.service.ts:144` still states the old rule | True, cosmetic. It's correct for a lone kana but no longer the whole rule. Worth a word next time the file is touched |
| 10 | Expression style, separator list duplicated | Style, as in rounds 2 and 3 |

# Carried forward from round 3 (on `9eed6f6`, not repeated)

No ingest or mobile file changed in this round's diff.

| What | Result |
|---|---|
| `expo export --platform ios --clear` | Exit 0, Metro cache rebuilt, 800 modules, 3 MB bundle |
| "Before" fingerprint, taken from the branch | 1,593 rows, `833428583a37cd64af6b40bc9fb76e4e`. 0 grammar meanings |
| Real `ingest:items supplement`, first run | `inserted 32 of 32 rows, filled 14 empty grammar meaning(s)` |
| After | 1,625 items, 50 grammar. Original 1,593 match "before" with the 14 meanings blanked, and row by row exactly those 14 changed |
| New rows | 32 (22 VOCAB, 10 GRAMMAR), exact ids expected, key present and null on all |
| Grammar meanings | Exactly 24, all verbatim |
| Second run | `inserted 0 of 32 rows, filled 0`. State identical |
| Sentinel test on real `skipDuplicates` and `meaning: null` | Deleted row reinserted, two nulled meanings refilled, sentinel untouched. Confirms F8's "a retry completes" on Postgres |
| `authoring:outline --output <scratch>` on the branch | Exit 0: 17 chapters, 120 lessons, 342 items, `compiled-outline` |
| Default branch, read-only | 1,593 rows, 0 grammar meanings, same fingerprint |
| The two N2 deviations in `dev.md` Round 2 | Both right. Deviation 2's reason was wrong about へ, corrected in `dev.md` |

Round 3's candidates that this diff doesn't change: `こん ばんは` and `こん にちは` passing the gate (not credible output); a particle before lesson 43 passing the gate (accepted risk, `tech.md` section 5); `ごはんです` rejected with an imprecise message (the prompt requires spaces); the position of `joined.includes(k)` (only nonsense answers reach it).

# Carried forward from round 2 (on `2427db6`, not repeated)

**F1 ruling, real course context**

| Text | Rejected at | Passes at |
|---|---|---|
| あります, ありますか | 73 | 74 |
| います, いますか | 74 | 75 |
| ほん が あります。 かばん も あります | | 77 |
| ほん は つくえ の うえ に あります, せんせい は どこ に いますか | | 81 |
| ぎんこう は えき の みぎ に あります | | 83 |
| ありません, いません | 81, 87 | 88 |
| ありました, いました | 81, 91 | 92 |
| かいます, ほん を かいます | 81 | 87 |
| いきますか | 81 | |
| たべ ます | 86 | |
| ありませんか, いませんか | 99 | 100 |

| Round 1 finding | Status |
|---|---|
| F1 High | Fixed |
| F3 Medium | Fixed, on every target since `c040271` |
| F4 Low | Fixed |
| F5 Low | Fixed, real CLI |
| F6 Low | Fixed, six prompts |
| F7 Low | Fixed |
| F8 Low | Justified by the Tech Lead. Retry also seen working on Postgres |
| F9 Low | Fixed |
| M1 | Resolved by PR #69 |

Other round 2 results: all 342 outline items through `recapBackFor` (0 null, 0 equal to the front); 30 typed-reading targets × 6 prompts, 0 wrongly rejected. `いきません か` passing in lessons 88 to 99 was judged not a defect, and PM review at 22b should watch for invitations before lesson 100.

# Carried forward from round 1 (on `0dcaf2d`, not repeated)

| What | Round 1 result |
|---|---|
| Spec against the appendix in `brief.md`, by script | 120 lessons, 17 chapters, all match |
| `validateOutline` | 0 errors |
| All 342 items through `recallQuestionFor` | 0 with no question, 0 duplicate prompts, no kanji in word or grammar prompts |
| 24 meanings and 22 JMdict ids | No differences |
| `authoring:grader-check`, 13 cases × 3, plus 28 paraphrases | 13 of 13. 27 of 28 as expected, the other defensible |
| Real `AppModule` over HTTP, kana surface | Prompts and `/curriculum` serve kana |
| `authoring:skeleton --force` at a compiled outline | Refused before any model call |
| G.4.d and G.4.e, every writer of `ItemMasteryState` | Rule holds on the three leaks, mutations caught |
| The eight original deviations in `dev.md` | All fine |

# Not verified

- **Backs longer than the fixture's.** The longest rendered was 生's 19 readings. The back has no line limit and the screen scrolls, so longer text should behave the same, but it wasn't rendered.
- **Larger iOS text sizes.** Not in the plan, not exercised.
- **Real drafted lessons on the card.** Fixture lessons only, because no real lesson exists until 22b.
- **Default-branch ingest and `authoring:outline` against the default path** (`tech.md` section 3 steps 4 and 5). After merge, by plan.
- **A real draft.** No Anthropic spend. First evidence is 22b.
- **Android.** Not in this environment.
- **Linguistic correctness** of meanings and author notes. Nobody on the team can judge it (Blocker 6).
- **Alpha-level delivery** of every promise.
