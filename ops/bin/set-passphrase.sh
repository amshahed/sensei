#!/usr/bin/env bash
# Save the private-store passphrase on this device. Run it in your own terminal:
#   bash ops/bin/set-passphrase.sh
# Asks twice and shows nothing while you type, which is normal. Writes
# ~/.config/sensei/state-passphrase, readable only by you. Use the same passphrase
# on every device. Don't run it through Claude Code's "!": that would put the
# passphrase in a transcript.
set -euo pipefail

file="$HOME/.config/sensei/state-passphrase"
mkdir -p "$(dirname "$file")"

if [ -s "$file" ]; then
  read -rp "A passphrase is already saved on this device. Replace it? [y/N] " yn
  case "$yn" in y|Y) ;; *) echo "Kept the existing one."; exit 0 ;; esac
fi

read -rsp "Choose the Sensei passphrase (nothing shows while typing): " p1; echo
read -rsp "Type it again: " p2; echo
if [ -z "$p1" ]; then echo "Empty passphrase; nothing saved." >&2; exit 1; fi
if [ "$p1" != "$p2" ]; then echo "They didn't match; nothing saved. Run it again." >&2; exit 1; fi
if [ "${#p1}" -lt 12 ]; then echo "Warning: under 12 characters. A longer one is safer."; fi

(umask 077; printf '%s' "$p1" > "$file")
chmod 600 "$file"
echo "Saved (${#p1} characters) to $file."
