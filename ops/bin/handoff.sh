#!/usr/bin/env bash
# Leave this device with nothing left behind. Run from the main checkout:
#   bash ops/bin/handoff.sh
#
# 1. Feature worktrees: uncommitted work becomes a "wip: handoff" commit on its own
#    branch (never on main), and every branch with unpushed commits is pushed.
# 2. Ops state (checkpoint, journal, work units, decisions) goes to main through
#    sync-state.sh.
# 3. Everything outside git (.env, Claude transcripts and memory, lesson drafts,
#    datasets, ~/.claude config) goes to the private store with state.mjs push.
#
# Stops, without pushing anything to the store, if the main checkout has uncommitted
# changes outside ops/, because those can't be published safely by a script.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
root="$(pwd)"
host="$(hostname)"
trailer='Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'

if [ "$(git branch --show-current)" != "main" ]; then
  echo "handoff: run this from the main checkout on main." >&2
  exit 1
fi

# Anything dirty in the main checkout outside the state paths?
other="$(git status --porcelain | grep -vE '^.. (ops/|progress\.md|decisions\.md)' || true)"
if [ -n "$other" ]; then
  echo "handoff: the main checkout has changes outside ops/. Commit them on a branch first:" >&2
  echo "$other" >&2
  exit 1
fi

echo "== 1. worktrees"
git fetch -q --all --prune || true
while IFS= read -r wt; do
  [ "$wt" = "$root" ] && continue
  [ -d "$wt" ] || continue
  branch="$(git -C "$wt" branch --show-current)"
  if [ -z "$branch" ]; then
    if [ -n "$(git -C "$wt" status --porcelain)" ]; then
      echo "  WARNING: $wt is on a detached HEAD with uncommitted changes; left as is." >&2
    fi
    continue
  fi
  if [ "$branch" = "main" ]; then continue; fi
  if [ -n "$(git -C "$wt" status --porcelain)" ]; then
    git -C "$wt" add -A
    git -C "$wt" commit -q -m "wip: handoff from $host" -m "Uncommitted work saved by ops/bin/handoff.sh; not verified." -m "$trailer"
    echo "  committed WIP on $branch"
  fi
  if git -C "$wt" rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    if [ -n "$(git -C "$wt" log --oneline '@{u}..HEAD')" ]; then
      git -C "$wt" push -q && echo "  pushed $branch"
    fi
  else
    git -C "$wt" push -q -u origin "$branch" && echo "  pushed new branch $branch"
  fi
done < <(git worktree list --porcelain | awk '/^worktree /{print substr($0, 10)}')

# Local-only branches with no worktree.
while IFS= read -r line; do
  b="${line%% *}"; up="${line#* }"
  [ "$b" = "main" ] && continue
  if [ "$up" = "$b" ] || [ -z "$up" ]; then
    echo "  NOTE: local branch $b has no upstream (not pushed). Push it if it matters: git push -u origin $b"
  fi
done < <(git for-each-ref --format='%(refname:short) %(upstream:short)' refs/heads)

echo "== 2. ops state"
bash ops/bin/sync-state.sh "chore(ops): handoff from $host" "$trailer"

echo "== 3. private store"
node ops/bin/state.mjs push

echo "handoff: done. On the next device: git pull, then node ops/bin/state.mjs pull (see ops/DEVICES.md)."
