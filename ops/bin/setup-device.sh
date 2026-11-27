#!/usr/bin/env bash
# Make this device ready to continue the work. Safe to re-run. From the repo root:
#   bash ops/bin/setup-device.sh
#
# Works on macOS, Linux (the OpenMediaVault server) and Windows through WSL2 or Git
# Bash. Installs nothing system-wide: it checks prerequisites and says what's missing.
# See ops/DEVICES.md for installing them.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"
ok=1
need() { # name, check command, hint
  if eval "$2" >/dev/null 2>&1; then echo "  ok      $1"; else echo "  MISSING $1 — $3"; ok=0; fi
}

echo "== prerequisites"
need git "git --version" "install git"
need node "node -e 'process.exit(+process.versions.node.split(\".\")[0] >= 22 ? 0 : 1)'" "install Node 22 or later (nvm install 22)"
need pnpm "pnpm --version" "corepack enable && corepack prepare pnpm@11.5.3 --activate"
need gh "gh --version" "install the GitHub CLI"
need "gh login" "gh auth status" "gh auth login"
need claude "claude --version" "install Claude Code: curl -fsSL https://claude.ai/install.sh | bash"
need passphrase "test -s \"\$HOME/.config/sensei/state-passphrase\" || test -n \"\${SENSEI_STATE_PASSPHRASE:-}\"" "create ~/.config/sensei/state-passphrase in your own terminal (ops/DEVICES.md step 3)"
if [ "$(uname)" = "Linux" ]; then need tmux "tmux -V" "sudo apt install tmux (keeps sessions alive when you disconnect)"; fi
if [ "$ok" != 1 ]; then
  echo "setup-device: fix the missing items above, then run this again." >&2
  exit 1
fi

echo "== code"
git switch -q main 2>/dev/null || true
git pull -q --ff-only || { echo "setup-device: git pull failed; resolve it first." >&2; exit 1; }

echo "== private state (.env, Claude sessions and memory, drafts, datasets, ~/.claude config)"
node ops/bin/state.mjs pull || exit 1

echo "== dependencies"
pnpm install --frozen-lockfile || exit 1
pnpm --filter @sensei/types build >/dev/null || exit 1
pnpm --filter api prisma:generate >/dev/null || exit 1

echo "== .env keys present (names only, never values)"
for pair in "apps/api/.env:apps/api/.env.example" "apps/mobile/.env:apps/mobile/.env.example"; do
  env="${pair%%:*}"; example="${pair##*:}"
  [ -f "$example" ] || continue
  missing="$(comm -23 <(grep -oE '^[A-Z0-9_]+' "$example" | sort -u) <(grep -oE '^[A-Z0-9_]+' "$env" 2>/dev/null | sort -u))"
  if [ -n "$missing" ]; then echo "  $env lacks: $missing"; else echo "  ok      $env"; fi
done

echo "== database reachable (read-only)"
(cd apps/api && pnpm exec prisma migrate status 2>&1 | tail -2)

cat <<'EOF'
== done
Next:
  - Start Claude Code in the repo root (on the server, inside tmux: tmux new -A -s sensei).
    It reads ops/CHECKPOINT.md and carries on. The old conversation is also there:
    claude --resume lists it.
  - In Claude Code, once per device: /mcp to log in to Neon; install plugins if missing:
    /plugin install code-review@claude-plugins-official (and frontend-design, chrome-devtools-mcp).
  - iOS simulator work (Tester screenshots, the Alpha run) needs the Mac.
EOF
