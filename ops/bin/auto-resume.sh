#!/usr/bin/env bash
# Resume the sensei Claude session by itself when a usage limit lifts.
#
# Runs in the tmux window "auto-resume" of session "sensei"; ~/.local/bin/sensei starts it.
# Every POLL seconds it reads the bottom of Claude's pane. When Claude is idle at an empty
# prompt and the screen shows a usage-limit message, it waits until GRACE seconds after the
# reset time in that message, then types RESUME_MSG and presses Enter. If the limit hasn't
# lifted, Claude refuses again at no cost, and it retries every RETRY seconds.
#
# Safety:
#   - It never types while Claude is working ("esc to interrupt" on screen).
#   - It never types into a non-empty input box.
#   - It sends Enter only into the input box, never into a menu. If a dialog hides the box,
#     it sends one Escape, then types only if the empty box comes back.
#   - RESUME_MSG avoids the words the detector looks for, so it can't set itself off.
#
# Log: ~/.local/state/sensei/auto-resume.log
# Check it by hand:
#   bash ops/bin/auto-resume.sh --once            one detection pass on the live pane, no typing
#   bash ops/bin/auto-resume.sh --parse "<line>"  how a limit line's reset time is read

set -u
export LC_ALL="${AUTO_RESUME_LOCALE:-C.UTF-8}"  # the screen has ❯ and ─; match them as characters

SESSION="${SENSEI_TMUX_SESSION:-sensei}"
POLL="${AUTO_RESUME_POLL:-60}"                # seconds between screen checks
GRACE="${AUTO_RESUME_GRACE:-120}"             # seconds after the stated reset time
RETRY="${AUTO_RESUME_RETRY:-900}"             # seconds between attempts once the time has passed
RETRY_UNKNOWN="${AUTO_RESUME_RETRY_UNKNOWN:-1800}"  # seconds between attempts when no time is given
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/sensei"
LOG="$LOG_DIR/auto-resume.log"
RESUME_MSG='Usage window is open again (auto-resume). Resume from ops/CHECKPOINT.md. If a background agent was cut off, restart it from its work-unit files.'

# A limit line that states when it lifts: "limit" and then "reset", "resets" or "resets at",
# followed by a clock time (optionally after a weekday or date), or by "in <n>h <n>m".
STRICT_RE='limit.*resets?( at)?:? +(in +[0-9]+ ?(h|hr|hrs|hours?|m|min|mins|minutes?)|([a-z]{3,9}\.?,? +([0-9]{1,2}(st|nd|rd|th)?,? +)?)?[0-9]{1,2}(:[0-9]{2})? ?(am|pm)?)'
# A limit line with no time. Only trusted right above the input box.
LOOSE_RE='(usage limit reached|limit reached|hit your (usage )?limit|out of usage)'

log() {
  mkdir -p "$LOG_DIR"
  if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt 1048576 ]; then
    mv -f "$LOG" "$LOG.1"
  fi
  printf '%s %s\n' "$(date '+%F %T %Z')" "$*" >>"$LOG"
}

# The pane running Claude in the session, or nothing.
find_pane() {
  tmux list-panes -s -t "$SESSION" -F '#{pane_id} #{pane_current_command}' 2>/dev/null |
    awk '$2 == "claude" { print $1; exit }'
}

# The visible screen: wrapped lines joined, no-break spaces made plain, trailing blanks and
# empty lines dropped.
NBSP="$(printf '\302\240')"  # Claude's prompt is ❯ plus a no-break space
capture() {
  local screen
  screen="$(tmux capture-pane -p -J -t "$1" 2>/dev/null)"
  screen="${screen//"$NBSP"/ }"
  sed -e 's/[[:space:]]*$//' <<<"$screen" | grep -v '^$'
}

is_rule() { [[ "$1" =~ ^(─|━){10,}$ ]]; }

