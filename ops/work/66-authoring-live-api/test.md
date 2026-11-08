# Test: PR #66, authoring tools work against the live API (round 2)

## Verdict: PASS

**Commit:** `b6a896043caa32360064577beb5565400da18a55` (`fix/authoring-live-api`). A new commit voids this.

All seven acceptance items are met. F1 to F5 from the round 1 FAIL on `f0ce56d` are fixed, each confirmed by running it. Nothing new blocks the merge. The trade-offs `dev.md` flags for F2 were each reproduced and are accepted below, with reasons.

No `tech.md` exists for this unit, which is allowed for a right-sized fix. The test ran against `brief.md`, `dev.md` and the PR diff.

## Acceptance

| # | Item | Status | How checked |
|---|---|---|---|
| 1 | Blank model setting falls back | **Met** | Real CLIs with `LLM_AUTHORING_MODEL=` and `LLM_CRITIC_MODEL=` blank: requests left as `claude-opus-4-8` and `claude-haiku-4-5` (mock server log and live). |
| 2 | No `temperature` to Opus, `temperature: 0` to Haiku | **Met** | Request bodies logged: skeleton and draft have no `temperature` key, critic has `temperature: 0`. **Live:** Opus 4.8 accepted the skeleton request without it, and Haiku accepted `temperature: 0`. |
| 3 | Cut-off reply reported as such, in every model call | **Met** | All 6 call sites found by grep: skeleton, draft, critique, grammar reference, `AnthropicLlmClient:108`, `GeminiLlmClient:100`. Real truncations: Opus and Gemini live. Skeleton and draft through the CLI with `stop_reason: max_tokens`. |
| 4 | Skeleton refuses to overwrite without `--force`, before any paid call | **Met** | Real CLI: exit 1, 0 new calls at the mock server, output hash unchanged. With `--force` it proceeds. |
| 5 | Outline records the model and usage actually used | **Met** | Real CLI: a reply claiming `gpt-made-up` and 1/1 tokens was written as the served `claude-opus-4-8-20261001` and 1000/2000. |
| 6 | JSON extraction survives braces in surrounding text | **Met** | All 5 rows of the round 1 table now behave correctly (below). The real 113-lesson outline parses byte-identically bare, fenced, with stray `{` before, and with prose braces on both sides. |
| 7 | Cost lines use current prices | **Met** | CLI cost lines: 1000/2000 at Opus gives ~$0.0550, at Haiku ~$0.0110. Both match $5/$25 and $1/$5. Unchanged since round 1. |

## Evidence

**Verification, uncached, in worktree `test-66` at `b6a8960`.**

| Command | Exit | Result |
|---|---|---|
| `pnpm typecheck --force` | 0 | 4 tasks, 0 cached |
| `pnpm lint --force` | 0 | 1 task, 0 cached |
| `pnpm test --force` | 0 | 49 suites, 587 tests |
| `jest` with all three `LLM_*_MODEL` exported | 0 | 49 suites, 587 tests (F3) |

CI `verify` is SUCCESS on `b6a8960`, and GitHub reports MERGEABLE. `origin/main` is ahead only in ops and config files (0 files under `apps`, `packages` or `tools`), and a trial `git merge-tree` is clean.

**Probe files.** `gh pr diff 66 --name-only` and the tree at `b6a8960` contain no file matching `probe`, `scratch` or `.env`. The PR is the 17 expected files.

**Real CLIs, real SDK, local mock server, real database reads.** `ANTHROPIC_BASE_URL` pointed at 127.0.0.1, so these cost nothing. This closes round 1's "no successful CLI run" gap.

| Run | Result |
|---|---|
| `authoring:skeleton`, reply with prose braces and a fence around the real outline | Exit 0, 15 chapters, 113 lessons, wrote the file |
| Same, no `--force` | Refused, 0 new calls, hash unchanged |
| `--force`, `stop_reason: max_tokens` | "Skeleton hit the 20000-token output limit, so its reply was cut off", exit 1, hash unchanged |
| `authoring:draft`, prose braces before the object | Exit 0, validator pass, no `temperature` in the body |
| `authoring:draft`, `max_tokens` | "Drafter hit the 4096-token output limit...", exit 1 |
| `authoring:critique`, two fenced critiques | Exit 0, took the correction (`overallPass: false`), `temperature: 0` in the body |

**Live calls. Total about $0.03 against the $0.15 limit.**

| Call | Sent | Served | Stop | Tokens | Result |
|---|---|---|---|---|---|
| `generateSkeleton`, default Opus, 3 items per type, reply capped at 800 tokens by the probe | `claude-opus-4-8`, no temperature | `claude-opus-4-8` | `max_tokens` | 1035 / 800 | Reported as cut off. Note that the message quotes the constant 20000, not the probe's cap |
| `generateCritique`, synthetic draft | `claude-haiku-4-5`, temp 0 | `claude-haiku-4-5-20251001` | `end_turn` | 832 / 557 | Reply began with a code fence and parsed. Verdict false |
| `GeminiLlmClient`, `gemini-3.5-flash` set by env var, `maxTokens: 5` | | | `MAX_TOKENS` | | "Gemini reply hit the 5-token limit, so its JSON was cut off." |
| Same, `maxTokens: 512` | | | | | Parsed normally |

**Do the new tests catch regressions?** Mutations made in the test worktree, one at a time, and restored:

| Mutation | Tests that failed |
|---|---|
| Remove the Gemini `MAX_TOKENS` check | 3 |
| First candidate wins (no `reverse`) | 3, including `generateCritique` taking the correction |
| Parser no longer string-aware | 1 |
| Record the requested model, not `res.model` | 1 |
| Restore the old "its JSON was cut off" wording | 3 |

