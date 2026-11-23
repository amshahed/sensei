# Brief: confirming the learner is 18 or over

Unit `age-confirmation` (decision M.5). Written by the Project Manager, 2026-11-23.

---

# 1. Problem

- **The beta must be adults only while runtime grading uses Gemini** (M.5). Gemini's terms require users to be 18 or over, and since G.4.c every vocabulary review goes through that grader.
- **Today nothing asks.** What sign-up does now:
  - **With Clerk:** an in-app email and password form, then an emailed code (`AuthScreen.tsx`). Clerk asks for nothing else.
  - **Then onboarding** (`OnboardingGate.tsx`): the three intake questions (I.3.b), then placement for learners who've studied before. Placement can already send answers to the grader.
  - **Dev-stub auth** (alpha runs) skips the sign-up form and goes straight to onboarding. A fresh learner is a new `DEV_USER_ID`.
- **Needed before any real learner,** alongside Blocker 9 (M.5).

# 2. Users and use cases

- **Absolute beginner and returning learner, both adults** (the personas). They've just made an account, or opened the app as a fresh learner. They want to start. The check has to cost one tap and no thought.
- **A teenager who got hold of an invite.** Unlikely in an invite-only beta, but it's the case the check exists for. They should get a clear, kind answer and no way into graded work by the obvious route.
- **An account that already exists.** Today that's only the dev user. It never confirmed, so it has to before it carries on.

# 3. Decisions

## 3.1 It's the first onboarding screen, not part of the sign-up form

- Before the first intake question, as M.5 says, so before anything the grader sees, placement included.
- **Why onboarding:**
  - It covers every account however it was made (email today, maybe Apple or Google sign-in later), plus accounts that already exist.
  - Dev-stub learners see it, so the Alpha run can score it. A sign-up form step would be invisible to every alpha run.
- **Rejected: a checkbox on the sign-up form.** It would keep a self-declared minor from ever creating an account, which is a real advantage. But it misses existing accounts and other sign-in routes, and no alpha run could check it.

## 3.2 Two equal choices, one tap

- The question asks whether I'm 18 or older. Two buttons of equal weight: "I'm 18 or older" and "I'm under 18".
- **Suggested copy:** "Sensei's beta is for adults for now. Are you 18 or older?" Plain words, not legal text. The Tech Lead may adjust it, but it must stay neutral and must not hint at the "right" answer.
- **This amends M.5's single "I am 18 or older" tap.** A lone confirm button leaves an honest teenager with nothing to press, and nudges everyone to tap through.
- **Rejected:**
  - **Date of birth.** It collects personal data we have no other use for and verifies nothing. A self-declaration is all either one gives.
  - **ID or other proof.** Far beyond what a closed invite-only beta needs, and it's a new paid service.

## 3.3 Under 18 stops here, and the answer sticks

- A short, kind message: the beta is for adults for now. No lessons, reviews, practice, placement or intake.
- With a real account, the learner can sign out from that screen.
- If they tapped it by mistake, the message says to contact whoever invited them. In a closed beta that's the founder, who knows every invitee, and the team can reset the answer.
- **The answer sticks to the account.** Next time the app opens, it shows the same message, not the question again.
- **Rejected:**
  - **Asking again each time.** That makes the check a speed bump you tap through on the second go.
  - **Deleting the account.** Irreversible on a mis-tap, and whether a self-declared minor's account must be deleted, and how fast, is a legal question (section 6).
- No promise that the beta will open to under-18s later. M.5 leaves that open.

## 3.4 Asked once per account

- An "18 or older" answer is never asked again on that account: not after signing out and back in, not on another phone.
- **The existing dev user is asked once**, the next time it opens the app, before it carries on. Its progress is kept.

## 3.5 Lasting rules go to the decision log

3.2 to 3.4 amend and extend M.5, so they are logged as M.5.a.

# 4. Promises

- **P1.** Before I answer anything in the app, even the first "what pulled you to Japanese?" question, I'm asked whether I'm 18 or older. There are two equally clear choices, and one tap answers it. I'm not asked for my birth date or any proof.
- **P2.** If I say I'm 18 or older, I go straight on to the usual first questions. I'm never asked my age again on this account.
- **P3.** If I say I'm under 18, I see a short, kind message that the beta is for adults for now, and what to do if I tapped it by mistake. I can't reach the first questions, the placement quiz, lessons, reviews or practice from there.
- **P4.** If I said I'm under 18 and open the app again later, I see the same message, not the question.
- **P5.** If I was using Sensei before this check existed, I'm asked once, the next time I open the app, before I can carry on. Once I've said I'm 18 or older, my progress is exactly where I left it.
- **P6.** With a real account, I can sign out from the under-18 message.

**Scoring.** The Alpha run can score P1 to P5 with dev-stub learners: P1 to P2 on one fresh learner, P3 to P4 on a second, and P5 on an existing learner. P6 needs a real Clerk account. The Tester covers it, and the founder's real sign-up walkthrough checks it (Blocker 7).

# 5. Out of scope

- Terms of use, a privacy notice, or any legal text at sign-up (section 6).
- Verifying age beyond the learner's own answer.
- Deleting or expiring under-18 accounts (section 6).
- The app store age rating. That's the founder at submission (M.5, stop list 6, Blocker 5).
- Moving grading to a provider that allows teenagers. That's M.5's reversal path, before any public launch.
- Asking for age anywhere other than onboarding, such as the sign-up form or settings.

# 6. Needs the founder

These are blockers, not promises. None of them stops this unit being built or tested.

1. **Is a self-declared tap enough?** Gemini bars services "likely to be accessed by" under-18s, and a Japanese course attracts teenagers. This is a legal judgment nobody on the team can make. It's already M.5's open risk, and it's due before any public launch. For the invite-only beta, adult invitations (stop list 6) plus this tap is the team's position.
2. **Legal text.** The team can't write it, and can't judge whether the closed beta needs it. That means terms of use stating the 18+ rule, and a privacy notice covering the email address and the age answer. The founder decides before inviting any real learner (stop list 4 and 6).
3. **A self-declared minor's account.** It holds only the email address Clerk collected and the "under 18" answer. Whether it must be deleted, and how fast, is a legal question. It goes into the same review as item 2. Until then it's kept and blocked.
4. **Blocker 7's walkthrough** of real Clerk sign-up should now include this screen and P6. The Lead adds that to Blocker 7's wording.

# 7. Notes

- **For the Tech Lead.**
  - The point is that no answer from an unconfirmed or under-18 account ever reaches the grader, even if the app is bypassed. Where that's enforced is your call.
  - The team needs to be able to tell, per account, that it confirmed and when.
  - The mis-tap reset is a one-account data edit by the team. Say in `tech.md` how it's done.
- **For the Alpha run.** Use a separate fresh `DEV_USER_ID` for the under-18 path. That learner stays blocked, and the walk through the course needs a different one.
- **Sequencing.** B5 (`grading-fallback-honesty`) goes first, because the Alpha walker meets it every session. This unit follows. Both should land before the Alpha run: it's held by Blocker 10 anyway, and one run can then score both.
