# Blockers

Things only the founder can do. Keep this current. Each entry has the exact action and what it unblocks. Move resolved items to the bottom with a date.

## Open

| # | Action needed from the founder | Unblocks | Needed by |
|---|---|---|---|
| 1 | Top up Anthropic credits at console.anthropic.com if the full lesson batch runs out. About $19.50 left as of 2026-11-08. Drafting the 120 planned lessons costs about $18 before critic passes and redrafts, so this will probably be needed. Lessons are drafted in course order, audio-blocked ones last | Full lesson batch | When the balance runs out |
| 2 | Create an Azure Speech resource, then put `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` in `apps/api/.env` | Listening (#10), speaking (#11), lesson audio. 12 of the 120 planned lessons are fully blocked. Kana and sound lessons work without it but are silent, which is acceptable for alpha and not for closed beta | Before those lessons can ship |
| 3 | Create a Cloudflare R2 bucket and API token, then set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` in `apps/api/.env` | Cached lesson audio | With item 2 |
| 4 | Create a Railway project and give the team a deploy token | Hosting the API so the app works off this machine | Before closed beta |
| 5 | Set up an Expo/EAS account and Apple developer access | Installable builds | Before closed beta |
| 6 | Book a native speaker or tutor to sample the published lessons (a few hours) | Replaces AI-only language review before wider release | Before wider beta |
| 7 | Optional: walk through real Clerk sign-up on a device | Last check on #3; alpha runs use dev-stub auth | Before closed beta |
| 8 | Optional: add a Voyage payment method | Faster re-ingests; the free tier works but crawls | Only if re-ingesting at scale |
| 9 | Enable billing on the Gemini API project. The free tier is 15 requests per minute. On the Tech Lead's reading of the terms it allows training and human review of input, permits only paid services for EEA, Swiss and UK users, and bars apps likely to reach under-18s | Real learners using AI grading | Before any real learner |

## Resolved

- 2026-11-08: Xcode license accepted; git works again.
