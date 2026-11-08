#!/usr/bin/env bash
# Publish ops state to the default branch through a PR, without touching feature work.
#
# Usage (from the main checkout, on the default branch):
#   bash ops/bin/sync-state.sh "<commit subject>" "<optional commit trailer>"
#
# Commits only ops/ plus progress.md and decisions.md if they exist. These files
# carry no code, so the PR merges without waiting for CI.
set -euo pipefail

subject="${1:-chore(ops): sync checkpoint and work state}"
trailer="${2:-}"
footer='🤖 Generated with [Claude Code](https://claude.com/claude-code)'

cd "$(git rev-parse --show-toplevel)"

paths=(ops)
for p in progress.md decisions.md; do
  if [ -e "$p" ]; then paths+=("$p"); fi
done

default="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
default="${default#origin/}"
default="${default:-main}"

current="$(git branch --show-current)"
if [ "$current" != "$default" ]; then
  echo "sync-state: run this from the main checkout on '$default' (currently on '$current')." >&2
  exit 1
fi

if [ -z "$(git status --porcelain -- "${paths[@]}")" ]; then
  echo "sync-state: nothing to publish."
  exit 0
fi

branch="chore/ops-sync-$(date -u +%Y%m%d-%H%M%S)"
git switch -q -c "$branch"
git add -- "${paths[@]}"
if [ -n "$trailer" ]; then
  git commit -q -m "$subject" -m "$trailer"
else
  git commit -q -m "$subject"
fi
git push -q -u origin "$branch"
gh pr create --head "$branch" --base "$default" --title "$subject" \
  --body "Ops state only: checkpoint, journal, work units, status board.

$footer" >/dev/null
gh pr merge "$branch" --merge --delete-branch >/dev/null
git switch -q "$default"
git pull -q --ff-only
echo "sync-state: published to $default."
