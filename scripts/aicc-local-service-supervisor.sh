#!/bin/sh
set -eu

REPOSITORY_ROOT="/Users/a/AI/007/AIcontrolcenter"
LABEL="com.aicc.v2.local-service"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HEALTH_URL="http://127.0.0.1:1420/api/health"
SUPERVISOR_LOCK_DIR="${TMPDIR:-/tmp}/aicc-v2-local-service-supervisor.lock"

health_ok() {
  RESPONSE="$(curl --silent --show-error --max-time 1 "$HEALTH_URL" 2>/dev/null || true)"
  printf '%s' "$RESPONSE" | grep -q '"service":"aicc-local-control"' &&
    printf '%s' "$RESPONSE" | grep -q '"ok":true'
}

listener_pid() {
  /usr/sbin/lsof -nP -iTCP:1420 -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true
}

canonical_pid() {
  CHECK_PID="$1"
  [ -n "$CHECK_PID" ] || return 1
  CHECK_CWD="$(/usr/sbin/lsof -a -p "$CHECK_PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"
  CHECK_COMMAND="$(/bin/ps -p "$CHECK_PID" -o command= 2>/dev/null || true)"
  [ "$CHECK_CWD" = "$REPOSITORY_ROOT" ] && printf '%s' "$CHECK_COMMAND" | grep -Eq 'node_modules/.bin/vite|vite .*127\.0\.0\.1'
}

acquire_singleton() {
  if mkdir "$SUPERVISOR_LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" > "$SUPERVISOR_LOCK_DIR/pid"
    trap 'rm -f "$SUPERVISOR_LOCK_DIR/pid"; rmdir "$SUPERVISOR_LOCK_DIR" 2>/dev/null || true' EXIT
    return 0
  fi
  EXISTING_PID="$(cat "$SUPERVISOR_LOCK_DIR/pid" 2>/dev/null || true)"
  if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "SUPERVISOR_SINGLETON_ALREADY_RUNNING pid=$EXISTING_PID" >&2
    return 1
  fi
  rm -f "$SUPERVISOR_LOCK_DIR/pid"
  rmdir "$SUPERVISOR_LOCK_DIR" 2>/dev/null || return 1
  mkdir "$SUPERVISOR_LOCK_DIR" 2>/dev/null || return 1
  printf '%s\n' "$$" > "$SUPERVISOR_LOCK_DIR/pid"
  trap 'rm -f "$SUPERVISOR_LOCK_DIR/pid"; rmdir "$SUPERVISOR_LOCK_DIR" 2>/dev/null || true' EXIT
}

run_watchdog() {
  NPM_PATH="$1"
  acquire_singleton || exit 0
  APP_PID=""
  FAILED_HEALTH=0
  HEALTH_BACKOFF=1
  trap '[ -z "$APP_PID" ] || kill -TERM "$APP_PID" 2>/dev/null || true; exit 0' TERM INT
  while :; do
    SLEEP_SECONDS=1
    PORT_PID="$(listener_pid)"
    if [ -n "$PORT_PID" ]; then
      if health_ok; then
        FAILED_HEALTH=0
        HEALTH_BACKOFF=1
      elif canonical_pid "$PORT_PID"; then
        FAILED_HEALTH=$((FAILED_HEALTH + 1))
        echo "PROCESS_ALIVE_HEALTH_DEGRADED pid=$PORT_PID failures=$FAILED_HEALTH recovery=retry" >&2
        if [ "$FAILED_HEALTH" -ge 2 ]; then
          SLEEP_SECONDS="$HEALTH_BACKOFF"
          [ "$HEALTH_BACKOFF" -lt 8 ] && HEALTH_BACKOFF=$((HEALTH_BACKOFF * 2))
        fi
      else
        FAILED_HEALTH=0
        HEALTH_BACKOFF=1
        echo "PORT_1420_CONFLICT pid=$PORT_PID process=$(/bin/ps -p "$PORT_PID" -o command= 2>/dev/null || true)" >&2
      fi
    else
      FAILED_HEALTH=0
      if [ -z "$APP_PID" ] || ! kill -0 "$APP_PID" 2>/dev/null; then
        [ -z "$APP_PID" ] || wait "$APP_PID" 2>/dev/null || true
        "$NPM_PATH" run dev -- --host 127.0.0.1 &
        APP_PID=$!
      fi
    fi
    sleep "$SLEEP_SECONDS"
  done
}

# HEALTH_FAILURE_DIRECT_KILL_PATH_COUNT=0
# Health timeout is never authority to kill the process hosting the AICC Web UI.

case "${1:-status}" in
  install|enable)
    NODE_PATH="$(command -v node || true)"
    NPM_PATH="$(command -v npm || true)"
    if [ -z "$NODE_PATH" ] || [ -z "$NPM_PATH" ]; then
      echo "NODE_NPM_TOOLCHAIN_NOT_FOUND" >&2
      exit 1
    fi
    NODE_BIN_DIR="$(dirname "$NODE_PATH")"
    mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/AICC"
    launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>$REPOSITORY_ROOT/scripts/aicc-local-service-supervisor.sh</string><string>run</string><string>$NPM_PATH</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$NODE_BIN_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string><key>NODE_PATH</key><string>$NODE_PATH</string></dict>
  <key>WorkingDirectory</key><string>$REPOSITORY_ROOT</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/AICC/local-service.stdout.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/AICC/local-service.stderr.log</string>
</dict></plist>
EOF
    plutil -lint "$PLIST"
    launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl kickstart -k "gui/$(id -u)/$LABEL"
    ;;
  run) run_watchdog "${2:?NPM_PATH_REQUIRED}" ;;
  restart) launchctl kickstart -k "gui/$(id -u)/$LABEL" ;;
  stop) launchctl kill SIGTERM "gui/$(id -u)/$LABEL" ;;
  disable) launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true ;;
  status) launchctl print "gui/$(id -u)/$LABEL" ;;
  *) echo "usage: $0 {install|enable|run|status|restart|stop|disable}" >&2; exit 2 ;;
esac
