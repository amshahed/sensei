# Dev notes: confirming the learner is 18 or over

Unit `age-confirmation` (M.5, M.5.a, M.5.b). Written by the Developer, 2026-11-28, against `tech.md` and `brief.md` (P1 to P6). Branch `feat/age-confirmation`, worktree `.claude/worktrees/age-confirmation`, from `origin/main` `cf47d11`. Main has only ops-file commits since, and the branch merges cleanly. PR [#107](https://github.com/amshahed/sensei/pull/107), head `4c75871`.

---

# 1. What changed

| Task | Files | What |
|---|---|---|
| T1 | `prisma/schema.prisma`, `prisma/migrations/20261124230000_age_confirmation/migration.sql` (new) | `AgeAnswer` enum (`ADULT`, `UNDER_18`), nullable `User.ageAnswer` and `User.ageAnsweredAt`. The SQL is byte-identical to `prisma migrate diff --from-schema-datamodel <main schema> --to-schema-datamodel prisma/schema.prisma --script` (bar Prisma's leading blank line) |
| T2 | `packages/types/src/index.ts` | `AgeAnswer`, `AgeAnswerRequest`, `OnboardingDto.ageAnswer: AgeAnswer \| null` |
| T3 | `auth/age-exempt.decorator.ts`, `auth/age-gate.service.ts`, `auth/age.guard.ts` (new), `auth/auth.module.ts` | Global `AgeGuard` registered after `AuthGuard` (providers: `AgeGateService`, `APP_GUARD` `AuthGuard`, `APP_GUARD` `AgeGuard`). `@Public()` and `@AgeExempt()` pass without a lookup. No `userId` gives 401. Otherwise only `ADULT` passes; null or a missing row gives 403 "Age not confirmed yet.", and `UNDER_18` gives 403 "Sensei's beta is for adults for now." |
| T3 | `users.controller.ts`, `onboarding.controller.ts`, `onboarding.service.ts` | `@AgeExempt()` on exactly `GET /me`, `GET /onboarding` and `POST /onboarding/age`. `isAgeAnswerRequest()` gives 400 on anything but `{ answer: 'ADULT' \| 'UNDER_18' }`. `submitAge()` upserts the row, then runs `updateMany({ where: { id, ageAnswer: null } })` as a compare-and-set, then returns `status()`. `status()` returns `ageAnswer` on every branch |
| T4 | `apps/mobile/src/api.ts` | `api.answerAge(answer)` |
| T4 | `apps/mobile/src/auth/AuthGate.tsx` | `SignOutContext` (default `null`) and `useSignOut()`. `AuthedApp` provides Clerk's `useAuth().signOut`; dev-stub mode provides nothing, so the hook returns `null` |
| T4 | `apps/mobile/src/onboarding/AgeScreen.tsx` (new) | `AgeQuestion`: "Sensei’s beta is for adults for now." then "Are you 18 or older?", and two choices, "I’m 18 or older" and "I’m under 18", both rendered by intake's existing `Option` component, unselected, same style and size, stacked full width. One tap submits. Both are disabled while saving. Error: "Couldn’t save your answer — try again." `AdultsOnly`: the title, body and mis-tap copy from tech.md 1.4, word for word, with a "Sign out" footer button only when `useSignOut()` is non-null. No API call |
| T4 | `apps/mobile/src/onboarding/OnboardingGate.tsx` | After status loads and before intake: `ageAnswer === null` shows `AgeQuestion`, any other non-`ADULT` value shows `AdultsOnly`, and `ADULT` goes on to the unchanged intake, placement and app flow |

**Specs.** `age.guard.spec.ts` (adult, under 18, unanswered, `@Public`, `@AgeExempt`, no user), `onboarding.service.spec.ts` (missing row, first answer stored with a timestamp and created row, never overwrites in both directions), `onboarding.controller.spec.ts` (validator). In `app.integration.spec.ts`, the three existing bootstraps override `AgeGateService` with an always-`ADULT` stand-in, and a new `describe` boots the real gate over the fake Prisma with a `parseJson` spy on `LLM_CLIENT`. For an unanswered and an under-18 user: the four grading routes, intake, placement, curriculum, lesson, reviews due, practice start, chapter assessment start and streak all give 403, and the grader is never called. An adult gets 201 on intake and 200 on curriculum (so `AuthGuard` ran first), and its review answer does reach the grader. Re-answering never flips either answer. Existing `OnboardingDto` expectations gained `ageAnswer: null`. No assertion was loosened.

# 2. Deviations from tech.md

1. **T5 replaced, by the Lead's ruling.** This session runs on the Linux server, which has no iOS simulator and no Chrome, so no SE screenshot of the question was possible. In its place: the migration applied to `test-open-check-followup`, a curl smoke of the PR's API on that branch, and the iOS bundle check (section 3). **The screenshot is deferred to the Tester on the Mac**, with the tech.md section 4 Tester-sim cases.
2. **Once an answer is present, `OnboardingGate` stops on anything that isn't `ADULT`**, not only on `'UNDER_18'`. It is the same for today's two values, and it fails closed if the enum ever grows.
3. **Two small UI states tech.md didn't name.** `AgeQuestion` shows a grey "Saving…" while the answer is in flight, because both choices are disabled and neither is selected, so nothing else shows that the tap landed. `AdultsOnly` shows "Couldn’t sign out — try again." if Clerk's `signOut()` rejects, and re-enables the button.
4. **The integration gate check covers three more routes** than tech.md 1.5 lists: `POST /practice/sessions`, `POST /chapters/:id/assessment` and `GET /streak`, taken from the Tester-API list in section 4.
5. **`AuthedApp` now renders its children only after it has installed the token provider** (review finding 1). This is a fix to a bug that predates the unit, outside the letter of the plan, so the Tech Lead can veto it. Why I made it: React runs a child's effects before its parent's, so with Clerk on, `OnboardingGate`'s first `GET /onboarding` went out before `AuthedApp`'s effect had set the token. The request got a 401, and every cold launch opened on "Couldn’t reach Sensei" with Retry, where P1 says the age question. That is the path P6 and the founder's Blocker 7 walkthrough take. The change is a `ready` flag set in the same effect, about four lines, and it costs one blank frame. Dev-stub mode is untouched.
6. **A response with no `ageAnswer` field shows the question** (`!state.ageAnswer`), not `AdultsOnly` (review finding 2). That case is an app bundle newer than its API, for example between the two steps of the tech.md 3.3 deploy. Asking the question there is a dead end (saving 404s, so the screen says "try again"), but it doesn't tell an adult they're under 18. Any other non-`ADULT` value still stops at `AdultsOnly` (item 2).

# 3. Evidence

## Verification

- `pnpm typecheck` 4/4, `pnpm lint` clean, `pnpm test` 67 suites, 1,605 tests. Run on `72e07d5`, then again with the review fixes (section 6), with the same results.
- `pnpm --filter mobile typecheck` clean.
- `expo export --platform ios` (Clerk key empty): 801 modules, bundled, both before and after the review fixes. The Hermes bundle contains "Are you 18 or older?", "Sensei is for adults for now" and `/onboarding/age`.
- **Not run:** the app on a simulator or device (section 2 item 1), and anything in Clerk mode.

## Migration on the throwaway branch

`test-open-check-followup` (`br-winter-poetry-baq6sbs4`), confirmed with `describe_branch` as `default: false`, `primary: false`. Direct (non-pooler) URL from the Neon MCP, used only through `DATABASE_URL` in the environment and never written into the repo. The worktree has no `.env`, so nothing else could load: the API logged "GEMINI_API_KEY not set".

- Before: the last migration was `20261104230000_reminders`.
- `prisma migrate deploy`: "Applying migration `20261124230000_age_confirmation`", then "All migrations have been successfully applied". A second run: "No pending migrations to apply."
- Columns: `ageAnswer` (`AgeAnswer`) and `ageAnsweredAt` (`timestamp`), both nullable with no default. Enum labels `{ADULT,UNDER_18}`. All 6 existing `User` rows had both null.
- **Drift check, read this before 3.2 step 5.** `prisma migrate diff --from-url <branch> --to-schema-datamodel prisma/schema.prisma --exit-code` exits 2, and its only difference is `DROP INDEX "ReferenceDoc_embedding_hnsw_idx"`. That HNSW index is raw SQL in `20260615120000_reference_doc`, which Prisma can't model (the column is `Unsupported("vector(1024)")`). It predates this unit and will show on any branch. Nothing about `User` or `AgeAnswer` differs.

## The PR's API on that branch (dev-stub auth, `DEV_USER_ID=dev-age-smoke`, port 3100)

| User | Request | Result |
|---|---|---|
| `dev-age-smoke` (fresh) | `GET /health`, `GET /me` | 200, 200 |
| | `GET /onboarding` | 200 `{"ageAnswer":null,"intakeDone":false,"placement":"not_needed"}` |
| | `POST /onboarding/intake` | **403** "Age not confirmed yet." |
| | `POST /onboarding/age` `{"answer":"maybe"}` | 400 |
| | `POST /onboarding/age` `ADULT` | 201 `ageAnswer: "ADULT"` |
| | `POST /onboarding/age` `UNDER_18` | 201, still `ageAnswer: "ADULT"` |
| | `POST /onboarding/intake` | **201** `{"ageAnswer":"ADULT","intakeDone":true,...}` |
| | `GET /curriculum` | 200 |
| `dev-age-smoke-minor` (fresh) | `GET /onboarding` | 200 `ageAnswer: null` |
| | `POST /onboarding/age` `UNDER_18`, then `ADULT` | 201 `UNDER_18` both times |
| | `GET /onboarding`, `GET /me` | 200 `UNDER_18`, 200 |
| | `POST /onboarding/intake`, `POST /placement`, `GET /curriculum`, `GET /reviews/due`, `POST /practice/sessions`, `GET /streak` | **403** "Sensei's beta is for adults for now." on every one |
| `dev-user` (existing on the branch: intake done, 1 lesson completion, 11 mastery rows) | `GET /onboarding` | 200 `{"ageAnswer":null,"intakeDone":true,...}` |
| | `GET /curriculum` | 403 "Age not confirmed yet." |
| | `POST /onboarding/age` `ADULT`, then `GET /curriculum/next` | 201, 200 |

SQL afterwards: `dev-age-smoke` has `ADULT` with `ageAnsweredAt` 01:08:09.923, earlier than its `intakeCompletedAt` 01:08:10.341, so the second, `UNDER_18` post (sent between them) wrote nothing. `dev-age-smoke-minor` has `UNDER_18` and no intake. For `dev-user`, the lesson completion, the 11 mastery rows (md5 of the rows `0c0bbe9f…` before and after) and the intake fields are identical before and after answering. Only `ageAnswer` and `ageAnsweredAt` changed.

The branch now holds the migration and those three answered rows. `test-age-confirmation` (`br-red-mud-batele3k`) and the default branch were not touched. No Neon branch was created or deleted.

# 4. For the Tester: look hard at

1. **The simulator cases (tech.md section 4, Tester-sim).** Nothing in the app has run on a device or simulator yet. Typecheck and the bundle are all the app evidence there is.
2. **Equal weight (P1).** Both choices are `Option` with `selected={false}`: the outlined intake style, not the black primary button. Check the shot reads as two equal answers, not as one default.
3. **P6.** `AuthedApp` provides `useAuth().signOut` wrapped in a `useCallback`. Only the harness method can show the button here.
4. **The Clerk-mode first-request fix (section 2 item 5) can't be proven here.** Neither the Tester nor I can sign in through Clerk. Read the change, and the Blocker 7 walkthrough should confirm that the first signed-in screen is the age question, not "Couldn’t reach Sensei". The Lead may want to add that to Blocker 7's wording.

# 5. Process notes

- **The commit `9aa0ed2`** is the previous Developer's handoff commit ("wip … Not verified: may not pass"). Its content passes now (section 3). I didn't rewrite pushed history to reword it, because history rewrites are on the stop list. It lands in `main` under the merge commit.
- **This server has no git identity configured.** My commits pass `-c user.name -c user.email` with the author already used on every commit in this repo, and change no config. Worth a line in `ops/PROJECT.md` gotchas (Lead).

# 6. Review and PR

## `/code-review high`, five findings

| # | Finding | Outcome |
|---|---|---|
| 1 | With Clerk on, the first `GET /onboarding` after a cold launch has no token, so it 401s and the app opens on "Couldn’t reach Sensei" instead of the question. Predates the branch | **Fixed** (section 2 item 5) |
| 2 | A response without `ageAnswer` (an app newer than its API) shows an adult the under-18 screen | **Fixed** (section 2 item 6) |
| 3 | A learner with reminders scheduled keeps getting study notifications while stuck at the question or the under-18 screen, because `ReminderSync` only mounts past the gate | **Not fixed: no account can be in that state.** Reminders are turned on only from inside the app shell, past `OnboardingGate`, where `ReminderSync` lives. Every future account meets the age question before the intake, so it can't have reminders while unanswered or under 18. The only pre-existing live account has no intake (tech.md section 0), so it never reached the shell or the reminders offer. Alpha learners are fresh dev-stub ids. Calling `clearScheduled()` from the gate would be code for a state that can't occur |
| 4 | After a team reset of a mis-tap, the under-18 screen stays until the app is reopened, because status is read only on mount | **Not fixed: as planned.** tech.md 1.4 says `AdultsOnly` has "no other button and no API call", and 3.4 says the learner gets the question "on next open". The reset is a rare, person-to-person team edit through the founder, so the message can include "close Sensei fully and open it again". **For the Tech Lead**: add that line to the 3.4 procedure. Or, if wanted, a foreground re-read of `GET /onboarding` on `AdultsOnly` is a small follow-up |
| 5 | Two quick taps on different choices can send two requests before the buttons disable, and whichever lands first is stored | **Not fixed: the premise doesn't hold.** Both responses carry the stored answer (the compare-and-set returns `status()`), so the screen always matches what the server kept. A ref guard would store the first tap, which in the finding's own scenario is the mis-tap, so it wouldn't change the outcome the finding worries about. A mis-tap that sticks is accepted by design (brief 3.3, tech.md R5). The window is also tiny: `setSubmitting(true)` re-renders within the frame, and the second tap would need a separate touch and release on the other button |

## PR

[#107](https://github.com/amshahed/sensei/pull/107) against `main`, head `4c75871`. Not merged. Commits: `2ef2b5f` (T1, T2), `938b61e` (T3), `9aa0ed2` (T3 integration spec, the handoff commit), `72e07d5` (T4), `4c75871` (review fixes). This `dev.md` is in the main checkout's work unit, not in the PR, the same as earlier units. The Lead publishes it with the ops state.
