# Tech plan: confirming the learner is 18 or over

Unit `age-confirmation` (M.5, M.5.a). Written by the Tech Lead, 2026-11-23, against `brief.md` (P1 to P6) and the code at `main` `14b71fc`. Technical decision logged as M.5.b in `decisions.md`. One Developer PR, after `grading-fallback-honesty` merges.

---

# 0. What the code does today (verified)

- **Where the grader is reached.** Only through `GradingService.gradeOpen()`, from four learner routes:
  - `POST /checks/:id/answer`;
  - `POST /reviews/:itemId/answer`;
  - `POST /practice/sessions/:sessionId/answer`;
  - `POST /assessments/:attemptId/submit`.
  
  **Placement never calls the grader**: it is multiple choice, compared exactly (`placement.service.ts` 136 to 138). Brief section 1 says otherwise. That doesn't change this plan, because the gate comes before placement anyway.
- **Auth.** `AuthGuard` is the single global guard (`APP_GUARD` in `auth/auth.module.ts`). It sets `req.userId` from Clerk, or in dev-stub mode from `x-dev-user-id`, falling back to `DEV_USER_ID`. `@Public()` opts out: only `GET /health` uses it.
- **User rows are created lazily.** `GET /me` upserts the row (`UsersService.ensureUser`), and `POST /onboarding/intake` upserts it too. A fresh dev-stub learner has no row until one of those runs.
- **The app's order.** `App.tsx`: `AuthGate`, then `OnboardingGate`, then everything else, `ReminderSync` included. Before `OnboardingGate` resolves, the app calls only `GET /me` (Clerk mode, from `AuthedApp`) and `GET /onboarding`.
- **Sign-out doesn't exist anywhere in the app.** Clerk's `useAuth()` is only valid under `ClerkProvider`, which dev-stub mode doesn't mount.
- **The mobile app has no Jest setup.** App behaviour is proven on the simulator, as in `open-check-followup/test.md`.
- **Live data (read-only query, 2026-11-23).** One `User` row, `user_3LZDmwgm9Fq7Wury84gugbyU1RB`, a Clerk account with no intake, no completions, no mastery rows and no attempts. **There is no live `dev-user` row.** The brief's "existing dev user" is in practice this Clerk account, which has no progress (see risk R6 for the Alpha run).

---

# 1. Approach

## 1.1 The answer lives on the `User` row (P2, P4, P5, "tell per account and when")

```prisma
/// Age confirmation (M.5, M.5.a). Null until answered. The app never overwrites it; a mis-tap reset is a team edit (section 3.4).
ageAnswer     AgeAnswer?
ageAnsweredAt DateTime?

enum AgeAnswer {
  ADULT    // "I'm 18 or older"
  UNDER_18 // "I'm under 18"
}
```

- Null means "not asked yet". Every existing row reads null after the migration, so it is asked once (P5).
- `SELECT id, "ageAnswer", "ageAnsweredAt" FROM "User"` tells the team, per account, what was answered and when.
- **Rejected:**
  - **Two timestamps (`adultConfirmedAt`, `under18At`).** They allow both to be set at once.
  - **A separate declarations table with history.** It's more schema for an audit nobody has asked for. The reset path logs the old value in the journal instead (3.4).
  - **Date of birth.** Ruled out by the brief (3.2).

## 1.2 A global age guard that fails closed (P3, and "never reaches the grader, even if the app is bypassed")

