# Devices: continue the work anywhere

The founder works from three devices:
- **The OpenMediaVault server** (Debian Linux, always on). Sessions run here by default.
- **The MacBook Pro**. Needed for anything on the iOS simulator.
- **The Windows 11 desktop**.

Nothing project-related may live on only one machine. Git carries the code and `ops/`. Everything else travels through the **private store** `amshahed/sensei-private`, with `node ops/bin/state.mjs`.

## What travels where

| What | Where it lives | How it travels |
|---|---|---|
| Code, `ops/`, `decisions.md`, `.claude/agents` | `amshahed/sensei` (**public**) | git |
| `apps/api/.env`, `apps/mobile/.env` | gitignored | store, **encrypted** |
| Claude session transcripts, subagent transcripts, prompt history, edit checkpoints | `~/.claude/projects/<key>/`, `~/.claude/history.jsonl`, `~/.claude/file-history/` | store, **encrypted**, because transcripts contain database passwords |
| Claude auto-memory | `~/.claude/projects/<key>/memory/` | store, plain |
| Global `~/.claude/CLAUDE.md`, `templates/project-ops`, `skills/`, `settings.json` | `~/.claude/` | store, plain |
| Lesson drafts, critiques, `.failed.json`, `.prev.json`, approved lessons | `tools/authoring/output/`, `tools/authoring/published/` (gitignored) | store, plain |
| JMdict, KANJIDIC2, Tatoeba downloads | `apps/api/data/sources/` (gitignored, 143 MB) | store, gzipped |
| Database, Clerk, Neon branches | cloud | nothing to move |
| Plugins, Neon MCP login, Claude login, `gh` login | per device | one-time setup, below |

**Never put a secret in `amshahed/sensei`. It is public.** The store encrypts with AES-256-GCM, using a key derived from your passphrase with scrypt. Without the passphrase, the encrypted files are useless, even to someone with access to the private repo.

`state.mjs` never deletes anything:
- `push` only adds or updates. A file that disappears locally stays in the store.
- `pull` copies every local file it would overwrite to `~/.sensei-state-backups/<time>/` first.
- The store's git history keeps every version.

## The two habits

**Leaving a device:** run `bash ops/bin/handoff.sh` from the main checkout. It:
1. commits any uncommitted worktree work as `wip: handoff` on its own branch, and pushes every branch;
2. publishes ops state to main;
3. pushes the store.

**Arriving on a device:** run `bash ops/bin/setup-device.sh` from the repo root. It:
1. checks prerequisites and runs `git pull`;
2. pulls the store;
3. installs dependencies and generates the Prisma client;
4. confirms the `.env` keys are present (names only) and that the database is reachable.

On an already-set-up device, `git pull && node ops/bin/state.mjs pull` is enough.

**One active device at a time.** Two devices working at once would each push its own transcript and drafts, and the last push wins in the store. The other device's version stays in the store's git history, so it isn't lost, but merging it is manual. `node ops/bin/state.mjs status` says which device pushed last and what differs here.

## Best setup: run sessions on the server, attach from anywhere

The server is set up: `turingMachine` (Debian 13, OMV), user `shahed`, LAN `192.168.0.51` (DHCP, not reserved), Tailscale `turingmachine` / `100.127.177.30`. Its repo is `~/workspace/sensei`.

- **From the Mac:** `ssh sensei`. The Mac's `~/.ssh/config` has `sensei` (opens the session), `turing` (a plain shell) and `turing-ts` (over Tailscale). All use the key `~/.ssh/ed_key`.
- **From Windows:** `ssh -t shahed@192.168.0.51 .local/bin/sensei` in Windows Terminal. It asks for the server password unless you add a key.
- **Leave it running:** `Ctrl-b`, then `d`. Claude and its agents keep working on the server.
- **From anywhere, no SSH:** the launcher starts `claude --remote-control sensei`. Remote Control makes the server session appear as the conversation "sensei" in claude.ai/code and the Claude mobile app, with its history, on any device and away from home. If Remote Control fails to start, the launcher falls back to plain `claude`.
- **After a server reboot** the session is gone until something starts it. Run `ssh sensei` once; the old conversations stay in `/resume`.

`~/.local/bin/sensei` on the server attaches to the tmux session `sensei`. tmux is a terminal multiplexer that keeps programs running after you disconnect. If the session doesn't exist, the launcher creates it, runs `git pull` and `state.mjs pull`, and starts `claude` in the repo.

- A fresh `claude` reads `ops/CHECKPOINT.md` and carries on.
- `/resume` inside Claude lists the old conversations, including the Mac's.