# Splits a screen into ABOVE (the content above Claude's input box), BOX (the text typed in
# the box) and HAS_BOX. The box is a rule, a line starting with ❯ or >, then a rule.
split_screen() {
  local -a lines
  mapfile -t lines <<<"$1"
  HAS_BOX=0 BOX="" ABOVE=""
  local i n=${#lines[@]}
  for ((i = n - 2; i >= 1; i--)); do
    if is_rule "${lines[i - 1]}" && [[ "${lines[i]}" =~ ^(❯|\>)\ ?(.*)$ ]]; then
      HAS_BOX=1
      BOX="${BASH_REMATCH[2]}"
      ABOVE="$(printf '%s\n' "${lines[@]:0:i-1}")"
      return
    fi
  done
  ABOVE="$1"
}

busy() { grep -q 'esc to interrupt' <<<"$1"; }

# The limit line on screen, if any. Strict lines count in the last 10 lines above the box
# (anywhere on screen if a dialog hides the box); loose ones only in the last 4.
find_limit_line() {
  local above="$1" line
  line="$(tail -n 10 <<<"$above" | grep -iE "$STRICT_RE" | tail -n 1)"
  if [ -z "$line" ]; then
    line="$(tail -n 4 <<<"$above" | grep -iE "$LOOSE_RE" | tail -n 1)"
  fi
  printf '%s' "$line"
}

# Epoch seconds when the limit in this line lifts, or nothing if it can't tell.
parse_reset() {
  local line="$1" now rest tz="" when target h=0 m=0
  now="$(date +%s)"
  rest="$(grep -ioE 'resets?( at)?:? +.*' <<<"$line" | head -n 1 | sed -E 's/^[Rr][Ee][Ss][Ee][Tt][Ss]?( [Aa][Tt])?:? +//')"
  [ -n "$rest" ] || return 0

  if [[ "$rest" =~ ^[Ii][Nn]\ +([0-9]+\ ?[a-zA-Z]+)(\ +([0-9]+\ ?[a-zA-Z]+))? ]]; then
    local part
    for part in "${BASH_REMATCH[1]}" "${BASH_REMATCH[3]:-}"; do
      [[ "$part" =~ ^([0-9]+)\ ?([hHmM]) ]] || continue
      case "${BASH_REMATCH[2]}" in
        h | H) h="${BASH_REMATCH[1]}" ;;
        m | M) m="${BASH_REMATCH[1]}" ;;
      esac
    done
    echo $((now + h * 3600 + m * 60))
    return 0
  fi

  if [[ "$rest" =~ \(([A-Za-z_]+(/[A-Za-z_+-]+)*)\) ]]; then
    local zone="${BASH_REMATCH[1]}"
    if [ "$zone" = "UTC" ] || [ -f "/usr/share/zoneinfo/$zone" ]; then tz="$zone"; fi
  fi
  # Keep only the date and time: an optional weekday or month, an optional day, a clock time.
  when="$(grep -oE '^(([A-Za-z]{3,9}\.?,? +)?([0-9]{1,2}(st|nd|rd|th)?,? +)?)?[0-9]{1,2}(:[0-9]{2})? ?([AaPp][Mm])?' <<<"$rest" |
    sed -E -e 's/([0-9])(st|nd|rd|th)/\1/' -e 's/[.,]+/ /g' -e 's/ +/ /g' -e 's/ $//')"
  [ -n "$when" ] || return 0
  if [ -n "$tz" ]; then
    target="$(TZ="$tz" date -d "$when" +%s 2>/dev/null)" || return 0
  else
    target="$(date -d "$when" +%s 2>/dev/null)" || return 0
  fi
  # A bare clock time means the next one: "3am" read at 11pm is tomorrow. A limit window is
  # at most a few hours, so a time well in the past belongs to the next day.
  if [ "$target" -lt $((now - 6 * 3600)) ]; then target=$((target + 86400)); fi
  echo "$target"
}

human() { date -d "@$1" '+%a %F %R %Z'; }

send_resume() {
  local pane="$1" screen
  screen="$(capture "$pane")"
  split_screen "$screen"
  if [ "$HAS_BOX" = 0 ]; then
    log "no input box on screen (a dialog?); sending one Escape"
    tmux send-keys -t "$pane" Escape
    sleep 3
    screen="$(capture "$pane")"
    split_screen "$screen"
    if [ "$HAS_BOX" = 0 ]; then
      log "still no input box; not typing. Screen bottom: $(tail -n 6 <<<"$screen" | tr '\n' '|')"
      return 1
    fi
  fi
  if busy "$screen"; then log "Claude is working again; not typing"; return 1; fi
  if [ -n "$BOX" ]; then log "input box isn't empty; not typing over it"; return 1; fi
  tmux send-keys -t "$pane" -l "$RESUME_MSG"
  sleep 1
  tmux send-keys -t "$pane" Enter
  log "typed the resume prompt"
}

