# Dev: PR #66, Tester round (F1 to F5)

**Commit:** `b6a896043caa32360064577beb5565400da18a55` on `fix/authoring-live-api`, pushed to PR #66. Replies to `test.md` on `f0ce56d`.

No `tech.md` for this unit (right-sized fix), so no deviations from a plan. All five findings were accepted and fixed. None was argued against.

## What changed

| # | Fix | File | Proof |
|---|---|---|---|
| F1 | `GeminiLlmClient` reports a `MAX_TOKENS` finish as the token limit. Checked before `text()`, because the reply can be partial or empty. `GeminiModelLike` gains `candidates` | `llm/gemini-llm-client.ts` | 4 tests in `gemini-llm-client.spec.ts`, plus a live truncation (below) |
| F2 | `parseLlmJson` is the whole reply if that's JSON, otherwise the last top-level balanced object that parses. String-aware, and never looks inside a balanced span. The fence regex and the 8-brace window are gone | `authoring/authoring-llm.ts` | All 5 rows of the Tester's table in `authoring-llm.spec.ts`, plus `generateCritique` taking the corrected verdict in `lesson-prompter.spec.ts` |
| F3 | The specs that pin default models clear `LLM_AUTHORING_MODEL` / `LLM_CRITIC_MODEL` first and restore after | `skeleton.spec.ts`, `lesson-prompter.spec.ts` | 3 new "calls the configured model" tests, and the mutation runs below |
| F4 | The outline records `res.model` from the API, falling back to the requested name only if the field is absent (fakes). `AnthropicLike` gains `model` | `authoring/skeleton-prompter.ts`, `llm/anthropic-llm-client.ts` | "records the model the API says served the call" in `skeleton.spec.ts` |
| F5 | The error now says "its reply was cut off" | `authoring/authoring-llm.ts` | Exact-sentence assertion in `grammar-ref.spec.ts`, and `not.toThrow(/JSON/)` in `authoring-llm.spec.ts` |

The new and changed tests were run against the unfixed code first: 16 failed, and all 16 pass with the fixes. The others passed before and after, as regression pins (string-aware scanning, a stray `{`, a normal `STOP` finish, 7 stray closers). F3's are proved by the mutation runs below. (The unfixed run had the `candidates` and `model` type additions in place, so the failures were behaviour and not compile errors.)

## Verification

| Check | Result |
|---|---|
| `pnpm typecheck --force` | exit 0, 4 tasks, 0 cached |
| `pnpm lint --force` | exit 0, 1 task, 0 cached |
| `pnpm test --force`, model vars unset | exit 0, 49 suites, 587 tests |
| `pnpm test --force --env-mode=loose`, all three `LLM_*_MODEL` exported | exit 0, 49 suites, 587 tests |
| `jest` directly, all three exported | exit 0, 49 suites, 587 tests |
| CI `verify` on `b6a8960` | SUCCESS, PR reported MERGEABLE |
| F3 mutation: no `beforeEach`, vars exported | The Tester's exact 4 failures |
| F3 mutation: no `beforeEach` or `afterEach`, nothing exported | The same 4 fail, so the suite now catches a leak in CI too |
| `parseLlmJson` on the real 113-lesson outline (40 KB): bare, stray braces both sides, fenced with 12 placeholders and 12 closers | 113 lessons, byte-identical JSON each time |

Plain `pnpm test` can't exercise exported model vars, because Turborepo's strict env mode strips them. That's why the exported runs use `--env-mode=loose` and direct `jest`.

**Live truncation, through the real SDK and `GeminiLlmClient`.** Model `gemini-3.5-flash`, set by env var for this probe only (see the first item under "Outside this plan" for why not the default). Cost is a fraction of a cent.

| `maxTokens` | Served by | `finishReason` | Text | Result |
|---|---|---|---|---|
| 5 | `gemini-3.6-flash` | `MAX_TOKENS` | 0 chars, 2 thinking tokens | "Gemini reply hit the 5-token limit, so its JSON was cut off." |
| 512 | `gemini-3.6-flash` | `STOP` | 73 chars | Parsed normally |

The first row is the empty-text case: without the early check it would have read "no text content".

## Look at these hard

Consequences of taking the last complete object, as F2 asked:

- **A valid JSON aside after the real object now wins.** `{real} Note: I used {"id":"a"}` returns the aside. The caller's Zod schema rejects it, so it fails loudly but costs the call. The old code returned the real object here.
- **A stray `{` and a stray `}` wrapping the real object now throw.** `Using { here: {"a":1} done }` has the same shape as F2's row 5, the malformed outer object, so the two can't be told apart. Throwing was preferred to guessing.
- **A malformed final object after a valid one returns the valid one.** A span that doesn't parse looks the same as a `{placeholder}`. This needs a model that both repeats itself and emits bad JSON.
- **A fenced non-object is no longer returned.** A fenced `[1,2]` now throws, and a fenced array of objects yields its last object. All three callers require an object, and an unfenced non-object reply still parses through the whole-reply path.
- **The cost bound is gone.** Only braces that never close cost more than linear time. Measured worst case: 20,000 unclosed braces took 0.7 s and 80,000 took 11.9 s, the latter being about the most a 20k-token reply could hold. It's a one-off CLI on input that would fail anyway, so I didn't add code for it.

## Not verified

- No live Claude call this round. F4 reads a field the Tester already saw on a live response (`claude-haiku-4-5-20251001`), and a live outline run would cost about $0.47.
- The live Gemini check ran on `gemini-3.5-flash`, not the configured default, which this key can't call.

## Outside this plan, for the Lead, Tech Lead and PM

1. **Runtime AI grading looks broken today, and this PR doesn't change that.** With this project's key, `gemini-2.5-flash` (the default in `gemini-llm-client.ts`) returned a 404 on `generateContent`, saying the model is "no longer available to new users". `apps/api/.env` sets no `LLM_GRADING_MODEL`, so any grading call with this key should fail and fall back to deterministic grading, as `grading.service.ts` does on error. `.env`-less CI wouldn't see it. Learners aren't blocked, but they don't get AI feedback. The model is a locked decision (L.4.a), so I changed nothing. It needs a new decision entry and a retest.
2. **`GeminiLlmClient` has no request timeout of its own.** A probe on `gemini-flash-latest` hung for over four minutes on a 5-token request before I stopped it. Grading wraps calls in `GRADE_TIMEOUT_MS`, so learners are covered, and I didn't investigate why it hung.
3. **Drafts and critiques still record the requested model in `meta.model`.** Same pattern as F4, in `lesson-prompter.ts`. F4 and acceptance item 5 name the outline only, so I left them.
4. The PR branch is two ops-only commits behind `main`. GitHub reports it mergeable, so I didn't rebase.