**Auto-resume after a usage limit** (founder request, 2026-11-28). The founder is on Claude Pro, so sessions stop at the 5-hour and weekly caps. The launcher also opens tmux window 1, `auto-resume`, which runs `ops/bin/auto-resume.sh` and restarts it if it exits.
- Every minute it reads the bottom of Claude's pane (window 0). When Claude is idle at an empty prompt and the screen shows a usage-limit message, it waits until 2 minutes after the stated reset time. Then it types a prompt telling the Lead to resume from `CHECKPOINT.md` and restart any agent that was cut off.
- If the limit hasn't lifted, Claude just refuses again, which costs nothing, and the script retries every 15 minutes. If the message gives no time, it tries every 30 minutes.
- It never types while Claude is working, over text already in the box, or into a menu. If a dialog hides the box, it sends one Escape and types only if the empty box comes back.
- **Agents cut off by a limit die.** Their progress since the last commit, or since their last file in the work unit, may have to be redone.
- **Check it:** `bash ops/bin/auto-resume.sh --once` (one read of the screen, no typing). The log is `~/.local/state/sensei/auto-resume.log`. The exact wording of the limit message isn't recorded anywhere yet, so check the log after the first real limit. If it says "no readable time", widen `STRICT_RE` in the script.
- **Turn it off:** `tmux kill-window -t sensei:auto-resume`. The launcher brings it back on the next attach.

**Machine-specific rules.** The shared `~/.claude/CLAUDE.md` (synced) ends with `@~/.claude/MACHINE.md`. Each machine keeps its own `MACHINE.md`, which is never synced. The server's holds the NAS hard rules (never touch the photo HDD, ask before installs, OMV owns `/etc`). The Mac's says it is the simulator machine.

Use `handoff.sh` and `setup-device.sh` only when the work itself moves machines, for example to the Mac for simulator work.

## First-time setup per device

### 1. Prerequisites

**Server (OpenMediaVault / Debian), as your normal user in your home directory, not on a data drive that may be mounted `noexec`:**

```bash
sudo apt update && sudo apt install -y git tmux curl ca-certificates openssl
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && . ~/.nvm/nvm.sh
nvm install 22 && corepack enable && corepack prepare pnpm@11.5.3 --activate
# GitHub CLI: https://github.com/cli/cli/blob/trunk/docs/install_linux.md (apt repo), then:
gh auth login
curl -fsSL https://claude.ai/install.sh | bash      # Claude Code; then run `claude` once to log in
```

**Mac:** this device. It already has everything, plus Xcode and the `Sensei 22a SE3` simulator. If a macOS update resets the Xcode licence, `git` stops working until you run `sudo xcodebuild -license accept`.

**Windows 11:**
- **Recommended:** SSH to the server (above) and do nothing locally.
- **To work locally:** use WSL2 (`wsl --install`, Ubuntu), then follow the server steps inside it. `state.mjs` also runs on plain Windows Node, but the `.sh` scripts need WSL or Git Bash.

### 2. Clone, in the same place on every device if you can

```bash
mkdir -p ~/workspace && gh repo clone amshahed/sensei ~/workspace/sensei && cd ~/workspace/sensei
```

### 3. The passphrase file

Do this in your own terminal, not through Claude Code's `!`. That keeps the passphrase out of every transcript.

```bash
bash ops/bin/set-passphrase.sh
```

It asks twice and shows nothing while you type, which is normal. It works in zsh, bash and WSL alike.

- Use the same passphrase on every device.
- If you lose it, the encrypted files can't be recovered. Keep a copy in your password manager.
- The plain files (drafts, memory, config) don't depend on it.

### 4. Run setup

```bash
bash ops/bin/setup-device.sh
```

### 5. In Claude Code, once per device

- `/mcp`: log in to Neon. The project's `.mcp.json` already names the server.
- Plugins, if `/plugin` doesn't show them installed: `code-review`, `frontend-design` and `chrome-devtools-mcp` from `claude-plugins-official`. `settings.json`, which came from the store, already enables them.
- claude.ai connectors (Notion, Drive and so on) follow your account. Nothing to do.

## Picking up the conversation itself

- **The normal way:** start `claude` in the repo root. `CLAUDE.md` sends it to `ops/CHECKPOINT.md`, which is written so that any new session can carry on alone.
- **The old conversations:** they are restored too. Run `claude --resume` in the repo root and pick one.
  - They mention the old device's paths (`/Users/sh/...`). On another device, treat them as history, and trust the checkpoint over them.
  - Claude Code finds transcripts by the repo's absolute path. If you cloned to a different path, `state.mjs pull` still puts them under the right key, which it prints.

## What only the Mac can do

- The iOS simulator: Tester screenshots with the harness, and the Alpha run (Blocker 10).
- `expo start` for the simulator.

Everything else runs on the server: the API, authoring, ingest, Neon, the test suites and `expo export`. When the work needs the simulator, run `handoff.sh` on the server, `setup-device.sh` on the Mac, and the reverse afterwards.
