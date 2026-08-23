#!/bin/sh
set -eu

REPOSITORY_ROOT="/Users/a/AI/007/AIcontrolcenter"
CANONICAL_REPOSITORY_ROOT="$(/bin/realpath "$REPOSITORY_ROOT" 2>/dev/null || printf '%s' "$REPOSITORY_ROOT")"
LABEL="com.aicc.v2.local-service"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HEALTH_URL="http://127.0.0.1:1420/api/live"
SUPERVISOR_LOCK_DIR="${TMPDIR:-/tmp}/aicc-v2-local-service-supervisor.lock"
STATE_DIR="${AICC_STATE_DIR:-$HOME/.aicc-v2}"
STATE_FILE="$STATE_DIR/local-service-supervisor.state"
HEALTH_FAILURE_THRESHOLD="${AICC_LOCAL_SERVICE_HEALTH_FAILURE_THRESHOLD:-3}"
MAX_RECOVERY_ATTEMPTS="${AICC_LOCAL_SERVICE_MAX_RECOVERY_ATTEMPTS:-3}"
STARTUP_FAILURE_THRESHOLD="${AICC_LOCAL_SERVICE_STARTUP_FAILURE_THRESHOLD:-5}"
STARTUP_GRACE_PERIOD="${AICC_LOCAL_SERVICE_STARTUP_GRACE_PERIOD:-45}"
HEALTH_CHECK_TIMEOUT="${AICC_LOCAL_SERVICE_HEALTH_CHECK_TIMEOUT:-5}"
HEALTH_BACKOFF_MAX=8

SERVICE_STATE="PROCESS_DEAD"
MANAGED_PID=""
CONSECUTIVE_FAILURES=0
RECOVERY_EPOCH=0
RECOVERY_ATTEMPTS=0
PREVIOUS_EPOCH=0
PREVIOUS_EPOCH_FAILURES=0
STARTUP_FAILURES=0
STARTUP_STARTED_AT=0
LAST_HEALTH_FAILURE=""
LAST_HEALTH_DETAIL=""
LAST_TRANSITION_AT=""
HEALTH_REASON="UNKNOWN"
HEALTH_DETAIL=""

timestamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

load_state() {
  [ -f "$STATE_FILE" ] || return 0
  while IFS='=' read -r KEY VALUE; do
    case "$KEY" in
      SERVICE_STATE) SERVICE_STATE="$VALUE" ;;
      MANAGED_PID) MANAGED_PID="$VALUE" ;;
      CONSECUTIVE_FAILURES) CONSECUTIVE_FAILURES="$VALUE" ;;
      RECOVERY_EPOCH) RECOVERY_EPOCH="$VALUE" ;;
      RECOVERY_ATTEMPTS) RECOVERY_ATTEMPTS="$VALUE" ;;
      PREVIOUS_EPOCH) PREVIOUS_EPOCH="$VALUE" ;;
      PREVIOUS_EPOCH_FAILURES) PREVIOUS_EPOCH_FAILURES="$VALUE" ;;
      STARTUP_FAILURES) STARTUP_FAILURES="$VALUE" ;;
      LAST_HEALTH_FAILURE) LAST_HEALTH_FAILURE="$VALUE" ;;
      LAST_HEALTH_DETAIL) LAST_HEALTH_DETAIL="$VALUE" ;;
      LAST_TRANSITION_AT) LAST_TRANSITION_AT="$VALUE" ;;
    esac
  done < "$STATE_FILE"
}

write_state() {
  mkdir -p "$STATE_DIR"
  STATE_TMP="$STATE_FILE.$$"
  {
    printf 'SERVICE_STATE=%s\n' "$SERVICE_STATE"
    printf 'MANAGED_PID=%s\n' "$MANAGED_PID"
    printf 'CONSECUTIVE_FAILURES=%s\n' "$CONSECUTIVE_FAILURES"
    printf 'RECOVERY_EPOCH=%s\n' "$RECOVERY_EPOCH"
    printf 'RECOVERY_ATTEMPTS=%s\n' "$RECOVERY_ATTEMPTS"
    printf 'PREVIOUS_EPOCH=%s\n' "$PREVIOUS_EPOCH"
    printf 'PREVIOUS_EPOCH_FAILURES=%s\n' "$PREVIOUS_EPOCH_FAILURES"
    printf 'STARTUP_FAILURES=%s\n' "$STARTUP_FAILURES"
    printf 'LAST_HEALTH_FAILURE=%s\n' "$LAST_HEALTH_FAILURE"
    printf 'LAST_HEALTH_DETAIL=%s\n' "$LAST_HEALTH_DETAIL"
    printf 'LAST_TRANSITION_AT=%s\n' "$LAST_TRANSITION_AT"
  } > "$STATE_TMP"
  mv "$STATE_TMP" "$STATE_FILE"
}

