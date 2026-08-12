#!/bin/sh
set -eu

REPOSITORY_ROOT="/Users/a/AI/007/AIcontrolcenter"
LABEL="com.aicc.v2.local-service"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

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
  <key>ProgramArguments</key><array><string>$NPM_PATH</string><string>run</string><string>dev</string><string>--</string><string>--host</string><string>127.0.0.1</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$NODE_BIN_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string><key>NODE_PATH</key><string>$NODE_PATH</string></dict>
  <key>WorkingDirectory</key><string>$REPOSITORY_ROOT</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/AICC/local-service.stdout.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/AICC/local-service.stderr.log</string>
</dict></plist>
EOF
    plutil -lint "$PLIST"
    launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl kickstart -k "gui/$(id -u)/$LABEL"
    ;;
  restart) launchctl kickstart -k "gui/$(id -u)/$LABEL" ;;
  stop) launchctl kill SIGTERM "gui/$(id -u)/$LABEL" ;;
  disable) launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true ;;
  status) launchctl print "gui/$(id -u)/$LABEL" ;;
  *) echo "usage: $0 {install|enable|status|restart|stop|disable}" >&2; exit 2 ;;
esac
