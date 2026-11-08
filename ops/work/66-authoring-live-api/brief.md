# Brief: authoring tools work against the live API

Small fix with no user-facing change, so no full brief or tech plan (operating model section 4). Written by the Lead.

**What:** PR [#66](https://github.com/amshahed/sensei/pull/66) makes the lesson-authoring CLIs work against the real Anthropic API, plus fixes for all 10 findings from its first code review (commit `f0ce56d`).

**Why:** every paid authoring step for the lesson batch (#22) depends on it.

**Acceptance:**
1. A blank model setting falls back to the default model.
2. The drafter and outline calls don't send `temperature` to Opus 4.8. The critic does send `temperature: 0` to Haiku, so its verdict is repeatable.
3. A reply cut off at the token limit is reported as that, in every model call including grammar references and `AnthropicLlmClient`.
4. `authoring:skeleton` refuses to overwrite an existing outline without `--force`, before any paid call.
5. The outline records the model and token usage actually used, not what the model claimed.
6. JSON extraction survives braces in the surrounding text.
7. Cost lines use current prices.
