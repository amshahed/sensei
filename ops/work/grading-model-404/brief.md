# Brief: AI grading model no longer available

Written by the Lead from a Developer finding (`ops/work/66-authoring-live-api/dev.md`). Small and with no change to what the product intends, so no full PM brief.

**Problem:** the runtime grading default from L.4.a, `gemini-2.5-flash`, returned 404 on `generateContent` with this project's key ("no longer available to new users"). `apps/api/.env` sets no override, so open-response grading presumably falls back to the deterministic grader on every answer. Learners would get worse feedback and nothing would report it.

**Promise:**
- **P1.** When I type an answer in my own words that is right but not an exact match, it is graded as right.

**Must also hold:** a model that disappears again is visible in logs, and doesn't stay silent.