once() {
  local pane screen line target
  pane="$(find_pane)"
  if [ -z "$pane" ]; then echo "no pane running claude in tmux session '$SESSION'"; return 1; fi
  screen="$(capture "$pane")"
  split_screen "$screen"
  echo "pane:        $pane"
  echo "input box:   $([ "$HAS_BOX" = 1 ] && echo "found, text: '${BOX}'" || echo "not found")"
  echo "busy:        $(busy "$screen" && echo yes || echo no)"
  line="$(find_limit_line "$ABOVE")"
  [ "$HAS_BOX" = 0 ] && [ -z "$line" ] && line="$(grep -iE "$STRICT_RE" <<<"$screen" | tail -n 1)"
  echo "limit line:  ${line:-none}"
  if [ -n "$line" ]; then
    target="$(parse_reset "$line")"
    echo "lifts at:    $([ -n "$target" ] && human "$target" || echo "unknown, would retry every ${RETRY_UNKNOWN}s")"
  fi
}

watch_loop() {
  mkdir -p "$LOG_DIR"
  exec 9>"$LOG_DIR/auto-resume.lock"
  if ! flock -n 9; then
    echo "auto-resume is already running"
    exit 0
  fi
  log "started (session $SESSION, poll ${POLL}s)"
  echo "auto-resume is watching tmux session '$SESSION'. Log: $LOG"

  local pane screen line seen_line="" target="" last_sent=0 now no_pane_logged=0 wait_for
  while true; do
    pane="$(find_pane)"
    if [ -z "$pane" ]; then
      [ "$no_pane_logged" = 1 ] || log "no pane running claude; waiting"
      no_pane_logged=1
      sleep "$POLL"
      continue
    fi
    no_pane_logged=0

    screen="$(capture "$pane")"
    if busy "$screen"; then
      if [ -n "$seen_line" ]; then log "Claude is working; limit cleared"; fi
      seen_line="" target=""
      sleep "$POLL"
      continue
    fi

    split_screen "$screen"
    line="$(find_limit_line "$ABOVE")"
    if [ "$HAS_BOX" = 0 ] && [ -z "$line" ]; then
      line="$(grep -iE "$STRICT_RE" <<<"$screen" | tail -n 1)"
    fi
    if [ -z "$line" ]; then
      if [ -n "$seen_line" ]; then log "limit message gone"; fi
      seen_line="" target=""
      sleep "$POLL"
      continue
    fi

    now="$(date +%s)"
    if [ "$line" != "$seen_line" ]; then
      seen_line="$line"
      target="$(parse_reset "$line")"
      if [ -n "$target" ]; then
        log "limit seen: '$line'. Resuming after $(human $((target + GRACE)))"
      else
        log "limit seen with no readable time: '$line'. Trying every ${RETRY_UNKNOWN}s"
        last_sent="$now"
      fi
    fi

    if [ -n "$target" ]; then
      if [ "$now" -lt $((target + GRACE)) ]; then
        wait_for=$((target + GRACE - now))
        sleep $((wait_for < POLL ? wait_for : POLL))
        continue
      fi
      [ $((now - last_sent)) -ge "$RETRY" ] || { sleep "$POLL"; continue; }
    else
      [ $((now - last_sent)) -ge "$RETRY_UNKNOWN" ] || { sleep "$POLL"; continue; }
    fi

    if send_resume "$pane"; then
      last_sent="$(date +%s)"
      sleep "$POLL"
    else
      sleep 300  # couldn't type safely; look again in five minutes
    fi
  done
}

main() {
  case "${1:-}" in
    --once) once ;;
    --parse)
      local t
      t="$(parse_reset "${2:-}")"
      if [ -n "$t" ]; then human "$t"; else echo "unknown"; fi
      ;;
    "") watch_loop ;;
    *) echo "usage: auto-resume.sh [--once | --parse <line>]" >&2; return 2 ;;
  esac
}

# Everything runs from main, so a git pull that rewrites this file can't change a running copy.
main "$@"; exit $?