transition() {
  SERVICE_STATE="$1"
  LAST_TRANSITION_AT="$(timestamp)"
  write_state
}

record_health_failure() {
  LAST_HEALTH_FAILURE="$1"
  LAST_HEALTH_DETAIL="$2"
  CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
  if [ -n "$MANAGED_PID" ]; then transition "PROCESS_ALIVE_HEALTH_DEGRADED"; else transition "PROCESS_DEAD"; fi
  echo "HEALTH_CHECK_FAILED pid=${MANAGED_PID:-unknown} failure=$CONSECUTIVE_FAILURES reason=$LAST_HEALTH_FAILURE detail=${LAST_HEALTH_DETAIL:-unavailable}" >&2
}

health_probe() {
  PROBE_ERROR_FILE="$STATE_DIR/health-probe-error.$$"
  if PROBE_RESPONSE="$(curl --silent --show-error --max-time "$HEALTH_CHECK_TIMEOUT" -w '\n%{http_code}' "$HEALTH_URL" 2>"$PROBE_ERROR_FILE")"; then
    PROBE_EXIT=0
  else
    PROBE_EXIT=$?
  fi
  PROBE_ERROR="$(cat "$PROBE_ERROR_FILE" 2>/dev/null || true)"
  rm -f "$PROBE_ERROR_FILE"
  PROBE_STATUS="$(printf '%s\n' "$PROBE_RESPONSE" | tail -n 1)"
  PROBE_BODY="$(printf '%s\n' "$PROBE_RESPONSE" | sed '$d')"
  HEALTH_REASON="UNKNOWN"
  HEALTH_DETAIL="${PROBE_ERROR:-$PROBE_STATUS}"
  if [ "$PROBE_EXIT" -ne 0 ]; then
    case "$PROBE_EXIT" in
      7) HEALTH_REASON="ECONNREFUSED" ;;
      28) HEALTH_REASON="ETIMEDOUT" ;;
      56) HEALTH_REASON="CONNECTION_RESET" ;;
      *) HEALTH_REASON="UNKNOWN" ;;
    esac
    return 1
  fi
  case "$PROBE_STATUS" in
    4??|5??) HEALTH_REASON="HTTP_$PROBE_STATUS"; return 1 ;;
    2??)
      if printf '%s' "$PROBE_BODY" | grep -q '"service":"aicc-local-control"' && printf '%s' "$PROBE_BODY" | grep -q '"live":true'; then
        return 0
      fi
      HEALTH_REASON="INVALID_HEALTH_RESPONSE"
      return 1
      ;;
    *) HEALTH_REASON="UNKNOWN"; return 1 ;;
  esac
}

listener_pid() {
  /usr/sbin/lsof -nP -iTCP:1420 -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true
}

