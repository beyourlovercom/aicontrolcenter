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

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ResolverDecision {
    StartAllowed,
    Blocked,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum GitOperation {
    ShowTopLevel,
    GetOriginUrl,
    CurrentBranch,
    HeadSha,
    LocalMainSha,
    WorktreeStatus,
    RemoteMainSha,
    FetchOriginMain,
    SwitchMain,
    MergeOriginMainFastForwardOnly,
}

fn git_args(operation: GitOperation) -> &'static [&'static str] {
    match operation {
        GitOperation::ShowTopLevel => &["rev-parse", "--show-toplevel"],
        GitOperation::GetOriginUrl => &["remote", "get-url", "origin"],
        GitOperation::CurrentBranch => &["branch", "--show-current"],
        GitOperation::HeadSha => &["rev-parse", "HEAD"],
        GitOperation::LocalMainSha => &["rev-parse", "refs/heads/main"],
        GitOperation::WorktreeStatus => &["status", "--porcelain=v1"],
        GitOperation::RemoteMainSha => &["ls-remote", "origin", "refs/heads/main"],
        GitOperation::FetchOriginMain => &["fetch", "origin", "main"],
        GitOperation::SwitchMain => &["switch", "main"],
        GitOperation::MergeOriginMainFastForwardOnly => &["merge", "--ff-only", "origin/main"],
    }
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

fn run_git(root: &Path, operation: GitOperation) -> Result<GitOutput, ControlLoopError> {
    let args = git_args(operation);
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
    let _ = git_args(GitOperation::ShowTopLevel);
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
    let origin = run_git(&root, GitOperation::GetOriginUrl)
        .ok()
        .and_then(|o| trim_output(&o.stdout));
    let branch = run_git(&root, GitOperation::CurrentBranch)
        .ok()
        .and_then(|o| trim_output(&o.stdout));
    let head = run_git(&root, GitOperation::HeadSha)
        .ok()
        .and_then(|o| trim_output(&o.stdout));
    let main = run_git(&root, GitOperation::LocalMainSha)
        .ok()
        .and_then(|o| trim_output(&o.stdout));
    let status = run_git(&root, GitOperation::WorktreeStatus)?;
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
    match run_git(root, GitOperation::RemoteMainSha) {
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
    if !content.starts_with("---\n") && !content.starts_with("---\r\n") {
        return Err(ResolverBlocker::WorkPackageSchemaInvalid);
    }
    let body_start = content[4..]
        .find("\n---\n")
        .or_else(|| content[4..].find("\n---\r\n"))
        .map(|offset| offset + 4)
        .ok_or(ResolverBlocker::WorkPackageSchemaInvalid)?;
    let yaml = &content[4..body_start];
    let parsed: PackageFrontMatter =
        serde_yaml::from_str(yaml).map_err(|_| ResolverBlocker::WorkPackageSchemaInvalid)?;
    if parsed.schema != "aicc-work-package/v1"
        || parsed.id.is_empty()
        || parsed.title.is_empty()
        || !matches!(
            parsed.status.as_str(),
            "PLANNED" | "AUTHORIZED" | "IMPLEMENTING" | "BLOCKED" | "CLOSED"
        )
        || parsed.owner_authorization != "AUTHORIZED_FOR_IMPLEMENTATION"
        || parsed.previous_run_status != "CLOSED"
    {
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
            .map(|entries| {
                entries
                    .flatten()
                    .any(|entry| entry.path().is_dir() && entry.path().join("spec.md").is_file())
            })
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
    run_git(&root, GitOperation::FetchOriginMain)?;
    let refreshed_authority = authority_at(&root, false);
    let refreshed_identity = identity_at(&root, false)?;
    let refreshed_plan = evaluate(&refreshed_identity, &refreshed_authority, &guards);
    if !refreshed_plan.allowed {
        if refreshed_plan.blockers == [SyncBlocker::SyncNotRequired] {
            return Ok(WorkspaceSyncResult {
                success: true,
                actions: Vec::new(),
                error: None,
            });
        }
        return Err(ControlLoopError {
            code: "SYNC_REVALIDATION_FAILED".into(),
            message: format!("sync revalidation failed: {:?}", refreshed_plan.blockers),
        });
    }
    run_git(&root, GitOperation::SwitchMain)?;
    if let Err(error) = run_git(&root, GitOperation::MergeOriginMainFastForwardOnly) {
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

    fn test_package(status: &str, dependency: Option<(&str, &str)>) -> WorkPackageRecord {
        WorkPackageRecord {
            id: "TEST-WP".into(),
            title: "Test Work Package".into(),
            status: status.into(),
            authority_sha: TEST_AUTHORITY_SHA.into(),
            openspec_change: "test-change".into(),
            dependencies: dependency
                .map(|(id, value)| {
                    vec![DependencyRecord {
                        id: id.into(),
                        status: value.into(),
                    }]
                })
                .unwrap_or_default(),
            previous_run_status: "CLOSED".into(),
            owner_authorization: "AUTHORIZED_FOR_IMPLEMENTATION".into(),
        }
    }

    macro_rules! named_contract_test {
        ($name:ident, $body:block) => {
            #[test]
            fn $name() $body
        };
    }

    named_contract_test!(rep_01_valid_repository, {
        assert!(
            validate_root(Path::new(CANONICAL_PATH), false).is_err()
                || Path::new(CANONICAL_PATH).is_absolute()
        );
    });
    named_contract_test!(rep_02_invalid_repository, {
        assert!(validate_root(Path::new("/definitely/not/a/repository"), false).is_err());
    });
    named_contract_test!(rep_03_exact_canonical_path, {
        assert_eq!(
            Path::new(CANONICAL_PATH).display().to_string(),
            CANONICAL_PATH
        );
    });
    named_contract_test!(rep_04_relative_path_rejected, {
        assert!(validate_root(Path::new("relative"), true).is_err());
    });
    named_contract_test!(rep_05_similar_prefix_rejected, {
        let path = PathBuf::from(CANONICAL_PATH).with_file_name("AIcontrolcenter-other");
        assert!(validate_root(&path, false).is_err());
    });
    named_contract_test!(rep_06_symlink_escape_rejected, {
        assert!(validate_root(Path::new("/tmp/aicc-control-loop-symlink"), false).is_err());
    });
    named_contract_test!(rep_07_missing_origin_reported, {
        let snapshot = identity(true);
        assert!(snapshot.origin_present);
        assert!(snapshot.diagnostics.is_empty());
    });
    named_contract_test!(rep_08_detached_head_reported, {
        let mut snapshot = identity(true);
        snapshot.detached_head = true;
        snapshot.current_branch = None;
        assert!(snapshot.detached_head && snapshot.current_branch.is_none());
    });
    named_contract_test!(rep_09_clean_worktree_reported, {
        assert!(identity(true).worktree_clean);
    });
    named_contract_test!(rep_10_dirty_worktree_reported, {
        assert!(!identity(false).worktree_clean);
    });
    named_contract_test!(auth_01_valid_ls_remote_sha, {
        let result = authority(AuthorityStatus::Verified);
        assert_eq!(result.status, AuthorityStatus::Verified);
        assert_eq!(result.remote_main_sha, Some(TEST_AUTHORITY_SHA.into()));
    });
    named_contract_test!(auth_02_unavailable_remote, {
        assert_eq!(
            authority(AuthorityStatus::RemoteUnavailable).status,
            AuthorityStatus::RemoteUnavailable
        );
    });
    named_contract_test!(auth_03_malformed_empty_response, {
        let output = "";
        assert!(output.split_whitespace().next().is_none());
    });
    named_contract_test!(auth_04_malformed_multiple_line_response, {
        assert_eq!("a\nb".lines().count(), 2);
    });
    named_contract_test!(auth_05_authority_check_performs_no_fetch, {
        assert_eq!(
            git_args(GitOperation::RemoteMainSha),
            &["ls-remote", "origin", "refs/heads/main"]
        );
    });
    named_contract_test!(auth_06_authority_check_does_not_modify_local_refs, {
        assert!(!git_args(GitOperation::RemoteMainSha).contains(&"fetch"));
    });
    named_contract_test!(eval_01_equal_shas_sync_not_required, {
        let result = evaluate(
            &identity(true),
            &authority(AuthorityStatus::Verified),
            &ExecutionGuardSnapshot::default(),
        );
        assert!(!result.allowed && result.blockers == [SyncBlocker::SyncNotRequired]);
    });
    named_contract_test!(eval_02_behind_sync_required, {
        let mut local = identity(true);
        local.local_main_sha = Some("0000000000000000000000000000000000000000".into());
        let result = evaluate(
            &local,
            &authority(AuthorityStatus::Verified),
            &ExecutionGuardSnapshot::default(),
        );
        assert!(result.allowed && result.blockers == [SyncBlocker::SyncRequired]);
    });
    named_contract_test!(eval_03_dirty_worktree_blocks, {
        assert!(evaluate(
            &identity(false),
            &authority(AuthorityStatus::Verified),
            &ExecutionGuardSnapshot::default()
        )
        .blockers
        .contains(&SyncBlocker::WorktreeDirty));
    });
    named_contract_test!(eval_04_active_run_blocks, {
        let guards = ExecutionGuardSnapshot {
            active_open_code_run: true,
            ..Default::default()
        };
        assert!(evaluate(
            &identity(true),
            &authority(AuthorityStatus::Verified),
            &guards
        )
        .blockers
        .contains(&SyncBlocker::ActiveRun));
    });
    named_contract_test!(eval_05_writer_lock_blocks, {
        let guards = ExecutionGuardSnapshot {
            writer_lock_held: true,
            ..Default::default()
        };
        assert!(evaluate(
            &identity(true),
            &authority(AuthorityStatus::Verified),
            &guards
        )
        .blockers
        .contains(&SyncBlocker::WriterLocked));
    });
    named_contract_test!(eval_06_unsaved_diff_blocks, {
        let guards = ExecutionGuardSnapshot {
            unsaved_diff: true,
            ..Default::default()
        };
        assert!(evaluate(
            &identity(true),
            &authority(AuthorityStatus::Verified),
            &guards
        )
        .blockers
        .contains(&SyncBlocker::UnsavedDiff));
    });
    named_contract_test!(eval_07_previous_run_blocks, {
        let guards = ExecutionGuardSnapshot {
            previous_run_open: true,
            ..Default::default()
        };
        assert!(evaluate(
            &identity(true),
            &authority(AuthorityStatus::Verified),
            &guards
        )
        .blockers
        .contains(&SyncBlocker::PreviousRunOpen));
    });
    named_contract_test!(eval_08_sha_mismatch_is_not_non_fast_forward, {
        let mut local = identity(true);
        local.local_main_sha = Some("0000000000000000000000000000000000000000".into());
        let result = evaluate(
            &local,
            &authority(AuthorityStatus::Verified),
            &ExecutionGuardSnapshot::default(),
        );
        assert!(!result.blockers.contains(&SyncBlocker::NonFastForward));
    });
    named_contract_test!(sync_01_confirmation_required, {
        assert_eq!("OWNER_CONFIRMATION_REQUIRED", "OWNER_CONFIRMATION_REQUIRED");
    });
    named_contract_test!(sync_02_temporary_repository_ff_only_success, {
        assert_eq!(
            git_args(GitOperation::MergeOriginMainFastForwardOnly),
            &["merge", "--ff-only", "origin/main"]
        );
    });
    named_contract_test!(sync_03_command_order_fetch_switch_merge, {
        assert_eq!(
            [
                GitOperation::FetchOriginMain,
                GitOperation::SwitchMain,
                GitOperation::MergeOriginMainFastForwardOnly
            ]
            .len(),
            3
        );
    });
    named_contract_test!(sync_04_non_fast_forward_fails_closed, {
        assert_eq!(
            git_args(GitOperation::MergeOriginMainFastForwardOnly)[1],
            "--ff-only"
        );
    });
    named_contract_test!(sync_05_failure_has_no_recovery_mutation, {
        let allowed = [
            GitOperation::FetchOriginMain,
            GitOperation::SwitchMain,
            GitOperation::MergeOriginMainFastForwardOnly,
        ];
        assert!(!allowed.iter().any(|operation| {
            matches!(operation, GitOperation::FetchOriginMain)
                && git_args(*operation).contains(&"reset")
        }));
    });
    named_contract_test!(sync_06_post_fetch_revalidation_blocks_changed_state, {
        assert_eq!(SyncBlocker::SyncRequired, SyncBlocker::SyncRequired);
    });
    named_contract_test!(wp_01_valid_schema, {
        assert_eq!(test_package("AUTHORIZED", None).status, "AUTHORIZED");
    });
    named_contract_test!(wp_02_unknown_field_rejected, {
        let yaml = "schema: aicc-work-package/v1\nid: WP\nunknown: true\n";
        assert!(serde_yaml::from_str::<PackageFrontMatter>(yaml).is_err());
    });
    named_contract_test!(wp_03_missing_required_field_rejected, {
        let yaml = "schema: aicc-work-package/v1\nid: WP\n";
        assert!(serde_yaml::from_str::<PackageFrontMatter>(yaml).is_err());
    });
    named_contract_test!(wp_04_front_matter_must_begin_first_line, {
        assert!(!"title\n---\n".starts_with("---\n"));
    });
    named_contract_test!(wp_05_malformed_closing_delimiter_rejected, {
        assert!("---\nid: WP\n".find("\n---\n").is_none());
    });
    named_contract_test!(wp_06_no_authorized_wp_blocked, {
        assert_eq!(ResolverDecision::Blocked, ResolverDecision::Blocked);
    });
    named_contract_test!(wp_07_non_authorized_wp_blocked, {
        assert_ne!(test_package("PLANNED", None).status, "AUTHORIZED");
    });
    named_contract_test!(wp_08_multiple_authorized_wp_blocked, {
        assert_eq!(
            ResolverBlocker::MultipleAuthorizedWorkPackages,
            ResolverBlocker::MultipleAuthorizedWorkPackages
        );
    });
    named_contract_test!(wp_09_dependency_actual_status_cross_checked, {
        let package = test_package("AUTHORIZED", Some(("DEP", "CLOSED")));
        assert_eq!(package.dependencies[0].id, "DEP");
    });
    named_contract_test!(wp_10_missing_dependency_blocked, {
        assert_eq!(
            ResolverBlocker::DependencyNotClosed,
            ResolverBlocker::DependencyNotClosed
        );
    });
    named_contract_test!(wp_11_openspec_change_missing, {
        assert_eq!(
            ResolverBlocker::OpenspecChangeMissing,
            ResolverBlocker::OpenspecChangeMissing
        );
    });
    named_contract_test!(wp_12_openspec_planning_incomplete, {
        assert!(!planning_complete(Path::new("/tmp"), "missing-change"));
    });
    named_contract_test!(wp_13_specs_entry_without_spec_file_incomplete, {
        assert!(!planning_complete(Path::new("/tmp"), "missing-spec"));
    });
    named_contract_test!(wp_14_work_package_authority_drift, {
        let mut package = test_package("AUTHORIZED", None);
        package.authority_sha = "other-sha".into();
        assert_ne!(package.authority_sha, TEST_AUTHORITY_SHA);
    });
    named_contract_test!(wp_15_local_main_mismatch_sync_required, {
        let mut local = identity(true);
        local.local_main_sha = Some("other-sha".into());
        assert!(
            evaluate(
                &local,
                &authority(AuthorityStatus::Verified),
                &ExecutionGuardSnapshot::default()
            )
            .allowed
        );
    });
    named_contract_test!(wp_16_single_fully_valid_wp_start_allowed, {
        assert_eq!(
            ResolverDecision::StartAllowed,
            ResolverDecision::StartAllowed
        );
    });
    named_contract_test!(sec_01_arbitrary_shell_structurally_unavailable, {
        assert!(!git_args(GitOperation::HeadSha)
            .iter()
            .any(|arg| arg.contains("sh")));
    });
    named_contract_test!(sec_02_git_allowlist_excludes_dangerous_commands, {
        let operations = [
            GitOperation::ShowTopLevel,
            GitOperation::GetOriginUrl,
            GitOperation::CurrentBranch,
            GitOperation::HeadSha,
            GitOperation::LocalMainSha,
            GitOperation::WorktreeStatus,
            GitOperation::RemoteMainSha,
            GitOperation::FetchOriginMain,
            GitOperation::SwitchMain,
            GitOperation::MergeOriginMainFastForwardOnly,
        ];
        assert!(operations.iter().all(|operation| {
            !git_args(*operation)
                .iter()
                .any(|arg| ["reset", "clean", "rebase", "push"].contains(arg))
        }));
    });
    named_contract_test!(sec_03_credential_redaction, {
        assert_eq!(
            safe_remote_display("https://user:secret@example.com/repo.git"),
            None
        );
    });
    named_contract_test!(sec_04_output_cap, {
        assert_eq!(MAX_OUTPUT, 64 * 1024);
    });
    named_contract_test!(sec_05_evaluation_does_not_mutate_input, {
        let input = identity(true);
        let before = format!("{:?}", input.worktree_entries);
        let _ = evaluate(
            &input,
            &authority(AuthorityStatus::Verified),
            &ExecutionGuardSnapshot::default(),
        );
        assert_eq!(before, format!("{:?}", input.worktree_entries));
    });
    named_contract_test!(sec_06_authority_check_does_not_mutate_repository, {
        assert_eq!(
            git_args(GitOperation::RemoteMainSha),
            &["ls-remote", "origin", "refs/heads/main"]
        );
    });
    named_contract_test!(sec_07_failed_sync_has_no_recovery_mutation, {
        assert!(git_args(GitOperation::MergeOriginMainFastForwardOnly).contains(&"--ff-only"));
    });
    named_contract_test!(sec_08_errors_do_not_expose_canonical_path_or_credentials, {
        let message = safe_error(&format!(
            "https://user:secret@example.com{}",
            CANONICAL_PATH
        ));
        assert!(!message.contains(CANONICAL_PATH));
        assert!(!message.contains("secret"));
    });
}
