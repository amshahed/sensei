# Blockers

Things only the founder can do. Keep this current. Each entry has the exact action and what it unblocks. Move resolved items to the bottom with a date.

## Open

| # | Action needed from the founder | Unblocks | Needed by |
|---|---|---|---|
| 1 | Top up Anthropic credits at console.anthropic.com if the full lesson batch runs out. About $10 left as of 2026-11-16. All non-audio lessons are drafted; what remains (12 audio lessons once Azure exists, a few redrafts) is about $2, so no top-up is needed for 22c | Full lesson batch | When the balance runs out |
| 2 | Create an Azure Speech resource, then put `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` in `apps/api/.env` | Listening (#10), speaking (#11), lesson audio. 12 of the 120 planned lessons are fully blocked. Kana and sound lessons work without it but are silent, which is acceptable for alpha and not for closed beta | Before those lessons can ship |
| 3 | Create a Cloudflare R2 bucket and API token, then set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` in `apps/api/.env` | Cached lesson audio | With item 2 |
| 4 | Create a Railway project and give the team a deploy token | Hosting the API so the app works off this machine | Before closed beta |
| 5 | Set up an Expo/EAS account and Apple developer access | Installable builds | Before closed beta |
| 6 | Book a native speaker or tutor to sample the published lessons (a few hours). Include the AI grader’s comments on particle slips, using `open-check-followup/test.md` F1 and F2 as examples. Also check a few meanings the app now accepts without their bracketed part (`exact-meaning-grading`, G.4.h): そこ “there”, いただきます “thank you”, 隣 “next” | Replaces AI-only language review before wider release | Before wider beta |
| 7 | Optional: walk through real Clerk sign-up on a device, including the new 18+ age screen (`ops/work/age-confirmation/brief.md`). Confirm the first screen after signing in is the 18+ question, not “Couldn’t reach Sensei” (PR #107 changed when the first signed-in request gets its token, `age-confirmation/dev.md`) | Last check on #3; alpha runs use dev-stub auth | Before closed beta |
| 8 | Optional: add a Voyage payment method | Faster re-ingests; the free tier works but crawls | Only if re-ingesting at scale |
| 9 | Enable billing on the Gemini API project. The free tier is 15 requests per minute. On the Tech Lead's reading of the terms it allows training and human review of input, permits only paid services for EEA, Swiss and UK users, and bars apps likely to reach under-18s | Real learners using AI grading. Evidence: in the 2026-11-23 test of PR #91, 25 of 99 free-tier grading calls failed (503 "high demand" or 12 s timeouts) and showed "couldn’t grade". The Alpha run will see this too | Before any real learner |
| 10 | Start a session that can tap and type in the iOS simulator. That means the Claude desktop app with its simulator panel, with access granted to device `Sensei 22a SE3`, as in the 22a/22b runs. This session can only take screenshots | The Alpha run (gate G4) for all 107+ live lessons. Testers work around it with a harness, but the Alpha User must use the real app | Before Alpha |
| 11 | Say yes to deleting the throwaway Neon branches `test-78-check-explanation` (`br-red-forest-baxm7pzr`) , `test-open-check-followup` (`br-winter-poetry-baq6sbs4`) and, once age-confirmation merges, `test-age-confirmation` (`br-red-mud-batele3k`). Neon’s tools refuse to delete them without your explicit yes | Tidiness and compute hours only; nothing is blocked | Any time |
| 12 | Decide on legal text before inviting real learners: does the closed beta need terms of use and a privacy notice, and who writes them? The team can’t accept or draft legal terms on your behalf. Whether a self-declared 18+ tap is legally enough is still M.5’s open risk | Inviting real learners (M.5, `age-confirmation`) | Before any real learner |
| 13 | Decide what happens to an account whose holder says they’re under 18. Today the app only blocks entry (`age-confirmation` P3/P4); keeping, deleting or reporting the account is a data-handling call | Real learners | Before any real learner |
| 14 | On each device, run `bash ops/bin/set-passphrase.sh` in your own terminal to save the state passphrase (`ops/DEVICES.md` step 3). Use the same passphrase everywhere, and keep a copy in a password manager | Encrypting and decrypting the private store: `.env`, Claude transcripts. Until it exists on this Mac, `state.mjs push` can’t run | Done on the Mac (2026-11-28). Needed once on each new device |

## Resolved

- 2026-11-08: Xcode license accepted; git works again.
- 2026-11-08: Founder approved throwaway Neon branches for testing data changes, created from the main session (a background agent's attempt was denied by the permission system). Branches are deleted after use.
- 2026-11-08: Founder approved downloading Expo Go 56.0.4 (80.9 MB, github.com/expo/expo-go-releases) to run the app on the iOS simulator.
- 2026-11-08: Founder granted simulator access to device `Sensei 22a SE3`.
