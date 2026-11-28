# Test: confirming the learner is 18 or over

Unit `age-confirmation` (M.5, M.5.a, M.5.b). PR [#107](https://github.com/amshahed/sensei/pull/107). Written by the Tester, 2026-11-28.

---

# Half 1 of 2 (server)

## Verdict

- **PASS for this half's scope, on `4c75871`** (`4c75871b7ea7aca8ae49e9819788c73466d61123`, the PR head).
- **Scope:** everything provable on the Linux server, by the Lead's ruling of 2026-11-28 (`ops/CHECKPOINT.md`):
  - the full verification;
  - `/code-review high`, and a ruling on the three findings argued against in `dev.md` and on the `AuthGate.tsx` change;
  - the `tech.md` 3.2 rehearsal, steps 1 to 7;
  - every Tester-API and Jest line of `tech.md` section 4;
  - a code read for P6;
  - the mobile bundle check.
- **Not merge-ready.** G3 needs half 2 (the Tester-sim cases, on the Mac) to pass too. Until then this PR has no Tester PASS.
- **Findings:** one Low (F1), three Low or Info review items judged, two observations. None breaks a promise or the data. Each is justified below, so none blocks this half.
- **Any new commit voids this half.** Re-run sections 1, 2 and 4 on it. Section 3 only needs re-running if the migration or the API changes.

---

# 1. Evidence

## 1.1 Verification

My own detached worktree, `.claude/worktrees/test-age-confirmation`, at `4c75871`: `pnpm install --offline --frozen-lockfile`, `pnpm --filter @sensei/types build`, `pnpm --filter api prisma:generate`.

| Command | Result |
|---|---|
| `pnpm typecheck` | 4/4 tasks: `@sensei/types`, `api`, `mobile` |
| `pnpm lint` | `api` eslint clean. 0 warnings, 0 problems |
| `pnpm test` | **67 suites, 1,605 tests, all passed** |
| CI on the PR | `verify` SUCCESS (run 46092196327) |
| Age specs alone (`age.guard`, `onboarding.service`, `onboarding.controller`, `app.integration`) | 4 suites, 78 tests passed. The 23 age tests are listed in 1.4 |

## 1.2 Rehearsal on `test-age-confirmation` (`tech.md` 3.2)

**Branch.** `test-age-confirmation`, `br-red-mud-batele3k`, project `dawn-rice-83727032`.
- `describe_branch` before any write: `default: false`, `primary: false`, parent `br-little-cell-bariz1cz`.
- The default branch is `main` = `br-little-cell-bariz1cz` (`get_default_branch`).
- **URL handling.** The Neon MCP gave the pooler URL. I dropped `-pooler` from the host for the direct URL (`ep-raspy-waterfall-bajjyt6f`) and kept it in a mode-600 file in my scratchpad. It reached the API and Prisma only as `DATABASE_URL` in the environment, never in a repo file. Live's `.env` points at a different endpoint (`ep-royal-night…`). Both `migrate deploy` runs printed the direct host.
- **Env precedence, checked.** `@nestjs/config` 4.0.4 only fills keys not already in `process.env` (`assignVariablesToProcess`: `!(key in process.env)`). So `DATABASE_URL` and the empty `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` beat the main checkout's `.env`. Both APIs logged "GEMINI_API_KEY not set". No model was called.

| Step | What I did | Result |
|---|---|---|
| **1. Baseline** (read-only) | Counts and last migration on the branch | 2 users, 1 completion, 5 mastery rows, 0 assessments, 108 lessons, 874 checks. Last migration `20261104230000_reminders` (9 rows). No age columns. **The branch was not pristine:** see P-1 |
| **2. Existing learner, pre-PR code** | API from the main checkout (`main` `04d4b5d`, its Prisma client has no `ageAnswer`), via `node -r ts-node/register`, so nothing was built or written there. Port 3201, `DEV_USER_ID=tester-age-existing`. `GET /me` 200. `POST /onboarding/intake` 201 `{"intakeDone":true,…}` (no `ageAnswer`: old code). `GET /lessons/the-five-vowels` 200. All 10 multiple-choice checks answered correctly (201 each). `POST /lessons/the-five-vowels/complete` 201 | `tester-age-existing`: intake done, 1 completion, 5 mastery rows, 1 study day. **R3, read-only on the default branch: 0 `tester-age-*` rows**, 1 user, 0 completions, 0 mastery. Nothing went live. `git status` in the main checkout is identical before and after |
| **3. Migrate** | `prisma migrate deploy` from my worktree, run twice | Run 1: "Applying migration `20261124230000_age_confirmation`… All migrations have been successfully applied." Run 2: "No pending migrations to apply." |
| **4. Additive** | Columns, enum, counts, row hashes | `ageAnswer` (`AgeAnswer`) and `ageAnsweredAt` (`timestamp`): both nullable, no default. Enum labels exactly `{ADULT,UNDER_18}`. 0 rows with either set. Counts unchanged (3 users, 2 completions, 10 mastery, 0 assessments, 2 study days). **Hashes identical before and after:** each user row as jsonb minus the two new keys, all mastery rows, all completions. 0 failed or rolled-back migration rows |
| **5. No drift** | `prisma migrate diff --from-url <branch> --to-schema-datamodel prisma/schema.prisma --exit-code` | Exit 2, with exactly one difference: `DROP INDEX "ReferenceDoc_embedding_hnsw_idx"`. That index is raw SQL in `20260615120000_reference_doc` (`c7dc141`), on an `Unsupported("vector(1024)")` column Prisma can't model. It predates this unit, as `dev.md` said. **Nothing about `User` or `AgeAnswer` differs.** Also: `migration.sql` equals Prisma's `migrate diff` from `origin/main`'s schema, blank lines aside |
| **6. Edge rows** (PR API, port 3202, dev-stub) | `tester-age-adult` answers `ADULT`, `tester-age-minor` answers `UNDER_18`, `tester-age-existing` left null | 201 `ageAnswer: "ADULT"` and 201 `ageAnswer: "UNDER_18"`. More rows in 1.3 and in the half-2 table |
| **7. Rollback** | Pre-PR API from the main checkout again, freshly started against the **migrated** branch | As `tester-age-existing`: `GET /onboarding` 200, `GET /lessons/the-five-vowels` 200, `GET /curriculum` 200, `GET /reviews/due` 200, `GET /progress` 200. **Old-code writes work on the new schema:** new learner `tester-age-existing2` `GET /me` 200, intake 201, three checks 201, lesson complete 201. `POST /onboarding/age` 404 (old code has no route). A code-only rollback is safe with the columns left in place |

**At the end:** the default branch still has 1 user, 0 completions, 0 mastery rows, last migration `20261104230000_reminders`, no age columns and no `AgeAnswer` type (read-only query). No Neon branch was created, reset or deleted.

## 1.3 Tester-API (PR API at `4c75871` on the migrated branch, dev-stub)

**Every route the API maps** was probed for an unanswered and an under-18 learner: 28 routes, 4 of them exempt (`GET /health`, `GET /me`, `GET /onboarding`, `POST /onboarding/age`), so 24 gated. The plan's list is 10 of those 24.

| Learner | Requests | Result |
|---|---|---|
| `tester-age-new` (fresh) | `GET /onboarding` before any row exists | 200 `{"ageAnswer":null,"intakeDone":false,"placement":"not_needed"}` |
| | `GET /me`, `GET /onboarding`, `GET /health` | 200, 200, 200 |
| | All 24 gated routes, among them `POST /onboarding/intake`, `POST /placement`, `GET /curriculum`, `GET /lessons/<slug>`, `POST /lessons/<slug>/complete`, `POST /checks/:id/answer`, `GET /reviews/due`, `POST /reviews/:itemId/answer`, `POST /practice/sessions`, `POST /practice/sessions/:id/answer`, `POST /chapters/:id/assessment`, `POST /assessments/:id/submit`, `GET /streak`, `GET /progress`, `GET`/`PUT /reminders`, `GET /practice/scopes`, `POST /curriculum/relocate`, `PUT /streak/target`, `POST /placement/skip` | **403 "Age not confirmed yet."** on all 24 |
| `tester-age-invalid` | `POST /onboarding/age` with `{"answer":"maybe"}`, `{}`, `{"answer":"adult"}`, `{"answer":null}`, `["ADULT"]`, `"ADULT"`, `{"answer":["ADULT"]}`, `{"answer":"ADULT "}`, invalid JSON, no body | 400 on all 10. **No row created** (SQL) |
| `tester-age-adult` | `POST /onboarding/age` `ADULT` (with an extra key) | 201 `ADULT` |
| | `POST /onboarding/age` `UNDER_18`, twice | 201, **still `ADULT`** both times. `ageAnsweredAt` unchanged: 01:25:44.971 before and after (SQL) |
| | `GET /onboarding`, `GET /curriculum`, `GET /reviews/due` | 200 `ADULT`, 200, 200 |
| `tester-age-minor` | `POST /onboarding/age` `UNDER_18` | 201 `UNDER_18` |
| | `POST /onboarding/age` `ADULT`, twice | 201, **still `UNDER_18`** both times. `ageAnsweredAt` 01:25:45.173 unchanged (SQL) |
| | `GET /me`, `GET /onboarding`, `GET /health` | 200, 200 `UNDER_18`, 200 |
| | All 24 gated routes, after the re-answers | **403 "Sensei's beta is for adults for now."** on all 24 |
| `tester-age-existing` (pre-PR, read-only) | `GET /onboarding` | 200 `{"ageAnswer":null,"intakeDone":true,…}` |
| | `GET /curriculum`, `GET /lessons/the-five-vowels`, `GET /reviews/due` | 403 "Age not confirmed yet." Row hash unchanged by all of this (SQL) |
| `dev-age-existing` (pre-PR, predates the migration) | `GET /onboarding`, then `GET /curriculum` | 200 `ageAnswer: null, intakeDone: true`, then 403 |
| | `POST /onboarding/age` `ADULT` | 201 `ADULT, intakeDone: true` |
| | `GET /curriculum`, `GET /curriculum/next`, `GET /progress` | 200. `the-five-vowels` is `"state":"completed"`, and next is `foundation-ja-ch01-l02` |
| `tester-age-existing2` (made by pre-PR code in step 7) | `GET /curriculum/next`, `POST /onboarding/age` `ADULT`, `GET /curriculum/next` | 403, 201, 200 |
| `tester-age-race1`–`5` (no row) | `ADULT` and `UNDER_18` posted at the same time | **Exactly one answer stored each time** (3 `ADULT`, 2 `UNDER_18`), and it matches the 201 response. **The other request got 500, P2002, 5 out of 5:** F1 |
| `tester-age-race6`–`10` (row made by `GET /me` first) | The same simultaneous pair | Exactly one stored. **Both responses carry it, 5 out of 5.** The compare-and-set works as designed |

**P5 progress, exact** (SQL hashes before and after the answer, PR API):
- `tester-age-existing2`: these four hashes are identical, and only `ageAnswer`, `ageAnsweredAt` and `updatedAt` changed (O1):
  - user row minus `ageAnswer`, `ageAnsweredAt` and `updatedAt`: `a826e680…`;
  - mastery rows: `5afc6939…`;
  - completion: `5682d837…`;
  - study day: `228bbfb1…`.
- `dev-age-existing`: mastery `d2a760e3…`, completion `1338d508…` and study day `a91e1ef1…` are identical from before the migration to after the answer. The intake fields are unchanged.

**R7 latency.** `GET /reviews/due`, 30 calls each, same adult learner, same branch, from this server:

| API | Median | p90 |
|---|---|---|
| Pre-PR | 18.8 ms | 19.5 ms |
| PR | 34.6 ms | 35.9 ms |

That's about +16 ms per gated request: one more round trip to Neon in Frankfurt. See O2.

## 1.4 Jest (in `pnpm test`, and in CI)

| Spec | Tests | Covers |
|---|---|---|
| `auth/age.guard.spec.ts` | adult passes; `UNDER_18` gets 403 with the adults-only message; unanswered or missing gets 403 "not confirmed"; `@Public()` and `@AgeExempt()` pass with no lookup; no user gets 401 | P3, R1 |
| `onboarding/onboarding.service.spec.ts` | a missing row reads unanswered; the first answer is stored with a timestamp and the row created; never overwrites `ADULT`→`UNDER_18` or `UNDER_18`→`ADULT` | P2, P4 |
| `onboarding/onboarding.controller.spec.ts` | `isAgeAnswerRequest`: accepts the two answers, rejects 7 malformed shapes | P1 (400) |
| `app.integration.spec.ts`, "the age question gates the API" | A new account reaches only the exempt routes (P1). Validation. An adult goes on to the survey (201), curriculum (200) and the grader (`parseJson` called once: the spy is live) (P2, R1). Under 18 is refused on the 4 grading routes and 8 more, `parseJson` never called, and re-answering never flips it (P3, P4) | P1 to P4 |

**Mutation check** (my worktree, each mutation reverted with `git checkout`; `git status` clean afterwards):

| Mutation | Tests failing |
|---|---|
| Remove the `AgeGuard` registration | 2: the P1 and P3/P4 integration cases |
| Register `AgeGuard` before `AuthGuard` | 57 (R1 is caught) |
| Drop `ageAnswer: null` from the compare-and-set | 3: the unit test and both no-flip integration cases |

The tests aren't vacuous.

## 1.5 Mobile bundle check

`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY= pnpm exec expo export --platform ios --output-dir <scratchpad>` from `apps/mobile` at `4c75871`: exit 0, "iOS Bundled … (801 modules)".

The Hermes bundle (`index-b4f7313b….hbc`, 2.98 MB) contains every new string. The plain ones are stored as ASCII; the ones with curly quotes, dashes or ellipses are stored as UTF-16, and I searched for them that way:
- "Are you 18 or older?"
- "Sensei’s beta is for adults for now."
- "I’m 18 or older" and "I’m under 18"
- "Sensei is for adults for now"
- "Tapped “I’m under 18” by mistake? Contact the person who invited you, and they’ll reset it."
- "Couldn’t save your answer — try again." and "Saving…"
- "Sign out", "Signing out…" and "Couldn’t sign out — try again."
- `/onboarding/age`

---

# 2. Promises (this half)

| Promise | Status after half 1 | How I checked | Left for half 2 |
|---|---|---|---|
| **P1** Asked first; two equal choices; one tap; no birth date or proof | **Holds at the API and in the code** | API: new learner `ageAnswer: null`; intake and all 23 other gated routes 403; exempt routes 200. Jest P1. Code read: `AgeQuestion` renders both choices with the same `Option` component, `selected={false}`, same `role` and `disabled`, stacked full width. `onPress={() => onAnswer(c.id)}` → `api.answerAge(a)`: one tap, no Continue step. No date field, no legal text. `OnboardingGate` branches on `ageAnswer` before `intakeDone`. `OnboardingDto` always comes from `status()`, which always sets `ageAnswer`, so intake's response can't send the learner back to the question | The first-screen shot and the equal-weight look |
| **P2** 18 or over → straight to the first questions; never asked again | **Holds at the API** | Re-answer `UNDER_18` ×2 returns `ADULT`, `ageAnsweredAt` unchanged; the adult reaches intake and curriculum. Jest service and integration | Press → intake shot; relaunch → intake, not the question |
| **P3** Under 18 → message and mis-tap line; no route on | **Holds at the API** | All 24 gated routes 403 with "Sensei's beta is for adults for now."; grader never called (Jest spy). Code read: `AdultsOnly` makes no API call, has no button but the conditional Sign out, and carries the plan's copy word for word | The message shot, with no button in dev-stub mode |
| **P4** Under 18, reopened → same message | **Holds at the API** | Re-answer `ADULT` ×2 returns `UNDER_18`, row unchanged, routes still 403. Jest. Code read: `OnboardingGate` re-reads `GET /onboarding` on every mount | Relaunch shot |
| **P5** Existing account asked once; progress exactly as left | **Holds at the API and in data** | Steps 2 and 4: pre-PR rows read null after the migration, with hashes identical. Two pre-PR learners blocked until answered, then in with the completed lesson; progress hashes identical across the answer (1.3) | The question → press → home shows the completed lesson, on `tester-age-existing` |
| **P6** Sign out from the under-18 message, with a real account | **Holds in the code** | `AuthedApp` wraps `useAuth().signOut` in `useCallback(() => signOut())`. The wrapper drops the press event, so Clerk gets no stray argument. It provides it through `SignOutContext`. Dev-stub `AuthGate` mounts no provider, so `useSignOut()` returns the default `null` and `AdultsOnly` renders no footer. On success Clerk swaps `<SignedIn>` for `<SignedOut>`: `AuthedApp` unmounts, its cleanup clears the token provider, and `AuthScreen` shows. On failure: "Couldn’t sign out — try again." and the button re-enables | The stub-context harness shot and logged press. End to end with real Clerk is Blocker 7 only |

---

# 3. Findings

## F1 (Low, open, justified): two simultaneous first answers for an account with no row: one gets 500

- **Where:** `apps/api/src/onboarding/onboarding.service.ts:61` (`submitAge`'s `upsert`). It shows up in the app at `apps/mobile/src/onboarding/OnboardingGate.tsx:63` and `:94`.
- **What happens.** Prisma runs this `upsert` (`update: {}`) as a find, then a create. When two `POST /onboarding/age` requests arrive together for an id with no `User` row, both find nothing and both insert. The loser throws P2002 (unique `id`), and Nest returns 500.
- **Reproduced 5 of 5** (`tester-age-race1`–`5`, 1.3). With a row already there, 0 of 5 (`race6`–`10`).
- **Data is correct every time.** Exactly one answer is stored, it never flips, and it matches the winning response. M.5.a's guarantees hold.
- **It contradicts one sentence.** `tech.md` 1.3 says "a retried request … gets the stored answer back". `dev.md`'s rebuttal of review finding 5 rests on "Both responses carry the stored answer". Both are true once a row exists, and false before.
- **Who has no row at the question:** every fresh dev-stub learner, because the app never calls `GET /me` in dev-stub mode. A Clerk learner too, if they tap before `AuthedApp`'s `GET /me` commits.
- **What the learner would see** (code read, not reproduced in the app):
  - If the 500 lands first: "Couldn’t save your answer — try again." flashes, then the winner's answer moves the screen on.
  - If the 500 lands second, after an adult answer: the stale "Couldn’t save your answer — try again." shows on the **intake** screen, because `submitError` is shared state (`OnboardingGate.tsx:20`, `:63`, `:94`).
  - The screen always matches the stored answer.
- **Repro for the Developer** (dev-stub API, fresh ids):

  ```bash
  for a in ADULT UNDER_18; do
    curl -s -X POST -H 'x-dev-user-id: race-x' -H 'Content-Type: application/json' \
      -d "{\"answer\":\"$a\"}" localhost:3000/onboarding/age & done; wait
  # one body is {"statusCode":500,...}; the log shows PrismaClientKnownRequestError P2002
  ```
- **Why it doesn't block:**
  - It can't store a wrong or flipped answer.
  - In the app it needs two requests in flight. The choices disable on the first tap's re-render, so that takes a second tap within about one frame, or a client retry, and the client has none.
  - The worst outcome is one transient error line.
  - The same find-then-create race is already on `main` in `UsersService.ensureUser` (`users.service.ts:15`) and `submitIntake` (`onboarding.service.ts:78`).
- **Recommended fix,** for all three call sites together:
  - make the row creation conflict-safe, with `createMany({ data: [{ id }], skipDuplicates: true })` or by catching P2002 and carrying on;
  - and in the app, ignore a failed `answerAge` once `state.ageAnswer` is set, so the stale line can't appear on intake.
  
  That is a small follow-up unit, or part of this PR if it gets another round anyway. **For the PM backlog** if not taken here.

## Review: `/code-review high` on PR #107 (my run) and the three items `dev.md` argued against

My run found nothing wrong in the gate's core: the guard order, deny-by-default, the compare-and-set, and the token fix. Its four findings, and the Developer's three rebuttals:

| # | Finding | Severity | My ruling |
|---|---|---|---|
| R-a (`dev.md` 3; my run's 1) | Scheduled reminders keep firing while an account is stuck at the question or `AdultsOnly`, because `ReminderSync` mounts only past the gate (`App.tsx:61`), and `PUT /reminders` is gated | Low | **Justified, not fixed. The Developer's premise holds on live.** Read-only on the default branch: the only account has `remindersOn: false`, `remindersAskedAt: null` and no intake. Reminders can only be turned on past the gate. `ReminderSync`'s cleanup calls `clearScheduled()` (`reminders.ts:157`) when the shell unmounts, so an in-app sign-out or session end with the app open clears them. **What's left:** a shared phone where account A's session ended while the app was closed, and account B then signs in and stops at the gate. A's already-scheduled reminders fire until their plan runs out. That predates this PR: a B without intake never mounted `ReminderSync` before it either. **PM backlog:** clear scheduled reminders whenever the shell isn't mounted |
| R-b (`dev.md` 4) | After a team reset of a mis-tap, `AdultsOnly` stays until the app is reopened | Info | **Agreed: as planned** (`tech.md` 1.4 "no API call", 3.4 "on next open"). **For the Tech Lead:** 3.4's message to the learner should say "close Sensei fully (swipe it away) and open it again". A backgrounded app coming back to the front doesn't remount `OnboardingGate` |
| R-c (`dev.md` 5) | Two quick taps on different choices can send two requests | Low | **The conclusion holds, but the premise is partly wrong.** With a row present, both responses carry the stored answer (5/5). With no row, the second gets 500: F1. Either way the stored answer is the first to land, the screen ends on it, and a sticky mis-tap is accepted by design (brief 3.3, R5). No ref guard needed for the mis-tap concern. F1 covers the error path |
| My run's 2 | Every gated request pays one extra read; deploying the API before the migration would 500 every gated route | Nit | **Justified.** `tech.md` 3.3 migrates first, then restarts. Step 7 proves the old API is safe on the new schema in the window between. The cost is O2 |
| My run's 3 | An app newer than its API sticks on the question (save 404s) | Nit | **Justified.** Accepted knowingly in `dev.md` item 6, and the 3.3 order (API restart, then app reload) prevents it. Only the team's devices run Expo Go |
| My run's 4 | `AuthGate`'s `ready` isn't reset when `getToken` changes, so a child request in the same commit could see the cleared provider | Nit | **Justified: predates the PR, and the fix suggested would be worse.** The cleanup-then-set order is unchanged from `main`. Resetting `ready` in the cleanup would unmount the whole app on every token refresh and throw away an in-progress lesson |

## The `AuthGate.tsx` change (`dev.md` item 5): correct, and within scope

- **The bug is real** (code read).
  - `request()` reads `authTokenProvider` synchronously when called (`api.ts`).
  - React runs passive effects child-first. So `OnboardingGate`'s `useEffect(load)` fires `GET /onboarding` before `AuthedApp`'s effect calls `setAuthTokenProvider`.
  - In Clerk mode that request has no bearer token, `AuthGuard` 401s it, and the first screen is "Couldn’t reach Sensei" with Retry.
- **The fix is correct** (`AuthGate.tsx:72`, `:80`, `:90`).
  - Children mount only after the effect has installed the provider and set `ready`, so the first child request carries a token.
  - `ready` never goes back to false, so a token refresh doesn't remount the app.
  - On sign-out, `<SignedIn>` unmounts `AuthedApp` and the next sign-in starts fresh, with `ready` false and `materialised` false.
  - Dev-stub mode never mounts `AuthedApp`.
  - The cost is one blank frame.
- **Scope.** `tech.md` lists `AuthGate.tsx` for `SignOutContext` only. But without this fix, a real learner's first screen is an error, not the question. That is P1's path, and P6's, and Blocker 7's walkthrough. It's about four lines in a file the plan already touches. It's a fix, not a feature.
- **Not proven:** the server can't sign in through Clerk. Blocker 7 already asks the founder to confirm that the first signed-in screen is the question.
- **Ruling:** keep it. The Tech Lead can still veto it. It is now in Blocker 7.

## Observations (no action needed for merge)

- **O1 (Info).** Answering also bumps `User.updatedAt`, Prisma's `@updatedAt`, to the same instant as `ageAnsweredAt`. `tech.md` P5 says "only `ageAnswer` and `ageAnsweredAt` changed". `updatedAt` is bookkeeping, not progress, so P5 holds. Anyone comparing rows for the Alpha should expect three changed columns.
- **O2 (Info, for the Tech Lead).** R7 shows the gate costs about 16 ms per gated request from this server (median 18.8 → 34.6 ms on `GET /reviews/due`). That's small next to a phone's round trip. `tech.md` 1.2 already names the remedy: cache `ADULT` answers in process. My recommendation: don't add it now. Revisit when the API is on Railway and the real latency to Neon is known.
- **P-1 (Info, process).** `test-age-confirmation` wasn't the pristine copy of live that `tech.md` T5 required.
  - At step 1 it already held `dev-age-existing`: intake done, the five-vowels lesson completed, 5 mastery rows, 1 study day, no migration.
  - That user row was created 2026-11-24 22:40:03 UTC, four minutes after the branch and 49 seconds before the first Developer's first commit (`2ef2b5f`, 22:40:52).
  - No ops file records it.
  - It didn't affect any result: it's a pre-PR learner like step 2's, so I used it as a second P5 subject. But a write to a throwaway branch should be logged where the next role can see it.

---

# 4. Not verified in this half

- **Every Tester-sim case** (`tech.md` section 4) and the deferred T5 screenshot. The server has no iOS simulator and no Chrome. That is half 2, below.
- **Anything in Clerk mode:** the real first signed-in screen (the `AuthGate` fix), and P6 end to end. Neither Tester can sign in through Clerk (`PROJECT.md`, personas). Only Blocker 7 can show it.
- **F1's in-app effect** (the stale error line on intake). Shown only by code read; the API side is reproduced. Half 2 may try it (optional, below).
- **`pnpm test:e2e`** wasn't run. It isn't in the `PROJECT.md` verification and it only checks `GET /health`, which is `@Public()` and returned 200 behind the gate in 1.3.
- **The live deploy** (`tech.md` 3.3). It was rehearsed on the branch only, which is the plan. It's the Lead's job after merge.
- **Android.** No build exists.

---

# For half 2 (Mac)

A **fresh Tester**, on the Mac, on the **same commit `4c75871`** (if the head moves, half 1 must be re-run on it too), and the **same branch `test-age-confirmation` (`br-red-mud-batele3k`)**.

**Setup:**
- **The branch is already migrated.** Don't run `migrate deploy` again; just confirm `20261124230000_age_confirmation` is in `_prisma_migrations`. Confirm `default: false` with `describe_branch` before any write.
- Use the direct URL, without `-pooler`, only through `DATABASE_URL`.
- **One API start per learner.** The app sends no `x-dev-user-id`, so the API's `DEV_USER_ID` decides who the app is. Start the PR API from a worktree at `4c75871` with `CLERK_SECRET_KEY=`, `CLERK_JWT_KEY=` and `DEV_USER_ID=<learner>`.
- Start Expo with `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` empty, using `expo start --offline` then `open_url exp://127.0.0.1:8081` on `Sensei 22a SE3`.
- Use the harness-plus-screenshot method of `open-check-followup/test.md` 1.3. Keep the harness uncommitted and revert it.

**Cases left** (all from `tech.md` section 4, Tester-sim):

| # | Promise | Learner | Case |
|---|---|---|---|
| S1 | P1 | `tester-age-new`: row exists, `ageAnswer` null, no intake. Or any never-used id, which also exercises the no-row path | The first screen after launch is the question. Both choices are the same size and style, there's no date field, and it reads as two equal answers, not a default (`dev.md` 4.2). Untouched screenshot. **This is also the deferred T5 shot** |
| S2 | P2 | The same learner as S1 | The harness presses "I’m 18 or older", and the next shot is the first intake question. Relaunch: intake again, not the age question. (`tester-age-adult`, already `ADULT` with no intake, gives a ready-made relaunch check too) |
| S3 | P3, P6 dev-stub | `tester-age-minor2`: a new id, not yet on the branch | The harness presses "I’m under 18". The shot shows the title, the body and the mis-tap line, and **no button** in dev-stub mode |
| S4 | P4 | `tester-age-minor2` (and `tester-age-minor`, already `UNDER_18`) | Relaunch: the same message, not the question |
| S5 | P5 | **`tester-age-existing`**: made by pre-PR code; `ageAnswer` null; intake done; `the-five-vowels` completed; 5 mastery rows. Kept untouched for you | First the question. The harness presses 18+. Then home or curriculum shows the five vowels completed and lesson 2 next. **Then SQL:** these must be unchanged, and only `ageAnswer`, `ageAnsweredAt` and `updatedAt` may change (O1):<ul><li>`md5((to_jsonb(u) - 'ageAnswer' - 'ageAnsweredAt' - 'updatedAt')::text)` = `e51d85f4f22dd80914f91a34795c1116`</li><li>mastery `md5(string_agg(row_to_json(m)::text, ',' ORDER BY m.id))` = `52ddc3d9b754eb9f399cbbc19016c21b`</li><li>completion (the same form) = `5514f1c8fb0ec3d6cfb07dea28f60dd6`</li><li>study day (`ORDER BY row_to_json(s)::text`) = `c54c346ac997c19231166ad7bfd0b035`</li></ul> |
| S6 | P6 | Any `UNDER_18` learner | The harness wraps the gate in `SignOutContext` with a stub. The shot shows "Sign out", and a harness press calls the stub (logged) |
| S7 (optional) | F1 | A never-used id | The harness calls `onAnswer('ADULT')` and `onAnswer('UNDER_18')` back to back. See whether the intake (or `AdultsOnly`) screen shows a stale "Couldn’t save your answer — try again." That confirms or clears F1's app side |

**Other rows on the branch** (don't rely on them unless needed):
- `tester-age-adult` (`ADULT`, no intake) and `tester-age-minor` (`UNDER_18`): the step 6 edge rows.
- `tester-age-race1`–`10`: answered, no intake.
- `tester-age-existing2` and `dev-age-existing`: pre-PR learners, now `ADULT`, with progress.
- `user_3LZD…`: live's copy, null, no intake. Don't use it.

**Half 2 writes its own section in this file.** G3 is met only when both halves are PASS on the PR's latest commit, CI is green, and every finding is fixed or justified here.
