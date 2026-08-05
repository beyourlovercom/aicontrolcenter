use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

pub const CANONICAL_PATH: &str = "/Users/a/AI/007/AIcontrolcenter";
const MAX_OUTPUT: usize = 64 * 1024;
const COMMAND_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryIdentity {
    pub canonical_path: String,
    pub repository_valid: bool,
    pub origin_present: bool,
    pub origin_display: Option<String>,
    pub current_branch: Option<String>,
    pub local_head: Option<String>,
    pub local_main_sha: Option<String>,
    pub worktree_clean: bool,
    pub worktree_entries: Vec<String>,
    pub detached_head: bool,
    pub checked_at: String,
    pub diagnostics: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AuthorityStatus {
    Verified,
    Drift,
    RemoteUnavailable,
    RemoteInvalidResponse,
    RepositoryInvalid,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RemoteAuthority {
    pub status: AuthorityStatus,
    pub remote_main_sha: Option<String>,
    pub authority_sha: String,
    pub checked_at: String,
    pub diagnostics: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionGuardSnapshot {
    pub active_open_code_run: bool,
    pub writer_lock_held: bool,
    pub unsaved_diff: bool,
    pub previous_run_open: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SyncBlocker {
    RemoteUnavailable,
    RepositoryInvalid,
    WorktreeDirty,
    ActiveRun,
    WriterLocked,
    UnsavedDiff,
    PreviousRunOpen,
    NonFastForward,
    SyncNotRequired,
    SyncRequired,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSyncEvaluation {
    pub allowed: bool,
    pub blockers: Vec<SyncBlocker>,
    pub planned_actions: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSyncResult {
    pub success: bool,
    pub actions: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ResolverDecision {
    StartAllowed,
    Blocked,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ResolverBlocker {
    SyncRequired,
    WorktreeDirty,
    AuthorityDrift,
    WorkPackageNotAuthorized,
    DependencyNotClosed,
    OpenspecChangeMissing,
    OpenspecPlanningIncomplete,
    PreviousRunOpen,
    WriterLocked,
    ActiveRun,
    UnsavedDiff,
    RemoteUnavailable,
    RepositoryInvalid,
    WorkPackageSchemaInvalid,
    MultipleAuthorizedWorkPackages,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct DependencyRecord {
    pub id: String,
    pub status: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkPackageRecord {
    pub id: String,
    pub title: String,
    pub status: String,
    pub authority_sha: String,
    pub openspec_change: String,
    pub dependencies: Vec<DependencyRecord>,
    pub previous_run_status: String,
    pub owner_authorization: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResolverDecisionResult {
    pub decision: ResolverDecision,
    pub work_package: Option<WorkPackageRecord>,
    pub blockers: Vec<ResolverBlocker>,
}

#[derive(Debug, Serialize)]
pub struct ControlLoopError {
    pub code: String,
    pub message: String,
}

#[derive(Debug)]
struct GitOutput {
    stdout: String,
}

fn now() -> String {
    chrono_like_now()
}
fn chrono_like_now() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".into())
}

fn safe_error(text: &str) -> String {
    let mut result = text.to_string();
    if let Some(at) = result.find("@") {
        if result[..at].contains("://") {
            result = result[at + 1..].to_string();
        }
    }
    result.replace(CANONICAL_PATH, "<canonical-repository>")
}

fn run_git(root: &Path, args: &[&str]) -> Result<GitOutput, ControlLoopError> {
    let mut child = Command::new("git")
        .args(args)
        .current_dir(root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| ControlLoopError {
            code: "GIT_EXECUTION_FAILED".into(),
            message: safe_error(&e.to_string()),
        })?;
    let mut stdout = child.stdout.take().expect("stdout pipe");
    let mut stderr = child.stderr.take().expect("stderr pipe");
    let out_thread = thread::spawn(move || {
        let mut data = Vec::new();
        let _ = stdout.read_to_end(&mut data);
        data
    });
    let err_thread = thread::spawn(move || {
        let mut data = Vec::new();
        let _ = stderr.read_to_end(&mut data);
        data
    });
    let started = Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|e| ControlLoopError {
            code: "GIT_WAIT_FAILED".into(),
            message: safe_error(&e.to_string()),
        })? {
            let stdout_bytes = out_thread.join().unwrap_or_default();
            let stderr_bytes = err_thread.join().unwrap_or_default();
            let stdout =
                String::from_utf8_lossy(&stdout_bytes[..stdout_bytes.len().min(MAX_OUTPUT)])
                    .to_string();
            let stderr =
                String::from_utf8_lossy(&stderr_bytes[..stderr_bytes.len().min(MAX_OUTPUT)])
                    .to_string();
            if !status.success() {
                return Err(ControlLoopError {
                    code: "GIT_COMMAND_FAILED".into(),
                    message: safe_error(&format!("{} {}", status, stderr)),
                });
            }
            return Ok(GitOutput { stdout });
        }
        if started.elapsed() > COMMAND_TIMEOUT {
            let _ = child.kill();
            return Err(ControlLoopError {
                code: "GIT_TIMEOUT".into(),
                message: "git command timed out".into(),
            });
        }
        thread::sleep(Duration::from_millis(25));
    }
}

fn validate_root(path: &Path, allow_test_root: bool) -> Result<PathBuf, ControlLoopError> {
    if path.as_os_str().is_empty() || !path.is_absolute() {
        return Err(ControlLoopError {
            code: "REPOSITORY_INVALID".into(),
            message: "repository path must be absolute".into(),
        });
    }
    let canonical = fs::canonicalize(path).map_err(|_| ControlLoopError {
        code: "REPOSITORY_INVALID".into(),
        message: "repository path does not exist".into(),
    })?;
    if !allow_test_root && canonical != Path::new(CANONICAL_PATH) {
        return Err(ControlLoopError {
            code: "REPOSITORY_INVALID".into(),
            message: "repository path is not canonical".into(),
        });
    }
    if !canonical.join(".git").exists() {
        return Err(ControlLoopError {
            code: "REPOSITORY_INVALID".into(),
            message: "repository has no .git directory".into(),
        });
    }
    Ok(canonical)
}

fn trim_output(output: &str) -> Option<String> {
    output
        .lines()
        .next()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
}
fn identity_at(root: &Path, allow_test_root: bool) -> Result<RepositoryIdentity, ControlLoopError> {
    let root = validate_root(root, allow_test_root)?;
    let origin = run_git(&root, &["remote", "get-url", "origin"])
        .ok()
        .and_then(|o| trim_output(&o.stdout));
    let branch = run_git(&root, &["branch", "--show-current"])
        .ok()
        .and_then(|o| trim_output(&o.stdout));
    let head = run_git(&root, &["rev-parse", "HEAD"])
        .ok()
        .and_then(|o| trim_output(&o.stdout));
    let main = run_git(&root, &["rev-parse", "refs/heads/main"])
        .ok()
        .and_then(|o| trim_output(&o.stdout));
    let status = run_git(&root, &["status", "--porcelain=v1"])?;
    let entries = status
        .stdout
        .lines()
        .map(str::to_string)
        .collect::<Vec<_>>();
    let display = origin.as_deref().and_then(safe_remote_display);
    Ok(RepositoryIdentity {
        canonical_path: root.display().to_string(),
        repository_valid: true,
        origin_present: origin.is_some(),
        origin_display: display,
        current_branch: branch.clone(),
        local_head: head,
        local_main_sha: main,
        worktree_clean: entries.is_empty(),
        worktree_entries: entries,
        detached_head: branch.as_deref().unwrap_or("").is_empty(),
        checked_at: now(),
        diagnostics: if origin.is_some() {
            Vec::new()
        } else {
            vec!["origin remote is missing".into()]
        },
    })
}

fn safe_remote_display(remote: &str) -> Option<String> {
    let cleaned = remote.trim_end_matches('/').split('/').collect::<Vec<_>>();
    let name = cleaned.last()?.trim_end_matches(".git");
    let owner = if remote.starts_with("git@") {
        remote.split(':').nth(1)?.split('/').next()?
    } else {
        cleaned.get(cleaned.len().saturating_sub(2))?
    };
    if owner.is_empty()
        || name.is_empty()
        || remote.contains('@') && remote.contains(':') && !remote.starts_with("git@")
    {
        return None;
    }
    Some(format!("{owner}/{name}"))
}

fn authority_at(root: &Path, allow_test_root: bool) -> RemoteAuthority {
    let checked_at = now();
    if identity_at(root, allow_test_root).is_err() {
        return RemoteAuthority {
            status: AuthorityStatus::RepositoryInvalid,
            remote_main_sha: None,
            authority_sha: String::new(),
            checked_at,
            diagnostics: vec!["repository validation failed".into()],
        };
    }
    match run_git(root, &["ls-remote", "origin", "refs/heads/main"]) {
        Ok(output) => {
            let mut lines = output.stdout.lines();
            let line = lines.next().unwrap_or("");
            let fields = line.split_whitespace().collect::<Vec<_>>();
            if fields.len() != 2
                || fields[1] != "refs/heads/main"
                || fields[0].len() != 40
                || !fields[0].chars().all(|c| c.is_ascii_hexdigit())
                || lines.next().is_some()
            {
                return RemoteAuthority {
                    status: AuthorityStatus::RemoteInvalidResponse,
                    remote_main_sha: None,
                    authority_sha: String::new(),
                    checked_at,
                    diagnostics: vec!["ls-remote response is malformed".into()],
                };
            }
            let sha = fields[0].to_ascii_lowercase();
            RemoteAuthority {
                status: AuthorityStatus::Verified,
                remote_main_sha: Some(sha),
                authority_sha: fields[0].to_ascii_lowercase(),
                checked_at,
                diagnostics: Vec::new(),
            }
        }
        Err(error) => RemoteAuthority {
            status: AuthorityStatus::RemoteUnavailable,
            remote_main_sha: None,
            authority_sha: String::new(),
            checked_at,
            diagnostics: vec![safe_error(&error.message)],
        },
    }
}

fn evaluate(
    identity: &RepositoryIdentity,
    authority: &RemoteAuthority,
    guards: &ExecutionGuardSnapshot,
) -> WorkspaceSyncEvaluation {
    let mut blockers = Vec::new();
    if !identity.repository_valid {
        blockers.push(SyncBlocker::RepositoryInvalid);
    }
    if authority.status == AuthorityStatus::RemoteUnavailable
        || authority.status == AuthorityStatus::RemoteInvalidResponse
    {
        blockers.push(SyncBlocker::RemoteUnavailable);
    }
    if authority.status == AuthorityStatus::RepositoryInvalid || !identity.repository_valid {
        blockers.push(SyncBlocker::RepositoryInvalid);
    }
    if !identity.worktree_clean {
        blockers.push(SyncBlocker::WorktreeDirty);
    }
    if guards.active_open_code_run {
        blockers.push(SyncBlocker::ActiveRun);
    }
    if guards.writer_lock_held {
        blockers.push(SyncBlocker::WriterLocked);
    }
    if guards.unsaved_diff {
        blockers.push(SyncBlocker::UnsavedDiff);
    }
    if guards.previous_run_open {
        blockers.push(SyncBlocker::PreviousRunOpen);
    }
    if blockers.is_empty()
        && identity.local_main_sha.as_deref() == authority.remote_main_sha.as_deref()
    {
        blockers.push(SyncBlocker::SyncNotRequired);
    } else if blockers.is_empty() {
        blockers.push(SyncBlocker::SyncRequired);
    }
    WorkspaceSyncEvaluation {
        allowed: blockers == [SyncBlocker::SyncRequired],
        blockers,
        planned_actions: vec![
            "git fetch origin main".into(),
            "git switch main".into(),
            "git merge --ff-only origin/main".into(),
        ],
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PackageFrontMatter {
    schema: String,
    id: String,
    title: String,
    status: String,
    authority_sha: String,
    openspec_change: String,
    dependencies: Vec<DependencyRecord>,
    previous_run_status: String,
    owner_authorization: String,
}

fn parse_package(path: &Path) -> Result<WorkPackageRecord, ResolverBlocker> {
    let content =
        fs::read_to_string(path).map_err(|_| ResolverBlocker::WorkPackageSchemaInvalid)?;
    let mut parts = content.splitn(3, "---");
    let _ = parts.next();
    let yaml = parts
        .next()
        .ok_or(ResolverBlocker::WorkPackageSchemaInvalid)?;
    let parsed: PackageFrontMatter =
        serde_yaml::from_str(yaml).map_err(|_| ResolverBlocker::WorkPackageSchemaInvalid)?;
    if parsed.schema != "aicc-work-package/v1" || parsed.id.is_empty() || parsed.title.is_empty() {
        return Err(ResolverBlocker::WorkPackageSchemaInvalid);
    }
    Ok(WorkPackageRecord {
        id: parsed.id,
        title: parsed.title,
        status: parsed.status,
        authority_sha: parsed.authority_sha,
        openspec_change: parsed.openspec_change,
        dependencies: parsed.dependencies,
        previous_run_status: parsed.previous_run_status,
        owner_authorization: parsed.owner_authorization,
    })
}

fn planning_complete(root: &Path, change: &str) -> bool {
    let base = root.join("openspec/changes").join(change);
    base.join("proposal.md").is_file()
        && base.join("design.md").is_file()
        && base.join("tasks.md").is_file()
        && fs::read_dir(base.join("specs"))
            .map(|mut entries| entries.next().is_some())
            .unwrap_or(false)
}

#[tauri::command]
fn read_repository_identity() -> Result<RepositoryIdentity, ControlLoopError> {
    identity_at(Path::new(CANONICAL_PATH), false)
}

#[tauri::command]
fn check_remote_authority() -> RemoteAuthority {
    authority_at(Path::new(CANONICAL_PATH), false)
}

#[tauri::command]
fn evaluate_workspace_sync(
    guards: ExecutionGuardSnapshot,
) -> Result<WorkspaceSyncEvaluation, ControlLoopError> {
    let identity = identity_at(Path::new(CANONICAL_PATH), false)?;
    Ok(evaluate(
        &identity,
        &authority_at(Path::new(CANONICAL_PATH), false),
        &guards,
    ))
}

#[tauri::command]
fn sync_workspace(
    guards: ExecutionGuardSnapshot,
    confirmed: bool,
) -> Result<WorkspaceSyncResult, ControlLoopError> {
    if !confirmed {
        return Err(ControlLoopError {
            code: "OWNER_CONFIRMATION_REQUIRED".into(),
            message: "explicit Owner confirmation is required".into(),
        });
    }
    let root = validate_root(Path::new(CANONICAL_PATH), false)?;
    let identity = identity_at(&root, false)?;
    let authority = authority_at(&root, false);
    let plan = evaluate(&identity, &authority, &guards);
    if !plan.allowed {
        return Err(ControlLoopError {
            code: "SYNC_BLOCKED".into(),
            message: format!("sync blocked: {:?}", plan.blockers),
        });
    }
    run_git(&root, &["fetch", "origin", "main"])?;
    let refreshed_authority = authority_at(&root, false);
    if refreshed_authority.status != AuthorityStatus::Verified
        || refreshed_authority.remote_main_sha.is_none()
    {
        return Err(ControlLoopError {
            code: "REMOTE_INVALID_RESPONSE".into(),
            message: "remote authority changed or became unavailable after fetch".into(),
        });
    }
    run_git(&root, &["switch", "main"])?;
    if let Err(error) = run_git(&root, &["merge", "--ff-only", "origin/main"]) {
        return Err(ControlLoopError {
            code: "NON_FAST_FORWARD".into(),
            message: safe_error(&error.message),
        });
    }
    Ok(WorkspaceSyncResult {
        success: true,
        actions: plan.planned_actions,
        error: None,
    })
}

#[tauri::command]
fn resolve_next_work_package(
    guards: ExecutionGuardSnapshot,
) -> Result<ResolverDecisionResult, ControlLoopError> {
    let root = validate_root(Path::new(CANONICAL_PATH), false)?;
    let identity = identity_at(&root, false)?;
    let authority = authority_at(&root, false);
    let mut blockers = Vec::new();
    if !identity.worktree_clean {
        blockers.push(ResolverBlocker::WorktreeDirty);
    }
    if guards.active_open_code_run {
        blockers.push(ResolverBlocker::ActiveRun);
    }
    if guards.writer_lock_held {
        blockers.push(ResolverBlocker::WriterLocked);
    }
    if guards.unsaved_diff {
        blockers.push(ResolverBlocker::UnsavedDiff);
    }
    if guards.previous_run_open {
        blockers.push(ResolverBlocker::PreviousRunOpen);
    }
    if authority.status == AuthorityStatus::RemoteUnavailable {
        blockers.push(ResolverBlocker::RemoteUnavailable);
    }
    if authority.status == AuthorityStatus::Drift
        || authority.status == AuthorityStatus::RemoteInvalidResponse
    {
        blockers.push(ResolverBlocker::AuthorityDrift);
    }
    if authority.status == AuthorityStatus::RepositoryInvalid || !identity.repository_valid {
        blockers.push(ResolverBlocker::RepositoryInvalid);
    }
    if identity.local_main_sha != authority.remote_main_sha {
        blockers.push(ResolverBlocker::SyncRequired);
    }
    let dir = root.join("docs/60_Operations/work-packages");
    let mut candidates = Vec::new();
    let mut records = HashMap::new();
    for entry in fs::read_dir(dir).map_err(|_| ControlLoopError {
        code: "WORK_PACKAGE_SCHEMA_INVALID".into(),
        message: "work package directory unavailable".into(),
    })? {
        let entry = entry.map_err(|_| ControlLoopError {
            code: "WORK_PACKAGE_SCHEMA_INVALID".into(),
            message: "work package entry unavailable".into(),
        })?;
        if entry.path().extension().and_then(|v| v.to_str()) == Some("md") {
            match parse_package(&entry.path()) {
                Ok(package) => {
                    if package.status == "AUTHORIZED" {
                        candidates.push(package.clone());
                    }
                    records.insert(package.id.clone(), package);
                }
                Err(_) => blockers.push(ResolverBlocker::WorkPackageSchemaInvalid),
                _ => {}
            }
        }
    }
    if candidates.len() > 1 {
        blockers.push(ResolverBlocker::MultipleAuthorizedWorkPackages);
    }
    if candidates.is_empty() {
        blockers.push(ResolverBlocker::WorkPackageNotAuthorized);
    }
    let selected = if candidates.len() == 1 {
        candidates.into_iter().next()
    } else {
        None
    };
    if let Some(package) = &selected {
        if package.authority_sha != authority.remote_main_sha.clone().unwrap_or_default() {
            blockers.push(ResolverBlocker::AuthorityDrift);
        }
        if package.previous_run_status != "CLOSED" {
            blockers.push(ResolverBlocker::PreviousRunOpen);
        }
        if package.owner_authorization != "AUTHORIZED_FOR_IMPLEMENTATION" {
            blockers.push(ResolverBlocker::WorkPackageNotAuthorized);
        }
        for dependency in &package.dependencies {
            if records
                .get(&dependency.id)
                .map(|record| record.status.as_str() != "CLOSED")
                .unwrap_or(true)
            {
                blockers.push(ResolverBlocker::DependencyNotClosed);
            }
        }
        let change_root = root.join("openspec/changes").join(&package.openspec_change);
        if !change_root.is_dir() {
            blockers.push(ResolverBlocker::OpenspecChangeMissing);
        } else if !planning_complete(&root, &package.openspec_change) {
            blockers.push(ResolverBlocker::OpenspecPlanningIncomplete);
        }
    }
    Ok(ResolverDecisionResult {
        decision: if blockers.is_empty() {
            ResolverDecision::StartAllowed
        } else {
            ResolverDecision::Blocked
        },
        work_package: selected,
        blockers,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_repository_identity,
            check_remote_authority,
            evaluate_workspace_sync,
            sync_workspace,
            resolve_next_work_package
        ])
        .run(tauri::generate_context!())
        .expect("error while running AI Control Center");
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_AUTHORITY_SHA: &str = "dc6d20ec9fb9d33683ad43148d10a5cb5c667552";

    fn identity(clean: bool) -> RepositoryIdentity {
        RepositoryIdentity {
            canonical_path: CANONICAL_PATH.into(),
            repository_valid: true,
            origin_present: true,
            origin_display: Some("owner/repository".into()),
            current_branch: Some("main".into()),
            local_head: Some(TEST_AUTHORITY_SHA.into()),
            local_main_sha: Some(TEST_AUTHORITY_SHA.into()),
            worktree_clean: clean,
            worktree_entries: Vec::new(),
            detached_head: false,
            checked_at: "test".into(),
            diagnostics: Vec::new(),
        }
    }

    fn authority(status: AuthorityStatus) -> RemoteAuthority {
        RemoteAuthority {
            status,
            remote_main_sha: Some(TEST_AUTHORITY_SHA.into()),
            authority_sha: TEST_AUTHORITY_SHA.into(),
            checked_at: "test".into(),
            diagnostics: Vec::new(),
        }
    }

    #[test]
    fn clean_verified_workspace_requires_no_sync() {
        let result = evaluate(
            &identity(true),
            &authority(AuthorityStatus::Verified),
            &ExecutionGuardSnapshot::default(),
        );
        assert!(!result.allowed);
        assert_eq!(result.blockers, vec![SyncBlocker::SyncNotRequired]);
    }

    #[test]
    fn dirty_workspace_is_blocked() {
        let result = evaluate(
            &identity(false),
            &authority(AuthorityStatus::Verified),
            &ExecutionGuardSnapshot::default(),
        );
        assert!(result.blockers.contains(&SyncBlocker::WorktreeDirty));
        assert!(!result.allowed);
    }

    #[test]
    fn behind_workspace_requires_owner_sync() {
        let mut local = identity(true);
        local.local_main_sha = Some("0000000000000000000000000000000000000000".into());
        let result = evaluate(
            &local,
            &authority(AuthorityStatus::Verified),
            &ExecutionGuardSnapshot::default(),
        );
        assert!(result.allowed);
        assert_eq!(result.blockers, vec![SyncBlocker::SyncRequired]);
    }

    #[test]
    fn current_branch_does_not_block_planned_sync() {
        let mut local = identity(true);
        local.current_branch = Some("feature/test".into());
        local.local_main_sha = Some("0000000000000000000000000000000000000000".into());
        let result = evaluate(
            &local,
            &authority(AuthorityStatus::Verified),
            &ExecutionGuardSnapshot::default(),
        );
        assert!(result.allowed);
        assert!(!result.blockers.contains(&SyncBlocker::NonFastForward));
    }

    #[test]
    fn unavailable_remote_blocks_without_verified_state() {
        let result = evaluate(
            &identity(true),
            &authority(AuthorityStatus::RemoteUnavailable),
            &ExecutionGuardSnapshot::default(),
        );
        assert!(!result.allowed);
        assert!(result.blockers.contains(&SyncBlocker::RemoteUnavailable));
    }

    #[test]
    fn guards_are_blockers() {
        let result = evaluate(
            &identity(true),
            &authority(AuthorityStatus::Verified),
            &ExecutionGuardSnapshot {
                active_open_code_run: true,
                writer_lock_held: true,
                unsaved_diff: true,
                previous_run_open: true,
            },
        );
        assert!(result.blockers.contains(&SyncBlocker::ActiveRun));
        assert!(result.blockers.contains(&SyncBlocker::WriterLocked));
        assert!(result.blockers.contains(&SyncBlocker::UnsavedDiff));
        assert!(result.blockers.contains(&SyncBlocker::PreviousRunOpen));
    }

    #[test]
    fn remote_display_redacts_credentials() {
        assert_eq!(
            safe_remote_display("https://github.com/owner/repository.git"),
            Some("owner/repository".into())
        );
        assert_eq!(
            safe_remote_display("git@github.com:owner/repository.git"),
            Some("owner/repository".into())
        );
        assert_eq!(
            safe_remote_display("https://user:passcode@example.com/owner/repository.git"),
            None
        );
    }

    #[test]
    fn relative_and_prefixed_paths_fail_closed() {
        assert!(validate_root(Path::new("."), true).is_err());
        let similar_prefix = PathBuf::from(CANONICAL_PATH).with_file_name("AIcontrolcenter-other");
        assert!(validate_root(&similar_prefix, false).is_err());
    }
}