canonical_pid() {
  CHECK_PID="$1"
  [ -n "$CHECK_PID" ] || return 1
  CHECK_CWD="$(/usr/sbin/lsof -a -p "$CHECK_PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"
  CHECK_CWD_CANONICAL="$(/bin/realpath "$CHECK_CWD" 2>/dev/null || printf '%s' "$CHECK_CWD")"
  CHECK_COMMAND="$(/bin/ps -p "$CHECK_PID" -o command= 2>/dev/null || true)"
  [ "$CHECK_CWD_CANONICAL" = "$CANONICAL_REPOSITORY_ROOT" ] && printf '%s' "$CHECK_COMMAND" | grep -Eq 'node_modules/.bin/vite|vite .*127\.0\.0\.1'
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

reset_state_for_manual_restart() {
  load_state
  PREVIOUS_EPOCH="$RECOVERY_EPOCH"
  PREVIOUS_EPOCH_FAILURES="$CONSECUTIVE_FAILURES"
  RECOVERY_EPOCH=$((RECOVERY_EPOCH + 1))
  RECOVERY_ATTEMPTS=1
  SERVICE_STATE="RESTARTING"
  LAST_TRANSITION_AT="$(timestamp)"
  write_state
}

terminate_canonical_pid() {
  TARGET_PID="$1"
  canonical_pid "$TARGET_PID" || return 2
  echo "LOCAL_SERVICE_TERMINATION_STARTED pid=$TARGET_PID" >&2
  kill -TERM "$TARGET_PID" 2>/dev/null || true
  WAIT_COUNT=0
  while kill -0 "$TARGET_PID" 2>/dev/null && [ "$WAIT_COUNT" -lt 10 ]; do
    sleep 0.2
    WAIT_COUNT=$((WAIT_COUNT + 1))
  done
  if kill -0 "$TARGET_PID" 2>/dev/null; then
    canonical_pid "$TARGET_PID" || return 2
    kill -KILL "$TARGET_PID" 2>/dev/null || true
    WAIT_COUNT=0
    while kill -0 "$TARGET_PID" 2>/dev/null && [ "$WAIT_COUNT" -lt 10 ]; do
      sleep 0.2
      WAIT_COUNT=$((WAIT_COUNT + 1))
    done
  fi
  if kill -0 "$TARGET_PID" 2>/dev/null; then
    LAST_HEALTH_FAILURE="PROCESS_EXITED"
    LAST_HEALTH_DETAIL="managed PID did not exit after graceful termination and bounded escalation"
    return 1
  fi
  echo "LOCAL_SERVICE_TERMINATED pid=$TARGET_PID" >&2
  if [ -n "$APP_PID" ] && [ "$APP_PID" != "$TARGET_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
    kill -TERM "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  APP_PID=""
  MANAGED_PID=""
  return 0
}

start_official_service() {
  if [ -n "${APP_PID:-}" ] && kill -0 "$APP_PID" 2>/dev/null; then
    return 0
  fi
  echo "LOCAL_SERVICE_RESTART_STARTED attempt=$RECOVERY_ATTEMPTS" >&2
  "$NPM_PATH" run dev -- --host 127.0.0.1 &
  APP_PID=$!
  MANAGED_PID=""
  STARTUP_FAILURES=0
  STARTUP_STARTED_AT="$(date +%s)"
  transition "RESTARTING"
}

terminate_stale_app_process() {
  if [ -z "${APP_PID:-}" ] || ! kill -0 "$APP_PID" 2>/dev/null; then
    APP_PID=""
    return 0
  fi
  kill -TERM "$APP_PID" 2>/dev/null || true
  WAIT_COUNT=0
  while kill -0 "$APP_PID" 2>/dev/null && [ "$WAIT_COUNT" -lt 10 ]; do
    sleep 0.2
    WAIT_COUNT=$((WAIT_COUNT + 1))
  done
  if kill -0 "$APP_PID" 2>/dev/null; then
    kill -KILL "$APP_PID" 2>/dev/null || true
    WAIT_COUNT=0
    while kill -0 "$APP_PID" 2>/dev/null && [ "$WAIT_COUNT" -lt 10 ]; do
      sleep 0.2
      WAIT_COUNT=$((WAIT_COUNT + 1))
    done
  fi
  kill -0 "$APP_PID" 2>/dev/null && return 1
  APP_PID=""
  return 0
}

start_after_true_process_death() {
  LAST_HEALTH_FAILURE="PROCESS_EXITED"
  LAST_HEALTH_DETAIL="verified canonical Vite PID is no longer alive"
  MANAGED_PID=""
  transition "PROCESS_DEAD"
  if [ "$RECOVERY_ATTEMPTS" -ge "$MAX_RECOVERY_ATTEMPTS" ]; then
    transition "RECOVERY_FAILED"
    echo "LOCAL_SERVICE_RECOVERY_FAILED attempts=$RECOVERY_ATTEMPTS reason=$LAST_HEALTH_FAILURE detail=$LAST_HEALTH_DETAIL" >&2
    return 1
  fi
  if ! terminate_stale_app_process; then
    transition "RECOVERY_FAILED"
    echo "LOCAL_SERVICE_RECOVERY_FAILED attempts=$RECOVERY_ATTEMPTS reason=STALE_APP_PROCESS" >&2
    return 1
  fi
  RECOVERY_ATTEMPTS=$((RECOVERY_ATTEMPTS + 1))
  start_official_service
}

adopt_verified_canonical_listener() {
  CANDIDATE_PID="$(listener_pid)"
  [ -n "$CANDIDATE_PID" ] || return 1
  canonical_pid "$CANDIDATE_PID" || return 1
  health_probe || return 1
  MANAGED_PID="$CANDIDATE_PID"
  CONSECUTIVE_FAILURES=0
  RECOVERY_ATTEMPTS=0
  STARTUP_FAILURES=0
  STARTUP_STARTED_AT=0
  LAST_HEALTH_FAILURE=""
  LAST_HEALTH_DETAIL=""
  HEALTH_BACKOFF=1
  transition "HEALTHY"
  echo "LOCAL_SERVICE_CANONICAL_ADOPTED pid=$CANDIDATE_PID recoveryEpoch=$RECOVERY_EPOCH" >&2
  return 0
}

is_transient_health_failure() {
  [ "$1" = "ETIMEDOUT" ] || [ "$1" = "CONNECTION_RESET" ]
}

begin_recovery() {
  if [ "$RECOVERY_ATTEMPTS" -ge "$MAX_RECOVERY_ATTEMPTS" ]; then
    transition "RECOVERY_FAILED"
    echo "LOCAL_SERVICE_RECOVERY_FAILED attempts=$RECOVERY_ATTEMPTS reason=${LAST_HEALTH_FAILURE:-UNKNOWN}" >&2
    return 1
  fi
  if [ "$RECOVERY_ATTEMPTS" -eq 0 ]; then
    PREVIOUS_EPOCH="$RECOVERY_EPOCH"
    PREVIOUS_EPOCH_FAILURES="$CONSECUTIVE_FAILURES"
    RECOVERY_EPOCH=$((RECOVERY_EPOCH + 1))
  fi
  RECOVERY_ATTEMPTS=$((RECOVERY_ATTEMPTS + 1))
  STARTUP_FAILURES=0
  transition "SERVICE_UNHEALTHY"
  return 0
}

recover_unhealthy_managed_service() {
  TARGET_PID="$1"
  echo "HEALTH_RECOVERY_THRESHOLD_REACHED pid=$TARGET_PID failures=$CONSECUTIVE_FAILURES recoveryEpoch=$RECOVERY_EPOCH" >&2
  if begin_recovery; then
    if terminate_canonical_pid "$TARGET_PID"; then
      # The verified Vite listener and the supervisor-owned npm parent are both
      # gone before a replacement is permitted to bind the canonical port.
      start_official_service
    else
      LAST_HEALTH_FAILURE="PROCESS_EXITED"
      LAST_HEALTH_DETAIL="safe managed PID termination could not be confirmed"
      transition "RECOVERY_FAILED"
      echo "LOCAL_SERVICE_RECOVERY_FAILED attempts=$RECOVERY_ATTEMPTS reason=$LAST_HEALTH_FAILURE" >&2
    fi
  fi
}

run_watchdog() {
  NPM_PATH="$1"
  acquire_singleton || exit 0
  mkdir -p "$STATE_DIR"
  load_state
  APP_PID=""
  HEALTH_BACKOFF=1
  trap '[ -z "$APP_PID" ] || kill -TERM "$APP_PID" 2>/dev/null || true; exit 0' TERM INT
  while :; do
    # A failed recovery epoch is fail-closed: only the Owner's reset/restart
    # command can open another bounded recovery budget.
    if [ "$SERVICE_STATE" = "RECOVERY_FAILED" ]; then
      sleep "$HEALTH_BACKOFF_MAX"
      continue
    fi
    SLEEP_SECONDS=1
    PORT_PID="$(listener_pid)"
    if [ -n "$PORT_PID" ]; then
      if health_probe; then
        MANAGED_PID="$PORT_PID"
        if [ "$RECOVERY_ATTEMPTS" -gt 0 ]; then
          echo "LOCAL_SERVICE_HEALTH_RECOVERED pid=$PORT_PID recoveryEpoch=$RECOVERY_EPOCH attempts=$RECOVERY_ATTEMPTS" >&2
          CONSECUTIVE_FAILURES=0
          transition "RECOVERED"
          RECOVERY_ATTEMPTS=0
          HEALTH_BACKOFF=1
          write_state
        else
          CONSECUTIVE_FAILURES=0
          HEALTH_BACKOFF=1
          transition "HEALTHY"
        fi
      elif canonical_pid "$PORT_PID"; then
        MANAGED_PID="$PORT_PID"
        NOW_EPOCH="$(date +%s)"
        STARTUP_ELAPSED=$((NOW_EPOCH - STARTUP_STARTED_AT))
        if [ "$STARTUP_STARTED_AT" -gt 0 ] && [ "$STARTUP_ELAPSED" -lt "$STARTUP_GRACE_PERIOD" ] && [ -n "${APP_PID:-}" ] && kill -0 "$APP_PID" 2>/dev/null; then
          STARTUP_FAILURES=$((STARTUP_FAILURES + 1))
          transition "RESTARTING"
          echo "LOCAL_SERVICE_STARTUP_WARMUP pid=$PORT_PID elapsed=${STARTUP_ELAPSED}s grace=${STARTUP_GRACE_PERIOD}s reason=$HEALTH_REASON" >&2
          sleep "$SLEEP_SECONDS"
          continue
        fi
        record_health_failure "$HEALTH_REASON" "$HEALTH_DETAIL"
        if [ "$CONSECUTIVE_FAILURES" -ge "$HEALTH_FAILURE_THRESHOLD" ]; then
          recover_unhealthy_managed_service "$PORT_PID"
        elif is_transient_health_failure "$HEALTH_REASON"; then
          HEALTH_BACKOFF=$((HEALTH_BACKOFF * 2))
          [ "$HEALTH_BACKOFF" -le "$HEALTH_BACKOFF_MAX" ] || HEALTH_BACKOFF="$HEALTH_BACKOFF_MAX"
          sleep "$HEALTH_BACKOFF"
        fi
      elif [ "$PORT_PID" = "$MANAGED_PID" ] && ! kill -0 "$MANAGED_PID" 2>/dev/null; then
        start_after_true_process_death || true
      else
        MANAGED_PID=""
        LAST_HEALTH_FAILURE="FOREIGN_PORT_CONFLICT"
        LAST_HEALTH_DETAIL="pid=$PORT_PID process=$(/bin/ps -p "$PORT_PID" -o command= 2>/dev/null || true)"
        transition "PROCESS_ALIVE_HEALTH_DEGRADED"
        echo "PORT_1420_CONFLICT pid=$PORT_PID process=${LAST_HEALTH_DETAIL#*process=}" >&2
      fi
    else
      if [ -n "$MANAGED_PID" ]; then
        if kill -0 "$MANAGED_PID" 2>/dev/null; then
          LAST_HEALTH_FAILURE="HEALTH_UNRESPONSIVE"
          LAST_HEALTH_DETAIL="managed Vite PID remains alive while listener response is unavailable"
          record_health_failure "$LAST_HEALTH_FAILURE" "$LAST_HEALTH_DETAIL"
          if [ "$CONSECUTIVE_FAILURES" -ge "$HEALTH_FAILURE_THRESHOLD" ]; then
            recover_unhealthy_managed_service "$MANAGED_PID"
          elif is_transient_health_failure "$HEALTH_REASON"; then
            HEALTH_BACKOFF=$((HEALTH_BACKOFF * 2))
            [ "$HEALTH_BACKOFF" -le "$HEALTH_BACKOFF_MAX" ] || HEALTH_BACKOFF="$HEALTH_BACKOFF_MAX"
            sleep "$HEALTH_BACKOFF"
          fi
        else
          start_after_true_process_death || true
        fi
      elif [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
        STARTUP_FAILURES=$((STARTUP_FAILURES + 1))
        transition "RESTARTING"
        echo "LOCAL_SERVICE_STARTUP_WAIT pid=$APP_PID failures=$STARTUP_FAILURES" >&2
      else
        MANAGED_PID=""
        APP_PID=""
        RECOVERY_ATTEMPTS=0
        start_official_service
      fi
    fi
    write_state
    sleep "$SLEEP_SECONDS"
  done
}

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
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$NODE_BIN_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string><key>NODE_PATH</key><string>$NODE_PATH</string><key>AICC_REMOTE_RUNNER_URL</key><string>http://100.94.52.109:8787</string></dict>
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
  restart)
    reset_state_for_manual_restart
    APP_PID=""
    PORT_PID="$(listener_pid)"
    if [ -n "$PORT_PID" ]; then
      if canonical_pid "$PORT_PID"; then
        terminate_canonical_pid "$PORT_PID" || exit 1
      else
        echo "PORT_1420_CONFLICT pid=$PORT_PID process=$(/bin/ps -p "$PORT_PID" -o command= 2>/dev/null || true)" >&2
        exit 1
      fi
    fi
    echo "LOCAL_SERVICE_OWNER_RESTART_REQUESTED pid=${PORT_PID:-unknown}" >&2
    ;;
  reset) reset_state_for_manual_restart ;;
  stop) launchctl kill SIGTERM "gui/$(id -u)/$LABEL" ;;
  disable) launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true ;;
  status) launchctl print "gui/$(id -u)/$LABEL" ;;
  *) echo "usage: $0 {install|enable|run|status|restart|reset|stop|disable}" >&2; exit 2 ;;
esac
