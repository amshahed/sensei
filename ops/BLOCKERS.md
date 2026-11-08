# Blockers

Things only the founder can do. Keep this current. Each entry has the exact action and what it unblocks. Move resolved items to the bottom with a date.

## Open

| # | Action needed from the founder | Unblocks | Needed by |
|---|---|---|---|
| 1 | Top up Anthropic credits at console.anthropic.com if the full lesson batch runs out. About $19.50 left as of 2026-11-08; the batch estimate is $20–40 | Full lesson batch | When the balance runs out |
| 2 | Create an Azure Speech resource, then put `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` in `apps/api/.env` | Listening (#10), speaking (#11), lesson audio; 11 of the 113 outline lessons | Before those lessons can ship |
| 3 | Create a Cloudflare R2 bucket and API token, then set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` in `apps/api/.env` | Cached lesson audio | With item 2 |
| 4 | Create a Railway project and give the team a deploy token | Hosting the API so the app works off this machine | Before closed beta |
| 5 | Set up an Expo/EAS account and Apple developer access | Installable builds | Before closed beta |
| 6 | Book a native speaker or tutor to sample the published lessons (a few hours) | Replaces AI-only language review before wider release | Before wider beta |
| 7 | Optional: walk through real Clerk sign-up on a device | Last check on #3; alpha runs use dev-stub auth | Before closed beta |
| 8 | Optional: add a Voyage payment method | Faster re-ingests; the free tier works but crawls | Only if re-ingesting at scale |

## Resolved

- 2026-11-08: Xcode license accepted; git works again.