**Code review.** `/code-review high` ran on the PR and returned 10 unverified candidates. Each was run or read before being accepted or set aside below. Nothing was posted to the PR.

## Round 1 findings

| # | Status | How confirmed |
|---|---|---|
| F1 Gemini truncation | **Fixed** | Live truncation through the real SDK, and the mutation run. The check comes before `text()`, so the empty-text case is reported correctly |
| F2 JSON extraction | **Fixed** | Table below, the real outline, and `generateCritique` through the CLI |
| F3 Specs depend on env | **Fixed** | Full suite passes with all three vars exported. `beforeEach` clear and `afterEach` restore are present in both specs |
| F4 Requested vs served model | **Fixed** | CLI run recorded the mock's dated id. Live, the field is populated. The `?? model` fallback only applies when it's absent |
| F5 Grammar wording | **Fixed** | Message reads "its reply was cut off", and the mutation run fails 3 tests |
| F6 to F12, draft overwrite | **Justified in round 1, unchanged** | Still accurate. They remain candidates for new units, listed in the round 1 text: F6 grammar ingest aborts on one truncation, F7 critic temperature with an Opus override, F8 API version `2026-10-21` rejects `temperature`, F9 README's repeatability claim, F10 timeout and retries, F11 refusal stop reason, F12 guard covers one path. `authoring:draft` still overwrites without asking; the PM should decide this before #22 |

**F2's table, on `b6a8960`.**

| Reply | Result |
|---|---|
| Two fenced critiques | The correction |
| 8 and 50 `{...}` placeholders before the real object | The real object |
| 8 and 50 `}` after it | The real object |
| Example object, then real object | The real object |
| Malformed outer object with a valid nested fragment | Throws "non-JSON output" |

Also correct: stray `{` before, stray `}` before, braces and escaped quotes inside strings, a stray `"` in prose, Japanese text with braces, CRLF fences, empty and whitespace replies, 5000-level nesting.

## F2 trade-offs, each reproduced

None blocks the merge. The two silent ones need a model to do something it hasn't done in any call seen so far and that the prompts forbid, and the output still goes to PM review.

| Case | Observed | Failure mode | Judgement |
|---|---|---|---|
| A valid JSON aside after the real object | `{real} Note: I used {"id":"a"}` returns the aside. Real `generateCritique` throws `ZodError` | **Loud**, costs the call | Accept. `{}` in trailing prose does the same and is the likelier form. It's a real regression from `f0ce56d`, but it's the direct cost of the last-object rule that F2 asked for, and no bad data gets through |
| Stray `{` and `}` wrapping the real object | Throws | **Loud** | Accept. Same shape as F2's malformed-outer row, so the two can't be told apart |
| Malformed final object after a valid one | Real `generateCritique` returned the first verdict, `overallPass: true`, where the malformed correction said false | **Silent** | Accept, low. Needs the model to repeat itself and write invalid JSON in the correction. A truncated correction can't reach this, because `assertComplete` runs first |
| Fenced array of objects | Returns the last element, and real `generateCritique` accepted it | **Silent** | Accept, low. All three prompts ask for one object |
| Fenced non-object | `[1,2]` in a fence throws, bare `[1,2]` parses and Zod rejects it | **Loud** | Accept |
| Cost bound removed | Only unclosed braces are quadratic: 20,000 took 2.6 s and 80,000 took 47 s. A jest run was going at the same time, so these are slower than `dev.md`'s 0.7 s and 11.9 s. The real 40 KB outline took 1 to 3 ms, 50,000 balanced objects 10 ms | Slow, on input that fails anyway | Accept. One-off CLI |

If the first batch ever shows a lost call from a trailing aside, the fix is to pass the schema in and walk candidates from last to first until one validates. That also closes the two silent rows. It isn't needed for this brief.

## New findings

No blocking findings. All are low severity and need no change for this PR.

**N1. `lesson-prompter.ts:239,330`.** Drafts and critiques record the requested model, while the outline records the served one. Live, the critique stored `claude-haiku-4-5` where the API served `claude-haiku-4-5-20251001`. Acceptance item 5 names the outline only. A one-line follow-up.

**N2. `gemini-llm-client.ts:88`, grading only.** Thinking shares `maxOutputTokens`, and grading passes 512. A cut-off is now reported correctly, but the learner still gets the deterministic fallback. Live on `gemini-3.5-flash`, 512 was enough for a one-sentence reply. Not exercised on real grading prompts. It belongs with the separate `gemini-2.5-flash` unit, which needs a retest anyway.

**N3. Set aside as not a bug.** The review's whitespace claim for `LLM_GRADING_MODEL`: `||` handles a blank value and `.env.example` ships it blank, as in round 1.

## Not verified

- **A full-size live outline or draft on Opus.** A full outline costs about $0.47, over the $0.15 limit. Live Opus was exercised with a small prompt and a capped reply, which proves the request is accepted and truncation is reported. Full-size output went through the real CLI against a mock server.
- **Live Gemini on the configured default.** `gemini-2.5-flash` is a separate unit, per the task, so the check used `gemini-3.5-flash`.
- **How often real models emit trailing JSON asides.** The two live Claude replies in this round had none. The last-object rule is judged by failure mode, not by frequency.

## State left behind

- Worktree `.claude/worktrees/test-66` is detached at `b6a8960` and clean. `wt-14` was not touched.
- `tools/authoring/output/skeleton.json` in the main checkout is unchanged: hash `d935f052...`, modified Nov 4 23:52:57.
- Nothing was committed, and no source files were changed. Mutations were restored.
- Paid spend this round: about $0.03, plus a fraction of a cent on Gemini.
