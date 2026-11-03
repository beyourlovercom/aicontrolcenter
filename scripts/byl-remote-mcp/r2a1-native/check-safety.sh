#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if grep -En '\b(sudo|launchctl|AuthorizationExecuteWithPrivileges|Process\(|FileManager\.default|Data\(contentsOf|createFile|socket\(|Network|UserDefaults|NSXPC|execve|open\(|\.unregister\(|agent-only-presealed-intake|read_file)\b' BackupRegistration.swift BackupRegistrarDaemon.swift; then
 echo 'Unexpected OS/private source operation introduced' >&2; exit 1
fi
grep -q 'SMAppService.daemon' BackupRegistration.swift
grep -q 'signedByApprovedTeam()' BackupRegistration.swift
grep -q 'RELEASE_SIGNER_NOT_ENROLLED' BackupRegistration.swift
grep -q 'UNENROLLED' Info.plist
grep -q 'R2A1_EXPORT=DISABLED_NOT_IMPLEMENTED' BackupRegistration.swift
grep -q 'AICC_R2A_REAL_BACKUP=NO' BackupRegistrarDaemon.swift
grep -q '<false/>' com.aicc.agent-only-backup-registrar.plist
if grep -qE '<key>(MachServices|Sockets|StartInterval|WatchPaths|KeepAlive)</key>.*<true/>' com.aicc.agent-only-backup-registrar.plist; then
 echo 'Daemon autoactivation forbidden in R2A1' >&2; exit 1
fi
echo 'STATIC REGISTRATION-ONLY SOURCE GATE PASS'