- New `AgeGuard` (`auth/age.guard.ts`), registered as a second `APP_GUARD` in `AuthModule`, **after** `AuthGuard`. Nest runs global guards in registration order, so `req.userId` is already set when it runs.
- Rule:
  - a `@Public()` route passes;
  - a route marked with the new `@AgeExempt()` decorator passes;
  - otherwise the request passes only if the user's `ageAnswer` is `ADULT`;
  - an unanswered or missing row gets `403 "Age not confirmed yet."`, and `UNDER_18` gets `403 "Sensei's beta is for adults for now."`;
  - a missing `req.userId` on a non-exempt route gets 401 (a defensive check; it can't happen while `AuthGuard` runs first).
- The lookup is `AgeGateService.answerFor(userId)` (`auth/age-gate.service.ts`): one primary-key `findUnique` with `select: { ageAnswer: true }`. It's a provider of its own so the integration spec can override it (1.5).
- **`@AgeExempt()` on exactly three routes:** `GET /me`, `GET /onboarding`, `POST /onboarding/age`. They are what the app calls before or at the gate. Nothing in them grades, teaches or records progress.
- **Why global, not per-route.** Today four routes reach the grader, in four modules. A per-route guard fails open for the next one: spoken checks, "Try again" after "couldn't grade", or Track modules. Deny-by-default fails closed and visibly, as a 403 in dev. It also makes M.5.a's "nothing else" true at the API, not only in the app: intake, placement, lessons, reviews and practice all refuse an unconfirmed or under-18 account.
- **Cost.** One indexed primary-key read per authenticated request. No cache now. If latency ever shows, cache `ADULT` answers in-process: the app never changes an `ADULT` answer.
- **Rejected:**
  - **`@UseGuards` on the four grading routes.** It fails open for future routes (above).
  - **A check inside `GradingService`.** It has no user id, and threading one through `RecallGraderService` and three callers is a larger diff. It would also surface as a grading failure rather than a refusal.
  - **Folding the check into `AuthGuard`.** It mixes identity with policy and drags Prisma into `auth.guard.spec.ts`.

## 1.3 Onboarding API (P1 to P5)

- `OnboardingDto` gains `ageAnswer: AgeAnswer | null`. `status()` selects it. A missing row reads as `{ ageAnswer: null, intakeDone: false, placement: 'not_needed' }`.
- New `POST /onboarding/age`, body `{ answer: 'ADULT' | 'UNDER_18' }`. Anything else gets 400, validated by an `isAgeAnswerRequest()` beside `isIntakeRequest()`. `OnboardingService.submitAge(userId, answer)`:
  1. upserts the row, as `submitIntake` does;
  2. runs `updateMany({ where: { id, ageAnswer: null }, data: { ageAnswer: answer, ageAnsweredAt: new Date() } })`, an atomic compare-and-set;
  3. returns `status()`.
- **It never overwrites.** A second answer, a retried request, a second phone or a bypassing client gets the stored answer back and changes nothing. An under-18 answer can't be flipped by re-posting (P4). Two simultaneous answers store exactly one.
- No 409. The app renders whatever `status` says, so there's one code path and no error branch to get wrong.

## 1.4 App (P1 to P6)

- **`api.answerAge(answer)`** in `api.ts`.
- **Sign-out reachable from onboarding (P6).** `AuthGate.tsx` adds a `SignOutContext` (`(() => Promise<void>) | null`, default `null`) and exports `useSignOut()`:
  - `AuthedApp` provides Clerk's `useAuth().signOut`;
  - dev-stub mode provides `null`, so no dead button appears there.
  
  After sign-out, `<SignedOut>` shows `AuthScreen`, and `AuthedApp`'s cleanup already clears the API token.
- **New `onboarding/AgeScreen.tsx`** with two components:
  - **`AgeQuestion`**:
    - Copy: "Sensei's beta is for adults for now. Are you 18 or older?" (the brief's suggested copy).
    - Two choices, "I'm 18 or older" and "I'm under 18", rendered by **the same component with identical style and size**, stacked full-width in the body. No pre-selection and no Continue step: one tap submits.
    - Both are disabled while submitting. On failure: "Couldn't save your answer — try again."
    - No birth date, no legal text.
  - **`AdultsOnly`**:
    - Title "Sensei is for adults for now".
    - Body: "The beta is open to people aged 18 and over. Thank you for wanting to learn Japanese with us."
    - Then: "Tapped “I'm under 18” by mistake? Contact the person who invited you, and they'll reset it."
    - A "Sign out" button only when `useSignOut()` is non-null. No other button and no API call.
  
  The PM may change the copy at review without changing this plan.
- **`OnboardingGate.tsx`**, after `state` loads and before the intake branch:
  - `ageAnswer === null` → `AgeQuestion`;
  - `'UNDER_18'` → `AdultsOnly`;
  - `'ADULT'` → the existing intake, placement and app flow, unchanged.
  
  Every app launch re-reads `GET /onboarding`, so P2 and P4 hold across launches and devices.

## 1.5 Tests over the fake database

`app.integration.spec.ts` boots the real `AppModule` over an in-memory Prisma fake.
- Its two existing bootstraps get `.overrideProvider(AgeGateService)` returning `'ADULT'`. Their tests are about other things.
- A new `describe` boots the **real** gate. The fake `user` table learns `ageAnswer` and `ageAnsweredAt`: its `matches()` already treats null as missing. `LLM_CLIENT` is overridden with a stub whose `parseJson` is a Jest spy, so the cases can prove the grader is never reached.

---

# 2. Changes

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | `AgeAnswer` enum, `User.ageAnswer`, `User.ageAnsweredAt` (1.1) |
| `apps/api/prisma/migrations/<timestamp>_age_confirmation/migration.sql` (new) | Section 3.1. The timestamp must sort after `20261104230000_reminders` |
| `apps/api/src/auth/age-exempt.decorator.ts` (new) | `@AgeExempt()`, mirroring `public.decorator.ts` |
| `apps/api/src/auth/age-gate.service.ts` (new) | `answerFor(userId)` |
| `apps/api/src/auth/age.guard.ts` (new) | 1.2 |
| `apps/api/src/auth/auth.module.ts` | Providers in order: `AgeGateService`, `APP_GUARD` `AuthGuard`, `APP_GUARD` `AgeGuard` |
| `apps/api/src/users/users.controller.ts` | `@AgeExempt()` on `GET /me` |
| `apps/api/src/onboarding/onboarding.controller.ts` | `@AgeExempt()` on `GET /onboarding`. New `POST /onboarding/age` (exempt) and `isAgeAnswerRequest()` |
| `apps/api/src/onboarding/onboarding.service.ts` | `ageAnswer` in `status()`. `submitAge()` |
| `packages/types/src/index.ts` | `AgeAnswer`, `AgeAnswerRequest`, `OnboardingDto.ageAnswer` |
| `apps/mobile/src/api.ts` | `answerAge()` |
| `apps/mobile/src/auth/AuthGate.tsx` | `SignOutContext`, `useSignOut()` |
| `apps/mobile/src/onboarding/AgeScreen.tsx` (new) | `AgeQuestion`, `AdultsOnly` |
| `apps/mobile/src/onboarding/OnboardingGate.tsx` | Age branches first (1.4) |
| Specs | Section 4 |

No new dependencies.

---

# 3. Data

## 3.1 The migration is additive

```sql
-- CreateEnum
CREATE TYPE "AgeAnswer" AS ENUM ('ADULT', 'UNDER_18');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "ageAnswer" "AgeAnswer",
ADD COLUMN "ageAnsweredAt" TIMESTAMP(3);
```

- A new type and two nullable columns with no default. No existing value changes, nothing is dropped or renamed, and no row is rewritten. On Postgres 18 adding a nullable column without a default is a catalog-only change.
- The Developer writes it to match Prisma's output. The Tester's drift check (3.2 step 5) proves the file and the schema agree.
- **Pre-approved under OM.1** once rehearsed on a throwaway branch (`PROJECT.md`, Migrations).

## 3.2 Rehearsal on a throwaway Neon branch (Tester)

The Lead creates the branch `test-age-confirmation` **from the default branch**, from the main session, just before the Tester starts. The Tester never creates or deletes branches. The Tester records the branch id in `test.md` and confirms it before every write. The Tester gets the branch's **direct (non-pooler)** URL and sets it as `DATABASE_URL` in the environment, ahead of `--env-file`.

1. **Baseline** (read-only, on the branch): counts of `User`, `LessonCompletion`, `ItemMasteryState`, `AssessmentAttempt`, and the last `_prisma_migrations.migration_name`. It should be `20261104230000_reminders`.
2. **An existing learner, made by today's code.**
   - Run the API from the main checkout (on `main`, so it has the pre-PR code), with `DATABASE_URL` set to the branch, Clerk keys empty and `DEV_USER_ID=tester-age-existing`.
   - Submit the intake, answer one lesson's checks and complete it.
   - Then a read-only query **on the default branch** must show no `tester-age-existing` row. That proves nothing went live.
3. **Migrate.** From the PR worktree, run `prisma migrate deploy` with the branch's direct URL. Run it a second time: "No pending migrations".
4. **Additive, proven.**
   - The two columns exist and are nullable, and the enum has exactly `ADULT, UNDER_18`.
   - `SELECT count(*) FROM "User" WHERE "ageAnswer" IS NOT NULL OR "ageAnsweredAt" IS NOT NULL` returns 0.
   - Every count from steps 1 and 2 is unchanged.
5. **No drift.** `prisma migrate diff --from-url <branch direct URL> --to-schema-datamodel prisma/schema.prisma --exit-code` reports no difference.
6. **Edge rows**, through the PR API (dev-stub auth):
   - `tester-age-adult` answers `ADULT`;
   - `tester-age-minor` answers `UNDER_18`;
   - `tester-age-existing` stays null until the P5 test.
7. **Rollback rehearsal.** Run the step-2 API again (pre-PR code) against the **migrated** branch. `GET /onboarding` and `GET /lessons/<slug>` as `tester-age-existing` return 200. A code-only rollback is safe with the columns left in place.

## 3.3 Live deploy and rollback

- **Deploy (Lead, after merge):**
  1. `pnpm prisma:deploy` from `apps/api` in the main checkout.
  2. Confirm the migration row and the two columns (read-only).
  3. Restart the API and reload the app.
  
  The one live account then reads `ageAnswer: null` and is asked once on its next open.
- **Rollback:** revert the PR and restart the API. **Leave the columns.** The old code ignores them (3.2 step 7). Dropping the columns and type would destroy recorded answers. That is non-additive and on the stop list (item 3). It is not part of this plan.

## 3.4 The mis-tap reset (a team edit on one account)

- **Trigger.** The learner contacts the person who invited them, and in this closed beta that's the founder. The founder passes the request on in chat. Their yes there is the approval: it is a non-additive edit to a live learner's record, so it's on the stop list.
- **Find the id.** In the Clerk dashboard, search the email to get the `user_…` id. The database holds no email. Or list the candidates: `SELECT id, "ageAnsweredAt" FROM "User" WHERE "ageAnswer" = 'UNDER_18'`.
- **Record first.** Before the reset, the Lead appends a line to `ops/journal.md` with the id, the old answer and its `ageAnsweredAt`, the date, and that the founder confirmed. That line is the audit trail.
- **Reset** (Lead, main session, one statement; it must report 1 row):

  ```sql
  UPDATE "User" SET "ageAnswer" = NULL, "ageAnsweredAt" = NULL
  WHERE id = '<user id>' AND "ageAnswer" = 'UNDER_18';
  ```
- On next open the learner gets the question again. Nothing else on the account is touched.

---

# 4. Promise map

Test locations:
- **Jest**: unit and integration in `pnpm test`, in CI.
- **Tester-API**: the PR's API against `test-age-confirmation`, dev-stub auth, a learner per `DEV_USER_ID`.
- **Tester-sim**: `Sensei 22a SE3` with the harness-plus-screenshot method of `open-check-followup/test.md` 1.3. A throwaway, uncommitted harness presses a choice through the screen's own `onPress` handler after a few seconds. Each shot is taken with `xcrun simctl io screenshot`, untouched. "Relaunch" means reloading the Expo bundle, which remounts `OnboardingGate`.

| Promise | Implementation | Test that proves it |
|---|---|---|
| **P1** Asked first, before any intake question; two equally clear choices; one tap; no birth date or proof | 1.4 `AgeQuestion` before intake. 1.3 `ageAnswer: null` for a new account. 1.2 intake refused server-side until answered | <ul><li>Tester-sim, fresh `tester-age-new`: the first screen after launch is the question, with both choices the same size and style and no date field. Screenshot untouched</li><li>Tester-API, `tester-age-new`: `GET /onboarding` gives `ageAnswer: null`, and `POST /onboarding/intake` gives 403</li><li>Jest integration: a fresh user gets 200 on `GET /me` and `GET /onboarding`, and 403 on intake</li><li>Code read: one tap calls `answerAge`, with no second step</li></ul> |
| **P2** "18 or older" → straight to the first questions; never asked again on this account | 1.3 stored once, never overwritten. 1.4 `ADULT` → existing flow | <ul><li>Tester-sim: the harness presses "I'm 18 or older", and the next shot is the first intake question. Relaunch: intake again, not the age question</li><li>Tester-API: a second `POST /onboarding/age` with `UNDER_18` for that learner returns `ADULT`, and `ageAnsweredAt` is unchanged (SQL)</li><li>Jest `onboarding.service.spec.ts`: the first answer is stored with a timestamp; a later answer never overwrites; a missing row is created</li></ul> |
| **P3** "Under 18" → a short, kind message and what to do after a mis-tap; no route to intake, placement, lessons, reviews or practice | 1.4 `AdultsOnly` with no other button or call. 1.2 every non-exempt route refuses `UNDER_18` | <ul><li>Tester-sim, fresh `tester-age-minor2`: the harness presses "I'm under 18". The shot shows the message and the mis-tap line, with no button in dev-stub mode</li><li>Tester-API, `tester-age-minor` (and `tester-age-new`): 403 on `POST /onboarding/intake`, `POST /placement`, `GET /curriculum`, `GET /lessons/<slug>`, `POST /checks/:id/answer`, `GET /reviews/due`, `POST /reviews/:itemId/answer`, `POST /practice/sessions`, `POST /chapters/:id/assessment`, `GET /streak`; 200 on `GET /me`, `GET /onboarding`, `GET /health`</li><li>Jest `age.guard.spec.ts`: `UNDER_18`, null and a missing row → 403; `ADULT` → pass; `@Public` and `@AgeExempt` pass without a lookup; no `userId` → 401</li><li>Jest integration: for an unanswered and an under-18 user, the four grading routes return 403 and the `LLM_CLIENT.parseJson` spy is never called. An adult on a non-exempt route gets 200, which proves `AuthGuard` ran first</li></ul> |
| **P4** Under 18, opened again later → the same message, not the question | 1.3 never overwrites. 1.4 reads status on every launch | <ul><li>Tester-sim: relaunch `tester-age-minor2`, and the message is shown again</li><li>Tester-API: `POST /onboarding/age` `ADULT` for `tester-age-minor` returns `UNDER_18`, the row is unchanged, and the routes still give 403</li><li>Jest integration: the same sequence</li><li>Jest `onboarding.service.spec.ts`: `UNDER_18` then `ADULT` stays `UNDER_18`</li></ul> |
| **P5** A pre-existing account is asked once, before carrying on; progress exactly as left | 3.1 existing rows read null. 1.4 asks first. Nothing else is written | <ul><li>Tester-sim, `tester-age-existing` (made by pre-PR code, 3.2 step 2): first the question; the harness presses 18+; then the home or curriculum screen shows the completed lesson</li><li>Tester-API and SQL: that learner's `LessonCompletion`, `ItemMasteryState` and intake fields are identical before and after answering; only `ageAnswer` and `ageAnsweredAt` changed</li><li>3.2 step 4: every pre-existing row is null after the migration</li></ul> |
| **P6** With a real account, I can sign out from the under-18 message | 1.4 `SignOutContext` from Clerk's `signOut`; button only when present | <ul><li>Tester-sim: the harness wraps the gate in `SignOutContext` with a stub function. The shot shows "Sign out", and a harness press calls the stub (logged)</li><li>Tester-sim, dev-stub: no sign-out button (from the P3 shot)</li><li>Code read: `AuthedApp` provides `useAuth().signOut`</li><li>**End to end with real Clerk: the founder's walkthrough (Blocker 7).** The team can't sign in through Clerk here (`PROJECT.md`, personas), so this part isn't provable by the Tester</li></ul> |

---

# 5. Risks

| # | Risk | What would show it |
|---|---|---|
| R1 | The guards run in the wrong order, so every route gives 403 or 401 | The Jest integration case of an adult on a non-exempt route |
| R2 | The app calls a route before the gate that isn't exempt, so launch shows "Couldn't reach Sensei" | The Tester-sim P1 shot. Verified today: only `GET /me` and `GET /onboarding` run before the gate |
| R3 | The Tester's pre-PR API run writes to live, because `DATABASE_URL` wasn't overridden | 3.2 step 2's read-only check on the default branch. Stop and report if the row is there |
| R4 | An app build without the gate talks to the new API, so every gated call fails | No store build exists, and Expo Go loads from the same checkout. Deploy order is in 3.3 |
| R5 | A mis-tap on "I'm under 18" sticks with no confirm step | By design (brief 3.3). Cost: one reset through the founder (3.4) |
| R6 | **The Alpha run can't score P5 on live with a dev-stub learner.** Live has no learner with progress, and after deploy every new learner is asked first | **Lead or PM decision.** Before merging this unit, the Lead creates a dev-stub learner with progress on live with today's code (intake and one lesson, through the API; additive). Otherwise the Alpha scores P5 on the founder's account during Blocker 7, or accepts the Tester's branch evidence |
| R7 | The extra read per request adds latency | API timings in Tester-API. If it shows, cache `ADULT` in-process (1.2) |
| R8 | Legal adequacy of a self-declared tap | Not technical. Brief section 6, founder |

---

# 6. Tasks (one Developer pass, one PR, after B5 merges)

1. **T1 Schema.** The enum, the columns and the migration file (3.1). Run `pnpm --filter api prisma:generate`, then generate the SQL from the schema with `prisma migrate diff --from-schema-datamodel <main's schema.prisma> --to-schema-datamodel prisma/schema.prisma --script` (no database needed). The committed file matches it.
2. **T2 Contract.** In `packages/types`, add `AgeAnswer`, `AgeAnswerRequest` and `OnboardingDto.ageAnswer`.
3. **T3 API.** `OnboardingService.status`/`submitAge`, the controller route and its validator, `@AgeExempt()`, `AgeGateService`, `AgeGuard`, the `AuthModule` order, and the exemptions on the three routes. Specs: `age.guard.spec.ts`, `onboarding.service.spec.ts` and a validator case. In `app.integration.spec.ts`, the two overrides plus the new real-gate `describe` with the `parseJson` spy (1.5).
4. **T4 App.** `api.answerAge`, `SignOutContext`/`useSignOut`, `AgeScreen.tsx`, and the `OnboardingGate` branches. Run `pnpm --filter mobile typecheck`.
5. **T5 Smoke.** Against the old throwaway branch `test-open-check-followup` (`br-winter-poetry-baq6sbs4`; B5 is done with it by then), apply the migration with its direct URL and run the app once as a fresh dev-stub learner. Put one SE screenshot of the question in `dev.md`. **Don't touch `test-age-confirmation`.** It must stay a pristine copy of live for the Tester's rehearsal.
6. **T6** Run `pnpm typecheck && pnpm lint && pnpm test`, then `/code-review high`, then open the PR. Record any deviation in `dev.md`.

**Not to be touched:** the sign-up form, settings, legal text, deleting accounts, placement logic, and any provider change (brief 5).
