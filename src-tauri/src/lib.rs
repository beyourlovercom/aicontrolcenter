use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use tauri::Manager;

pub const CANONICAL_PATH: &str = "/Users/a/AI/007/AIcontrolcenter";
const MAX_OUTPUT: usize = 64 * 1024;
const COMMAND_TIMEOUT: Duration = Duration::from_secs(20);
const APP_SERVER_START_TIMEOUT: Duration = Duration::from_secs(20);

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
#[derive(Debug, Deserialize, Serialize, Clone, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionGuardSnapshot {
    pub active_codex_run: bool,
    pub writer_lock_held: bool,
    pub unsaved_diff: bool,
    pub previous_run_open: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OwnerAuthorizationRecord {
    pub work_package_id: String,
    pub authority_sha: String,
    pub branch: String,
    pub worktree: String,
    #[serde(deserialize_with = "deserialize_string_or_vec")]
    pub scope: Vec<String>,
    pub allowed_capabilities: Vec<String>,
    pub forbidden_capabilities: Vec<String>,
    pub authorized_at: String,
}

fn deserialize_string_or_vec<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrVec {
        String(String),
        Vec(Vec<String>),
    }

    Ok(match StringOrVec::deserialize(deserializer)? {
        StringOrVec::String(value) => vec![value],
        StringOrVec::Vec(values) => values,
    })
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OwnerAuthorizationEvidence {
    pub status: String,
    pub valid: bool,
    pub blocker: Option<String>,
    pub record: Option<OwnerAuthorizationRecord>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CodexRuntimePhase {
    Idle,
    WaitingOwnerAuthorization,
    Starting,
    Running,
    Testing,
    Reviewing,
    PrOpen,
    CiRunning,
    Merging,
    BuildingUat,
    ReadyForHumanUat,
    Blocked,
    Failed,
    Paused,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CodexControlAction {
    Start,
    Pause,
    Resume,
    StopAfterCurrentStep,
    Retry,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CodexRuntimeObserver {
    pub engine: String,
    pub profile: String,
    #[serde(default)]
    pub process_id: Option<u32>,
    #[serde(default)]
    pub process_state: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub thread_id: Option<String>,
    #[serde(default)]
    pub turn_id: Option<String>,
    pub active_work_package: Option<String>,
    pub session_state: CodexRuntimePhase,
    pub branch: Option<String>,
    pub worktree: Option<String>,
    pub current_phase: CodexRuntimePhase,
    pub last_activity: Option<String>,
    #[serde(default)]
    pub current_event: Option<String>,
    pub current_task: Option<String>,
    pub test_state: String,
    pub review_state: String,
    pub pull_request: Option<String>,
    pub ci_state: String,
    pub blocker: Option<String>,
    #[serde(default)]
    pub failure: Option<String>,
    #[serde(default)]
    pub exit_status: Option<String>,
    #[serde(default)]
    pub active_run: bool,
    #[serde(default)]
    pub writer_lock_held: bool,
    pub next_action: String,
    pub stop_after_current_step: bool,
    #[serde(default = "supported_codex_controls")]
    pub supported_controls: Vec<CodexControlAction>,
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
    pub state: SyncState,
}
#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SyncState {
    UpToDate,
    SyncRequired,
    Blocked,
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
    AuthorizationContractMissing,
    AuthorizationContractInvalid,
    MultipleAuthorizedWorkPackages,
}
#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct DependencyRecord {
    pub id: String,
    pub status: String,
}
#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
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
    pub authorization_scope: Option<Vec<String>>,
    pub allowed_capabilities: Option<Vec<String>>,
    pub forbidden_capabilities: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoadmapEntry {
    pub id: String,
    pub title: String,
    pub status: String,
    pub authorization: String,
    pub milestone: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoadmapMilestone {
    pub id: String,
    pub title: String,
    pub work_packages: Vec<String>,
    pub future_items: Vec<String>,
    pub progress_percent: u8,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoadmapEvidence {
    pub project: String,
    pub current_milestone: String,
    pub authority_sha: String,
    pub current_work_package: String,
    pub closed_work_packages: Vec<String>,
    pub next_work_packages: Vec<String>,
    pub progress_percent: u8,
    pub milestones: Vec<RoadmapMilestone>,
    pub entries: Vec<RoadmapEntry>,
}
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResolverDecisionResult {
    pub decision: ResolverDecision,
    pub work_package: Option<WorkPackageRecord>,
    pub blockers: Vec<ResolverBlocker>,
}
#[derive(Debug, Serialize, Clone)]
pub struct ControlLoopError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GitOperation {
    ShowTopLevel,
    GetOriginUrl,
    CurrentBranch,
    HeadSha,
    LocalMainSha,
    WorktreeStatus,
    RemoteMainSha,
    FetchedOriginMainSha,
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
        GitOperation::FetchedOriginMainSha => &["rev-parse", "refs/remotes/origin/main"],
        GitOperation::FetchOriginMain => &["fetch", "origin", "main"],
        GitOperation::SwitchMain => &["switch", "main"],
        GitOperation::MergeOriginMainFastForwardOnly => &["merge", "--ff-only", "origin/main"],
    }
}

#[derive(Debug, Clone)]
pub struct GitOutput {
    pub stdout: String,
    pub stderr: String,
}
pub trait GitRunner {
    fn run(&self, root: &Path, operation: GitOperation) -> Result<GitOutput, ControlLoopError>;
}
pub struct ProductionGitRunner;
impl GitRunner for ProductionGitRunner {
    fn run(&self, root: &Path, operation: GitOperation) -> Result<GitOutput, ControlLoopError> {
        let mut child = Command::new("git")
            .args(git_args(operation))
            .current_dir(root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| err("GIT_EXECUTION_FAILED", &e.to_string()))?;
        let mut stdout = child.stdout.take().expect("stdout");
        let mut stderr = child.stderr.take().expect("stderr");
        let out = thread::spawn(move || {
            let mut b = Vec::new();
            let _ = stdout.read_to_end(&mut b);
            b
        });
        let error = thread::spawn(move || {
            let mut b = Vec::new();
            let _ = stderr.read_to_end(&mut b);
            b
        });
        let start = Instant::now();
        loop {
            if let Some(status) = child
                .try_wait()
                .map_err(|e| err("GIT_WAIT_FAILED", &e.to_string()))?
            {
                let o = out.join().unwrap_or_default();
                let e = error.join().unwrap_or_default();
                let stdout = String::from_utf8_lossy(&o[..o.len().min(MAX_OUTPUT)]).to_string();
                let stderr = String::from_utf8_lossy(&e[..e.len().min(MAX_OUTPUT)]).to_string();
                if !status.success() {
                    return Err(err("GIT_COMMAND_FAILED", &format!("{status} {stderr}")));
                }
                return Ok(GitOutput { stdout, stderr });
            }
            if start.elapsed() > COMMAND_TIMEOUT {
                let _ = child.kill();
                return Err(err("GIT_TIMEOUT", "git command timed out"));
            }
            thread::sleep(Duration::from_millis(20));
        }
    }
}
pub trait GuardProvider {
    fn snapshot(&self) -> ExecutionGuardSnapshot;
}
#[derive(Clone, Default)]
pub struct ManagedCodexRuntime {
    inner: Arc<Mutex<CodexRuntimeManager>>,
}

impl ManagedCodexRuntime {
    fn snapshot(&self) -> ExecutionGuardSnapshot {
        self.inner
            .lock()
            .map(|mut runtime| runtime.guard_snapshot())
            .unwrap_or(ExecutionGuardSnapshot {
                active_codex_run: true,
                writer_lock_held: true,
                unsaved_diff: false,
                previous_run_open: true,
            })
    }
}

#[derive(Clone, Default)]
pub struct LocalControlState {
    runtime: ManagedCodexRuntime,
}
impl GuardProvider for LocalControlState {
    fn snapshot(&self) -> ExecutionGuardSnapshot {
        self.runtime.snapshot()
    }
}
fn err(code: &str, message: &str) -> ControlLoopError {
    ControlLoopError {
        code: code.into(),
        message: redact(message),
    }
}
fn redact(message: &str) -> String {
    let mut s = message.to_string();
    if let Some(at) = s.find('@') {
        if s[..at].contains("://") {
            s = s[at + 1..].into();
        }
    }
    s.replace(CANONICAL_PATH, "<canonical-repository>")
}
fn timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|v| v.as_secs().to_string())
        .unwrap_or_else(|_| "0".into())
}
fn first_line(value: &str) -> Option<String> {
    value
        .lines()
        .next()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToOwned::to_owned)
}
fn safe_remote(remote: &str) -> Option<String> {
    if remote.contains('@') && !remote.starts_with("git@") {
        return None;
    }
    let clean = remote.trim_end_matches('/');
    let parts: Vec<_> = clean.split('/').collect();
    let name = parts.last()?.trim_end_matches(".git");
    let owner = if remote.starts_with("git@") {
        remote.split(':').nth(1)?.split('/').next()?
    } else {
        parts.get(parts.len().checked_sub(2)?)?
    };
    if owner.is_empty() || name.is_empty() {
        None
    } else {
        Some(format!("{owner}/{name}"))
    }
}

fn validate_root<R: GitRunner>(
    runner: &R,
    path: &Path,
    production: bool,
) -> Result<PathBuf, ControlLoopError> {
    if !path.is_absolute() {
        return Err(err(
            "REPOSITORY_INVALID",
            "repository path must be absolute",
        ));
    }
    let input = fs::canonicalize(path)
        .map_err(|_| err("REPOSITORY_INVALID", "repository path does not exist"))?;
    if production && input != Path::new(CANONICAL_PATH) {
        return Err(err(
            "REPOSITORY_INVALID",
            "repository path is not canonical",
        ));
    }
    if !input.join(".git").is_dir() && !input.join(".git").is_file() {
        return Err(err(
            "REPOSITORY_INVALID",
            "repository has no valid git metadata",
        ));
    }
    let shown = first_line(&runner.run(&input, GitOperation::ShowTopLevel)?.stdout)
        .ok_or_else(|| err("REPOSITORY_INVALID", "git root output is empty"))?;
    let shown = fs::canonicalize(shown)
        .map_err(|_| err("REPOSITORY_INVALID", "git root output is invalid"))?;
    if shown != input {
        return Err(err(
            "REPOSITORY_INVALID",
            "git root does not match requested root",
        ));
    }
    Ok(input)
}
fn identity<R: GitRunner>(
    runner: &R,
    path: &Path,
    production: bool,
) -> Result<RepositoryIdentity, ControlLoopError> {
    let root = validate_root(runner, path, production)?;
    let origin = runner
        .run(&root, GitOperation::GetOriginUrl)
        .ok()
        .and_then(|v| first_line(&v.stdout));
    let branch = runner
        .run(&root, GitOperation::CurrentBranch)
        .ok()
        .and_then(|v| first_line(&v.stdout));
    let head = runner
        .run(&root, GitOperation::HeadSha)
        .ok()
        .and_then(|v| first_line(&v.stdout));
    let main = runner
        .run(&root, GitOperation::LocalMainSha)
        .ok()
        .and_then(|v| first_line(&v.stdout));
    let status = runner.run(&root, GitOperation::WorktreeStatus)?;
    let entries = status
        .stdout
        .lines()
        .map(str::to_owned)
        .collect::<Vec<String>>();
    Ok(RepositoryIdentity {
        canonical_path: root.display().to_string(),
        repository_valid: true,
        origin_present: origin.is_some(),
        origin_display: origin.as_deref().and_then(safe_remote),
        current_branch: branch.clone(),
        local_head: head,
        local_main_sha: main,
        worktree_clean: entries.is_empty(),
        worktree_entries: entries,
        detached_head: branch.is_none(),
        checked_at: timestamp(),
        diagnostics: if origin.is_some() {
            vec![]
        } else {
            vec!["origin remote is missing".into()]
        },
    })
}
fn authority<R: GitRunner>(runner: &R, root: &Path, production: bool) -> RemoteAuthority {
    let checked_at = timestamp();
    if validate_root(runner, root, production).is_err() {
        return RemoteAuthority {
            status: AuthorityStatus::RepositoryInvalid,
            remote_main_sha: None,
            authority_sha: String::new(),
            checked_at,
            diagnostics: vec!["repository validation failed".into()],
        };
    }
    match runner.run(root, GitOperation::RemoteMainSha) {
        Ok(output) => {
            let lines: Vec<_> = output.stdout.lines().collect();
            let fields: Vec<_> = lines.first().unwrap_or(&"").split_whitespace().collect();
            if lines.len() != 1
                || fields.len() != 2
                || fields[1] != "refs/heads/main"
                || fields[0].len() != 40
                || !fields[0].chars().all(|c| c.is_ascii_hexdigit())
            {
                return RemoteAuthority {
                    status: AuthorityStatus::RemoteInvalidResponse,
                    remote_main_sha: None,
                    authority_sha: String::new(),
                    checked_at,
                    diagnostics: vec!["malformed ls-remote response".into()],
                };
            }
            let sha = fields[0].to_ascii_lowercase();
            RemoteAuthority {
                status: AuthorityStatus::Verified,
                remote_main_sha: Some(sha.clone()),
                authority_sha: sha,
                checked_at,
                diagnostics: vec![],
            }
        }
        Err(e) => RemoteAuthority {
            status: AuthorityStatus::RemoteUnavailable,
            remote_main_sha: None,
            authority_sha: String::new(),
            checked_at,
            diagnostics: vec![redact(&e.message)],
        },
    }
}
fn evaluate(
    identity: &RepositoryIdentity,
    authority: &RemoteAuthority,
    guards: &ExecutionGuardSnapshot,
) -> WorkspaceSyncEvaluation {
    let mut blockers = vec![];
    if !identity.repository_valid || authority.status == AuthorityStatus::RepositoryInvalid {
        blockers.push(SyncBlocker::RepositoryInvalid);
    }
    if matches!(
        authority.status,
        AuthorityStatus::RemoteUnavailable | AuthorityStatus::RemoteInvalidResponse
    ) {
        blockers.push(SyncBlocker::RemoteUnavailable);
    }
    if !identity.worktree_clean {
        blockers.push(SyncBlocker::WorktreeDirty);
    }
    if guards.active_codex_run {
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
    if blockers.is_empty() {
        if identity.local_main_sha == authority.remote_main_sha {
            blockers.push(SyncBlocker::SyncNotRequired);
        } else {
            blockers.push(SyncBlocker::SyncRequired);
        }
    }
    let state = if blockers.iter().any(|blocker| {
        *blocker == SyncBlocker::WorktreeDirty
            || *blocker == SyncBlocker::ActiveRun
            || *blocker == SyncBlocker::WriterLocked
            || *blocker == SyncBlocker::UnsavedDiff
            || *blocker == SyncBlocker::PreviousRunOpen
            || *blocker == SyncBlocker::RemoteUnavailable
            || *blocker == SyncBlocker::RepositoryInvalid
    }) {
        SyncState::Blocked
    } else if identity.local_main_sha == authority.remote_main_sha {
        SyncState::UpToDate
    } else {
        SyncState::SyncRequired
    };
    WorkspaceSyncEvaluation {
        allowed: blockers == [SyncBlocker::SyncRequired],
        blockers,
        state,
        planned_actions: vec![
            "git fetch origin main".into(),
            "git switch main".into(),
            "git merge --ff-only origin/main".into(),
        ],
    }
}

pub struct ControlLoopService<R: GitRunner, G: GuardProvider> {
    pub runner: R,
    pub guards: G,
    pub root_path: PathBuf,
    pub production: bool,
}
impl<R: GitRunner, G: GuardProvider> ControlLoopService<R, G> {
    fn root(&self) -> Result<PathBuf, ControlLoopError> {
        validate_root(&self.runner, &self.root_path, self.production)
    }
    pub fn read_identity(&self) -> Result<RepositoryIdentity, ControlLoopError> {
        identity(&self.runner, &self.root_path, self.production)
    }
    pub fn check_authority(&self) -> Result<RemoteAuthority, ControlLoopError> {
        let root = self.root()?;
        Ok(authority(&self.runner, &root, self.production))
    }
    pub fn evaluate_sync(&self) -> Result<WorkspaceSyncEvaluation, ControlLoopError> {
        let root = self.root()?;
        let i = identity(&self.runner, &root, self.production)?;
        let a = authority(&self.runner, &root, self.production);
        Ok(evaluate(&i, &a, &self.guards.snapshot()))
    }
    pub fn sync(&self, confirmed: bool) -> Result<WorkspaceSyncResult, ControlLoopError> {
        if !confirmed {
            return Err(err(
                "OWNER_CONFIRMATION_REQUIRED",
                "Owner confirmation is required",
            ));
        }
        let root = self.root()?;
        let first_guard = self.guards.snapshot();
        let i = identity(&self.runner, &root, self.production)?;
        let a = authority(&self.runner, &root, self.production);
        if !evaluate(&i, &a, &first_guard).allowed {
            return Err(err("SYNC_BLOCKED", "initial sync evaluation blocked"));
        }
        self.runner.run(&root, GitOperation::FetchOriginMain)?;
        let second_guard = self.guards.snapshot();
        let i2 = identity(&self.runner, &root, self.production)?;
        let a2 = authority(&self.runner, &root, self.production);
        let fetched = first_line(
            &self
                .runner
                .run(&root, GitOperation::FetchedOriginMainSha)?
                .stdout,
        );
        if fetched != a2.remote_main_sha {
            return Err(err(
                "FETCHED_AUTHORITY_MISMATCH",
                "fetched origin/main does not match remote authority",
            ));
        }
        let plan = evaluate(&i2, &a2, &second_guard);
        if !plan.allowed {
            return Err(err(
                "SYNC_REVALIDATION_FAILED",
                "post-fetch sync evaluation blocked",
            ));
        }
        self.runner.run(&root, GitOperation::SwitchMain)?;
        if let Err(e) = self
            .runner
            .run(&root, GitOperation::MergeOriginMainFastForwardOnly)
        {
            return Err(err("NON_FAST_FORWARD", &e.message));
        }
        Ok(WorkspaceSyncResult {
            success: true,
            actions: plan.planned_actions,
            error: None,
        })
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
    #[serde(default)]
    authorization_scope: Option<Vec<String>>,
    #[serde(default)]
    allowed_capabilities: Option<Vec<String>>,
    #[serde(default)]
    forbidden_capabilities: Option<Vec<String>>,
}

struct FormalAuthorizationContract<'a> {
    scope: &'a [String],
    allowed_capabilities: &'a [String],
    forbidden_capabilities: &'a [String],
}

fn authorization_contract(
    package: &WorkPackageRecord,
) -> Result<FormalAuthorizationContract<'_>, ResolverBlocker> {
    let scope = package
        .authorization_scope
        .as_deref()
        .ok_or(ResolverBlocker::AuthorizationContractMissing)?;
    let allowed = package
        .allowed_capabilities
        .as_deref()
        .ok_or(ResolverBlocker::AuthorizationContractMissing)?;
    let forbidden = package
        .forbidden_capabilities
        .as_deref()
        .ok_or(ResolverBlocker::AuthorizationContractMissing)?;
    if scope.is_empty()
        || scope.iter().any(|value| value.trim().is_empty())
        || allowed.is_empty()
        || allowed.iter().any(|value| value.trim().is_empty())
        || forbidden.is_empty()
        || forbidden.iter().any(|value| value.trim().is_empty())
        || allowed.iter().any(|value| forbidden.contains(value))
    {
        return Err(ResolverBlocker::AuthorizationContractInvalid);
    }
    Ok(FormalAuthorizationContract {
        scope,
        allowed_capabilities: allowed,
        forbidden_capabilities: forbidden,
    })
}

fn authorization_contract_code(blocker: &ResolverBlocker) -> &'static str {
    match blocker {
        ResolverBlocker::AuthorizationContractMissing => "AUTHORIZATION_CONTRACT_MISSING",
        ResolverBlocker::AuthorizationContractInvalid => "AUTHORIZATION_CONTRACT_INVALID",
        _ => "AUTHORIZATION_CONTRACT_INVALID",
    }
}

fn malformed_authorization_contract_field(path: &Path) -> bool {
    let Ok(content) = fs::read_to_string(path) else {
        return false;
    };
    if !content.starts_with("---\n") && !content.starts_with("---\r\n") {
        return false;
    }
    let Some(close) = content[4..].find("\n---").map(|n| n + 4) else {
        return false;
    };
    let Ok(value) = serde_yaml::from_str::<serde_yaml::Value>(&content[4..close]) else {
        return false;
    };
    let Some(mapping) = value.as_mapping() else {
        return false;
    };
    [
        "authorization_scope",
        "allowed_capabilities",
        "forbidden_capabilities",
    ]
    .iter()
    .any(
        |field| match mapping.get(serde_yaml::Value::String((*field).to_string())) {
            None => false,
            Some(serde_yaml::Value::Sequence(values)) => {
                values.iter().any(|value| value.as_str().is_none())
            }
            Some(_) => true,
        },
    )
}

fn parse_package(path: &Path) -> Result<WorkPackageRecord, ResolverBlocker> {
    let content =
        fs::read_to_string(path).map_err(|_| ResolverBlocker::WorkPackageSchemaInvalid)?;
    if !content.starts_with("---\n") && !content.starts_with("---\r\n") {
        return Err(ResolverBlocker::WorkPackageSchemaInvalid);
    }
    let close = content[4..]
        .find("\n---")
        .map(|n| n + 4)
        .ok_or(ResolverBlocker::WorkPackageSchemaInvalid)?;
    let parsed: PackageFrontMatter = serde_yaml::from_str(&content[4..close])
        .map_err(|_| ResolverBlocker::WorkPackageSchemaInvalid)?;
    if !matches!(
        parsed.status.as_str(),
        "PLANNED" | "AUTHORIZED" | "IMPLEMENTING" | "BLOCKED" | "CLOSED"
    ) || !matches!(
        parsed.previous_run_status.as_str(),
        "PLANNED" | "AUTHORIZED" | "IMPLEMENTING" | "BLOCKED" | "CLOSED" | "HUMAN_UAT_FAIL"
    ) || !matches!(
        parsed.owner_authorization.as_str(),
        "AUTHORIZED_FOR_IMPLEMENTATION" | "NOT_AUTHORIZED"
    ) || parsed.schema != "aicc-work-package/v1"
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
        authorization_scope: parsed.authorization_scope,
        allowed_capabilities: parsed.allowed_capabilities,
        forbidden_capabilities: parsed.forbidden_capabilities,
    })
}

fn roadmap_line(content: &str, label: &str) -> String {
    content
        .lines()
        .find_map(|line| {
            line.strip_prefix(label)
                .map(str::trim)
                .map(|value| value.trim_matches('`').to_string())
        })
        .unwrap_or_else(|| "UNKNOWN".into())
}

fn parse_milestones(content: &str) -> Result<Vec<RoadmapMilestone>, ControlLoopError> {
    let mut lines = content.lines();
    if !lines.by_ref().any(|line| line.trim() == "## Milestones") {
        return Err(err(
            "ROADMAP_HIERARCHY_INVALID",
            "Milestones section is missing",
        ));
    }
    let mut milestones = Vec::new();
    let mut current: Option<RoadmapMilestone> = None;
    let mut reading: Option<bool> = None;
    for line in lines {
        let trimmed = line.trim();
        if trimmed.starts_with("## ") && trimmed != "## Milestones" {
            break;
        }
        if let Some(value) = trimmed.strip_prefix("### ") {
            if let Some(milestone) = current.take() {
                if milestone.work_packages.is_empty() && milestone.future_items.is_empty() {
                    return Err(err(
                        "ROADMAP_HIERARCHY_INVALID",
                        "milestone has no Work Packages",
                    ));
                }
                milestones.push(milestone);
            }
            let (id, title) = value
                .split_once(" — ")
                .ok_or_else(|| err("ROADMAP_HIERARCHY_INVALID", "milestone heading is invalid"))?;
            current = Some(RoadmapMilestone {
                id: id.trim().to_string(),
                title: title.trim().to_string(),
                work_packages: Vec::new(),
                future_items: Vec::new(),
                progress_percent: 0,
            });
            reading = None;
        } else if trimmed == "Work Packages:" || trimmed == "Formal Work Packages:" {
            if current.is_none() {
                return Err(err(
                    "ROADMAP_HIERARCHY_INVALID",
                    "Work Packages has no milestone",
                ));
            }
            reading = Some(true);
        } else if trimmed == "Future Work Packages:" {
            if current.is_none() {
                return Err(err(
                    "ROADMAP_HIERARCHY_INVALID",
                    "Future Work Packages has no milestone",
                ));
            }
            reading = Some(false);
        } else if reading.is_some() {
            if let Some(milestone) = current.as_mut() {
                let mut rest = trimmed;
                while let Some(start) = rest.find('`') {
                    let after_start = &rest[start + 1..];
                    let end = after_start.find('`').ok_or_else(|| {
                        err(
                            "ROADMAP_HIERARCHY_INVALID",
                            "Work Package identifier is unterminated",
                        )
                    })?;
                    let id = &after_start[..end];
                    let target = if reading == Some(true) {
                        &mut milestone.work_packages
                    } else {
                        &mut milestone.future_items
                    };
                    if id.is_empty() || target.iter().any(|item| item == id) {
                        return Err(err(
                            "ROADMAP_HIERARCHY_INVALID",
                            "duplicate or empty Work Package",
                        ));
                    }
                    target.push(id.to_string());
                    rest = &after_start[end + 1..];
                }
            }
        }
    }
    if let Some(milestone) = current {
        if milestone.work_packages.is_empty() && milestone.future_items.is_empty() {
            return Err(err(
                "ROADMAP_HIERARCHY_INVALID",
                "milestone has no Work Packages",
            ));
        }
        milestones.push(milestone);
    }
    if milestones.is_empty() {
        return Err(err("ROADMAP_HIERARCHY_INVALID", "no milestones found"));
    }
    Ok(milestones)
}

fn load_roadmap_evidence(root: &Path) -> Result<RoadmapEvidence, ControlLoopError> {
    let content = fs::read_to_string(root.join("docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md"))
        .map_err(|_| err("ROADMAP_UNAVAILABLE", "Living Roadmap is unavailable"))?;
    let current_work_package = roadmap_line(&content, "Current Work Package:");
    let current_milestone = content
        .lines()
        .skip_while(|line| !line.contains("## Current milestone"))
        .skip(1)
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.trim_matches('`').to_string())
        .unwrap_or_else(|| "UNKNOWN".into());
    let authority_sha = roadmap_line(&content, "Current Authority:");
    let closed_work_packages = roadmap_line(&content, "Closed Work Packages:")
        .split(',')
        .map(|value| value.trim().trim_matches('`').to_string())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    let next_work_packages = roadmap_line(&content, "Next Work Packages:")
        .split(',')
        .map(|value| value.trim().trim_matches('`').to_string())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    let project = "AI Control Center".to_string();
    let mut milestones = parse_milestones(&content)?;
    let packages_root = root.join("docs/60_Operations/work-packages");
    let mut entries = Vec::new();
    for entry in fs::read_dir(&packages_root).map_err(|_| {
        err(
            "WORK_PACKAGE_UNAVAILABLE",
            "Work Package evidence is unavailable",
        )
    })? {
        let path = entry
            .map_err(|_| {
                err(
                    "WORK_PACKAGE_UNAVAILABLE",
                    "Work Package entry is unavailable",
                )
            })?
            .path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("md") {
            continue;
        }
        if let Ok(package) = parse_package(&path) {
            let milestone = milestones
                .iter()
                .find(|group| group.work_packages.iter().any(|id| id == &package.id))
                .map(|group| group.id.clone())
                .unwrap_or_else(|| "UNASSIGNED".into());
            entries.push(RoadmapEntry {
                id: package.id,
                title: package.title,
                status: package.status,
                authorization: package.owner_authorization,
                milestone,
            });
        }
    }
    for milestone in &milestones {
        for work_package_id in &milestone.work_packages {
            let path = packages_root.join(format!("{work_package_id}.md"));
            let package = fs::read_to_string(&path).map_err(|_| {
                err(
                    "ROADMAP_HIERARCHY_INVALID",
                    "milestone references missing Work Package",
                )
            })?;
            parse_package(&path).map_err(|_| {
                err(
                    "ROADMAP_HIERARCHY_INVALID",
                    "milestone references malformed Work Package",
                )
            })?;
            if package.is_empty() {
                return Err(err(
                    "ROADMAP_HIERARCHY_INVALID",
                    "Work Package evidence is empty",
                ));
            }
        }
    }
    entries.sort_by(|left, right| left.id.cmp(&right.id));
    for milestone in &mut milestones {
        let items = entries
            .iter()
            .filter(|entry| entry.milestone == milestone.id)
            .collect::<Vec<_>>();
        let total = items.len().max(1);
        let closed = items
            .iter()
            .filter(|entry| entry.status == "CLOSED")
            .count();
        milestone.progress_percent = ((closed * 100) / total) as u8;
    }
    let total = entries.len().max(1);
    let closed = entries
        .iter()
        .filter(|entry| entry.status == "CLOSED")
        .count();
    Ok(RoadmapEvidence {
        project,
        current_milestone,
        authority_sha,
        current_work_package,
        closed_work_packages,
        next_work_packages,
        progress_percent: ((closed * 100) / total) as u8,
        milestones,
        entries,
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
                    .any(|e| e.path().is_dir() && e.path().join("spec.md").is_file())
            })
            .unwrap_or(false)
}
fn resolve<R: GitRunner>(
    runner: &R,
    root: &Path,
    production: bool,
    guards: &ExecutionGuardSnapshot,
) -> Result<ResolverDecisionResult, ControlLoopError> {
    let i = identity(runner, root, production)?;
    let a = authority(runner, root, production);
    let mut blockers = vec![];
    if !i.worktree_clean {
        blockers.push(ResolverBlocker::WorktreeDirty);
    }
    if i.local_main_sha != a.remote_main_sha {
        blockers.push(ResolverBlocker::SyncRequired);
    }
    if a.status == AuthorityStatus::RemoteUnavailable {
        blockers.push(ResolverBlocker::RemoteUnavailable);
    }
    if a.status == AuthorityStatus::Drift || a.status == AuthorityStatus::RemoteInvalidResponse {
        blockers.push(ResolverBlocker::AuthorityDrift);
    }
    if guards.active_codex_run {
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
    let mut records = HashMap::new();
    let mut candidates = vec![];
    let roadmap_path = root.join("docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md");
    let current_work_package = if roadmap_path.is_file() {
        Some(load_roadmap_evidence(root)?.current_work_package)
    } else {
        None
    };
    for entry in fs::read_dir(root.join("docs/60_Operations/work-packages")).map_err(|_| {
        err(
            "WORK_PACKAGE_SCHEMA_INVALID",
            "work package directory unavailable",
        )
    })? {
        let path = entry
            .map_err(|_| {
                err(
                    "WORK_PACKAGE_SCHEMA_INVALID",
                    "work package entry unavailable",
                )
            })?
            .path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            if let Ok(p) = parse_package(&path) {
                if p.status == "AUTHORIZED"
                    && current_work_package
                        .as_deref()
                        .map(|current| current == p.id)
                        .unwrap_or(true)
                {
                    candidates.push(p.clone());
                }
                records.insert(p.id.clone(), p);
            } else {
                blockers.push(ResolverBlocker::WorkPackageSchemaInvalid);
            }
        }
    }
    if candidates.len() > 1 {
        blockers.push(ResolverBlocker::MultipleAuthorizedWorkPackages);
    }
    if candidates.is_empty() {
        blockers.push(ResolverBlocker::WorkPackageNotAuthorized);
    }
    let selected = (candidates.len() == 1).then(|| candidates.remove(0));
    if let Some(p) = &selected {
        if p.authority_sha != a.remote_main_sha.clone().unwrap_or_default() {
            blockers.push(ResolverBlocker::AuthorityDrift);
        }
        for d in &p.dependencies {
            if records
                .get(&d.id)
                .map(|v| v.status != "CLOSED")
                .unwrap_or(true)
            {
                blockers.push(ResolverBlocker::DependencyNotClosed);
            }
        }
        let change = root.join("openspec/changes").join(&p.openspec_change);
        if !change.is_dir() {
            blockers.push(ResolverBlocker::OpenspecChangeMissing);
        } else if !planning_complete(root, &p.openspec_change) {
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

fn production_service(
    runtime: ManagedCodexRuntime,
) -> ControlLoopService<ProductionGitRunner, LocalControlState> {
    ControlLoopService {
        runner: ProductionGitRunner,
        guards: LocalControlState { runtime },
        root_path: PathBuf::from(CANONICAL_PATH),
        production: true,
    }
}

fn authorization_path(state_root: &Path) -> PathBuf {
    state_root.join("owner-authorization.json")
}

fn runtime_path(state_root: &Path) -> PathBuf {
    state_root.join("codex-runtime.json")
}

fn read_authorization_record(
    state_root: &Path,
) -> Result<Option<OwnerAuthorizationRecord>, ControlLoopError> {
    let path = authorization_path(state_root);
    if !path.is_file() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|_| {
        err(
            "AUTHORIZATION_UNAVAILABLE",
            "authorization evidence is unreadable",
        )
    })?;
    serde_json::from_str(&content).map(Some).map_err(|_| {
        err(
            "AUTHORIZATION_INVALID",
            "authorization evidence is malformed",
        )
    })
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), ControlLoopError> {
    let parent = path
        .parent()
        .ok_or_else(|| err("STATE_PATH_INVALID", "state path has no parent"))?;
    fs::create_dir_all(parent)
        .map_err(|_| err("STATE_WRITE_FAILED", "state directory cannot be created"))?;
    let content = serde_json::to_string_pretty(value)
        .map_err(|_| err("STATE_WRITE_FAILED", "state cannot be serialized"))?;
    fs::write(path, content).map_err(|_| err("STATE_WRITE_FAILED", "state cannot be persisted"))
}

fn authorization_evidence<R: GitRunner>(
    runner: &R,
    repository_root: &Path,
    state_root: &Path,
    production: bool,
) -> Result<OwnerAuthorizationEvidence, ControlLoopError> {
    let record = read_authorization_record(state_root)?;
    let Some(record) = record else {
        return Ok(OwnerAuthorizationEvidence {
            status: "NOT_AUTHORIZED".into(),
            valid: false,
            blocker: Some("OWNER_AUTHORIZATION_REQUIRED".into()),
            record: None,
        });
    };
    let repository = identity(runner, repository_root, production)?;
    let remote = authority(runner, repository_root, production);
    let package_path = repository_root
        .join("docs/60_Operations/work-packages")
        .join(format!("{}.md", record.work_package_id));
    let package = match parse_package(&package_path) {
        Ok(package) => package,
        Err(_) if malformed_authorization_contract_field(&package_path) => {
            return Ok(OwnerAuthorizationEvidence {
                status: "NOT_AUTHORIZED".into(),
                valid: false,
                blocker: Some("AUTHORIZATION_CONTRACT_INVALID".into()),
                record: Some(record),
            });
        }
        Err(_) => {
            return Err(err(
                "AUTHORIZATION_BINDING_INVALID",
                "bound Work Package evidence is invalid",
            ));
        }
    };
    let contract = authorization_contract(&package);
    let contract_drift = contract.as_ref().is_ok_and(|contract| {
        record.scope != contract.scope
            || record.allowed_capabilities != contract.allowed_capabilities
            || record.forbidden_capabilities != contract.forbidden_capabilities
    });
    let blocker = if package.status != "AUTHORIZED"
        || package.owner_authorization != "AUTHORIZED_FOR_IMPLEMENTATION"
    {
        Some("WORK_PACKAGE_NOT_AUTHORIZED")
    } else if package.id != record.work_package_id {
        Some("AUTHORIZATION_CONTRACT_DRIFT")
    } else if let Err(contract_blocker) = &contract {
        Some(authorization_contract_code(contract_blocker))
    } else if contract_drift {
        Some("AUTHORIZATION_CONTRACT_DRIFT")
    } else if remote.remote_main_sha.as_deref() != Some(record.authority_sha.as_str())
        || package.authority_sha != record.authority_sha
    {
        Some("AUTHORITY_DRIFT")
    } else if repository.current_branch.as_deref() != Some(record.branch.as_str()) {
        Some("BRANCH_MISMATCH")
    } else if repository.canonical_path != record.worktree {
        Some("WORKTREE_MISMATCH")
    } else {
        None
    };
    Ok(OwnerAuthorizationEvidence {
        status: if blocker.is_none() {
            "AUTHORIZED_FOR_IMPLEMENTATION".into()
        } else {
            "NOT_AUTHORIZED".into()
        },
        valid: blocker.is_none(),
        blocker: blocker.map(str::to_string),
        record: Some(record),
    })
}

fn start_allowed_authorization<R: GitRunner>(
    runner: &R,
    repository_root: &Path,
    state_root: &Path,
    production: bool,
    guards: &ExecutionGuardSnapshot,
) -> Result<OwnerAuthorizationEvidence, ControlLoopError> {
    let mut evidence = authorization_evidence(runner, repository_root, state_root, production)?;
    if !evidence.valid {
        return Ok(evidence);
    }
    let resolved = resolve(runner, repository_root, production, guards)?;
    let bound_id = evidence
        .record
        .as_ref()
        .map(|record| record.work_package_id.as_str());
    if resolved.decision == ResolverDecision::StartAllowed
        && resolved
            .work_package
            .as_ref()
            .map(|package| package.id.as_str())
            == bound_id
    {
        evidence.status = "START_ALLOWED".into();
    } else {
        evidence.blocker = Some("RESOLVER_BLOCKED".into());
    }
    Ok(evidence)
}

fn authorize_owner<R: GitRunner>(
    runner: &R,
    repository_root: &Path,
    state_root: &Path,
    production: bool,
    work_package_id: &str,
    confirmed: bool,
) -> Result<OwnerAuthorizationEvidence, ControlLoopError> {
    if !confirmed {
        return Err(err(
            "OWNER_CONFIRMATION_REQUIRED",
            "explicit Owner confirmation is required",
        ));
    }
    let repository = identity(runner, repository_root, production)?;
    let remote = authority(runner, repository_root, production);
    if remote.status != AuthorityStatus::Verified {
        return Err(err(
            "AUTHORITY_UNAVAILABLE",
            "remote Authority is not verified",
        ));
    }
    if !repository.worktree_clean {
        return Err(err(
            "WORKTREE_DIRTY",
            "worktree must be clean before authorization",
        ));
    }
    let package_path = repository_root
        .join("docs/60_Operations/work-packages")
        .join(format!("{work_package_id}.md"));
    let package = parse_package(&package_path).map_err(|_| {
        err(
            if malformed_authorization_contract_field(&package_path) {
                "AUTHORIZATION_CONTRACT_INVALID"
            } else {
                "WORK_PACKAGE_SCHEMA_INVALID"
            },
            "Work Package is invalid",
        )
    })?;
    let authority_sha = remote.remote_main_sha.unwrap_or_default();
    if package.id != work_package_id
        || package.status != "AUTHORIZED"
        || package.owner_authorization != "AUTHORIZED_FOR_IMPLEMENTATION"
    {
        return Err(err(
            "WORK_PACKAGE_NOT_AUTHORIZED",
            "formal Work Package authorization does not match Authority",
        ));
    }
    if package.authority_sha != authority_sha {
        return Err(err(
            "AUTHORITY_DRIFT",
            "formal Work Package Authority does not match verified origin/main",
        ));
    }
    let contract = authorization_contract(&package).map_err(|blocker| {
        err(
            authorization_contract_code(&blocker),
            "formal Work Package authorization contract is missing or invalid",
        )
    })?;
    let branch = repository
        .current_branch
        .ok_or_else(|| err("DETACHED_HEAD", "authorization requires a named branch"))?;
    let record = OwnerAuthorizationRecord {
        work_package_id: package.id.clone(),
        authority_sha,
        branch,
        worktree: repository.canonical_path,
        scope: contract.scope.to_vec(),
        allowed_capabilities: contract.allowed_capabilities.to_vec(),
        forbidden_capabilities: contract.forbidden_capabilities.to_vec(),
        authorized_at: timestamp(),
    };
    write_json(&authorization_path(state_root), &record)?;
    authorization_evidence(runner, repository_root, state_root, production)
}

fn supported_codex_controls() -> Vec<CodexControlAction> {
    vec![CodexControlAction::Start, CodexControlAction::Retry]
}

fn default_runtime(authorization: &OwnerAuthorizationEvidence) -> CodexRuntimeObserver {
    let phase = if authorization.status == "START_ALLOWED" {
        CodexRuntimePhase::Idle
    } else if authorization.valid {
        CodexRuntimePhase::Blocked
    } else {
        CodexRuntimePhase::WaitingOwnerAuthorization
    };
    CodexRuntimeObserver {
        engine: "Codex App Server".into(),
        profile: "sol".into(),
        process_id: None,
        process_state: "NOT_STARTED".into(),
        session_id: None,
        thread_id: None,
        turn_id: None,
        active_work_package: None,
        session_state: phase.clone(),
        branch: authorization
            .record
            .as_ref()
            .map(|record| record.branch.clone()),
        worktree: authorization
            .record
            .as_ref()
            .map(|record| record.worktree.clone()),
        current_phase: phase,
        last_activity: None,
        current_event: None,
        current_task: None,
        test_state: "UNKNOWN".into(),
        review_state: "UNKNOWN".into(),
        pull_request: None,
        ci_state: "UNKNOWN".into(),
        blocker: if authorization.status == "START_ALLOWED" {
            None
        } else if authorization.valid {
            Some("RESOLVER_BLOCKED".into())
        } else {
            Some("OWNER_AUTHORIZATION_REQUIRED".into())
        },
        failure: None,
        exit_status: None,
        active_run: false,
        writer_lock_held: false,
        next_action: if authorization.status == "START_ALLOWED" {
            "START".into()
        } else if authorization.valid {
            "RESOLVE_BLOCKER".into()
        } else {
            "AUTHORIZE_WORK_PACKAGE".into()
        },
        stop_after_current_step: false,
        supported_controls: supported_codex_controls(),
    }
}

fn codex_prompt(record: &OwnerAuthorizationRecord) -> String {
    format!(
        "Execute formal Work Package {} within scope: {}. Preserve all forbidden capabilities: {}. Use formal repository evidence, run standard validation, and stop with truthful evidence if blocked. Do not widen scope.",
        record.work_package_id,
        record.scope.join(", "),
        record.forbidden_capabilities.join(", ")
    )
}

fn codex_app_server_args() -> &'static [&'static str] {
    &["-p", "sol", "app-server"]
}

fn initialize_request() -> Value {
    json!({
        "method": "initialize",
        "id": 0,
        "params": {"clientInfo": {"name": "ai_control_center", "title": "AI Control Center", "version": "0.2.0"}}
    })
}

fn initialized_notification() -> Value {
    json!({"method": "initialized", "params": {}})
}

fn thread_start_request(record: &OwnerAuthorizationRecord) -> Value {
    json!({
        "method": "thread/start",
        "id": 1,
        "params": {"cwd": record.worktree, "approvalPolicy": "never", "sandbox": "workspace-write"}
    })
}

fn turn_start_request(thread_id: &str, record: &OwnerAuthorizationRecord) -> Value {
    json!({
        "method": "turn/start",
        "id": 2,
        "params": {"threadId": thread_id, "input": [{"type": "text", "text": codex_prompt(record)}]}
    })
}

#[derive(Default)]
struct CodexRuntimeManager {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    observer: Option<CodexRuntimeObserver>,
    responses: HashMap<u64, Value>,
    state_root: Option<PathBuf>,
    turn_started: bool,
}

impl Drop for CodexRuntimeManager {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl CodexRuntimeManager {
    fn persist(&self) {
        if let (Some(state_root), Some(observer)) = (&self.state_root, &self.observer) {
            let _ = write_json(&runtime_path(state_root), observer);
        }
    }

    fn observer_mut(&mut self) -> Option<&mut CodexRuntimeObserver> {
        self.observer.as_mut()
    }

    fn normalize_observer(&mut self) {
        let has_managed_process = self.child.is_some();
        if let Some(observer) = self.observer_mut() {
            observer.engine = "Codex App Server".into();
            observer.profile = "sol".into();
            observer.supported_controls = supported_codex_controls();
            observer.stop_after_current_step = false;
            if observer.process_state.is_empty() {
                observer.process_state = if has_managed_process {
                    "RUNNING".into()
                } else {
                    "NOT_STARTED".into()
                };
            }
            if !has_managed_process && !observer.active_run {
                observer.active_work_package = None;
                observer.writer_lock_held = false;
            }
        }
    }

    fn reconcile_process(&mut self) {
        let exit = match self.child.as_mut().map(Child::try_wait) {
            Some(Err(_)) => {
                if let Some(observer) = self.observer_mut() {
                    observer.current_phase = CodexRuntimePhase::Blocked;
                    observer.session_state = CodexRuntimePhase::Blocked;
                    observer.active_run = true;
                    observer.writer_lock_held = true;
                    observer.last_activity = Some(timestamp());
                    observer.current_event = Some("app-server/process-observation-failed".into());
                    observer.blocker = Some("CODEX_PROCESS_OBSERVATION_FAILED".into());
                    observer.failure =
                        Some("Managed process liveness could not be observed".into());
                    observer.next_action = "RESOLVE_BLOCKER".into();
                }
                self.persist();
                return;
            }
            Some(Ok(status)) => status,
            None => None,
        };
        if let Some(status) = exit {
            self.child = None;
            self.stdin = None;
            if let Some(observer) = self.observer_mut() {
                let was_active = observer.active_run
                    || matches!(
                        observer.current_phase,
                        CodexRuntimePhase::Starting
                            | CodexRuntimePhase::Running
                            | CodexRuntimePhase::Testing
                            | CodexRuntimePhase::Reviewing
                    );
                observer.process_state = "EXITED".into();
                observer.exit_status = Some(status.to_string());
                observer.active_run = false;
                observer.writer_lock_held = false;
                observer.active_work_package = None;
                observer.last_activity = Some(timestamp());
                observer.current_event = Some("app-server/exited".into());
                if was_active {
                    observer.current_phase = CodexRuntimePhase::Failed;
                    observer.session_state = CodexRuntimePhase::Failed;
                    observer.blocker = Some("CODEX_APP_SERVER_EXITED".into());
                    observer.failure = Some(format!("App Server exited: {status}"));
                    observer.next_action = "RETRY".into();
                }
            }
            self.persist();
        } else if self.child.is_some() {
            if let Some(observer) = self.observer_mut() {
                observer.process_state = "RUNNING".into();
            }
        }
    }

    fn reconcile_missing_process(&mut self) {
        if self.child.is_some() {
            return;
        }
        if let Some(observer) = self.observer_mut() {
            let persisted_process_claim =
                matches!(observer.process_state.as_str(), "RUNNING" | "STARTING");
            let stale_active_run = observer.active_run
                || matches!(
                    observer.current_phase,
                    CodexRuntimePhase::Starting
                        | CodexRuntimePhase::Running
                        | CodexRuntimePhase::Testing
                        | CodexRuntimePhase::Reviewing
                        | CodexRuntimePhase::Paused
                );
            if stale_active_run || persisted_process_claim {
                observer.process_id = None;
                observer.process_state = "MISSING".into();
                observer.active_run = false;
                observer.writer_lock_held = false;
                observer.active_work_package = None;
                observer.last_activity = Some(timestamp());
                observer.current_event = Some("app-server/process-missing".into());
                observer.blocker = Some("CODEX_APP_SERVER_PROCESS_MISSING".into());
                observer.failure =
                    Some("Persisted runtime has no managed App Server process".into());
                if stale_active_run {
                    observer.current_phase = CodexRuntimePhase::Failed;
                    observer.session_state = CodexRuntimePhase::Failed;
                    observer.next_action = "RETRY".into();
                } else {
                    observer.current_phase = CodexRuntimePhase::Idle;
                    observer.session_state = CodexRuntimePhase::Idle;
                    observer.next_action = "START".into();
                }
                self.persist();
            }
        }
    }

    fn guard_snapshot(&mut self) -> ExecutionGuardSnapshot {
        self.reconcile_process();
        self.reconcile_missing_process();
        let observer = self.observer.as_ref();
        ExecutionGuardSnapshot {
            active_codex_run: observer.map(|value| value.active_run).unwrap_or(false),
            writer_lock_held: observer
                .map(|value| value.writer_lock_held)
                .unwrap_or(false),
            unsaved_diff: false,
            previous_run_open: false,
        }
    }

    fn handle_protocol_message(&mut self, message: Value) {
        let method = message.get("method").and_then(Value::as_str);
        if message.get("id").is_some() && method.is_some() {
            if let Some(observer) = self.observer_mut() {
                let method = method.unwrap_or("unknown");
                observer.last_activity = Some(timestamp());
                observer.current_event = Some(method.to_string());
                observer.current_phase = CodexRuntimePhase::Blocked;
                observer.session_state = CodexRuntimePhase::Blocked;
                observer.blocker = Some("CODEX_SERVER_REQUEST_UNSUPPORTED".into());
                observer.failure =
                    Some(format!("App Server requested unsupported input: {method}"));
                observer.next_action = "RESOLVE_BLOCKER".into();
            }
            if let Some(child) = self.child.as_mut() {
                let _ = child.kill();
            }
            self.persist();
            return;
        }
        if let Some(id) = message.get("id").and_then(Value::as_u64) {
            if let Some(observer) = self.observer_mut() {
                observer.last_activity = Some(timestamp());
                observer.current_event = Some(format!("response/{id}"));
            }
            self.responses.insert(id, message);
            self.persist();
            return;
        }
        let Some(method) = method else {
            return;
        };
        if method == "turn/started" {
            self.turn_started = true;
        }
        let params = message.get("params").cloned().unwrap_or(Value::Null);
        let now = timestamp();
        if let Some(observer) = self.observer_mut() {
            observer.last_activity = Some(now);
            observer.current_event = Some(method.to_string());
            match method {
                "thread/started" => {
                    observer.thread_id = json_string(&params, "/thread/id");
                    observer.session_id = json_string(&params, "/thread/sessionId");
                }
                "turn/started" => {
                    observer.thread_id =
                        json_string(&params, "/threadId").or_else(|| observer.thread_id.clone());
                    observer.turn_id = json_string(&params, "/turn/id");
                    observer.current_phase = CodexRuntimePhase::Running;
                    observer.session_state = CodexRuntimePhase::Running;
                    observer.active_run = true;
                    observer.writer_lock_held = true;
                    observer.blocker = None;
                    observer.failure = None;
                    observer.next_action = "OBSERVE_CODEX_SESSION".into();
                }
                "item/started" | "item/completed" => {
                    let kind = params
                        .pointer("/item/type")
                        .and_then(Value::as_str)
                        .unwrap_or("unknown");
                    let item_id = params
                        .pointer("/item/id")
                        .and_then(Value::as_str)
                        .unwrap_or("unknown");
                    observer.current_task = Some(format!("{kind}: {item_id}"));
                }
                "turn/completed" => {
                    let status = params
                        .pointer("/turn/status")
                        .and_then(Value::as_str)
                        .unwrap_or("unknown");
                    observer.turn_id =
                        json_string(&params, "/turn/id").or_else(|| observer.turn_id.clone());
                    observer.active_run = false;
                    observer.writer_lock_held = false;
                    observer.active_work_package = None;
                    observer.current_task = Some(format!("turn {status}"));
                    if status == "completed" {
                        observer.current_phase = CodexRuntimePhase::Idle;
                        observer.session_state = CodexRuntimePhase::Idle;
                        observer.blocker = None;
                        observer.failure = None;
                        observer.next_action = "REVIEW_RUNTIME_RESULT".into();
                    } else {
                        observer.current_phase = CodexRuntimePhase::Failed;
                        observer.session_state = CodexRuntimePhase::Failed;
                        observer.blocker = Some(format!("CODEX_TURN_{}", status.to_uppercase()));
                        observer.failure = params
                            .pointer("/turn/error/message")
                            .and_then(Value::as_str)
                            .map(redact)
                            .or_else(|| Some(format!("Codex turn ended with {status}")));
                        observer.next_action = "RETRY".into();
                    }
                }
                "error" => {
                    let will_retry = params
                        .get("willRetry")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    observer.blocker = Some("CODEX_APP_SERVER_ERROR".into());
                    observer.failure = params
                        .pointer("/error/message")
                        .and_then(Value::as_str)
                        .map(redact);
                    if !will_retry {
                        observer.current_phase = CodexRuntimePhase::Failed;
                        observer.session_state = CodexRuntimePhase::Failed;
                        observer.active_run = false;
                        observer.writer_lock_held = false;
                        observer.active_work_package = None;
                        observer.next_action = "RETRY".into();
                    }
                }
                _ => {}
            }
        }
        self.persist();
    }
}

fn json_string(value: &Value, pointer: &str) -> Option<String> {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn protocol_error(response: &Value) -> Option<String> {
    response
        .pointer("/error/message")
        .and_then(Value::as_str)
        .map(redact)
}

impl ManagedCodexRuntime {
    fn ensure_loaded(&self, state_root: &Path) -> Result<(), ControlLoopError> {
        let mut manager = self.inner.lock().map_err(|_| {
            err(
                "RUNTIME_LOCK_FAILED",
                "Codex runtime manager is unavailable",
            )
        })?;
        manager.state_root = Some(state_root.to_path_buf());
        if manager.observer.is_none() {
            let path = runtime_path(state_root);
            if path.is_file() {
                let content = fs::read_to_string(path)
                    .map_err(|_| err("RUNTIME_UNAVAILABLE", "Codex runtime state is unreadable"))?;
                manager.observer = Some(
                    serde_json::from_str(&content)
                        .map_err(|_| err("RUNTIME_INVALID", "Codex runtime state is malformed"))?,
                );
            }
        }
        manager.normalize_observer();
        manager.reconcile_process();
        manager.reconcile_missing_process();
        Ok(())
    }

    fn read(
        &self,
        state_root: &Path,
        authorization: &OwnerAuthorizationEvidence,
    ) -> Result<CodexRuntimeObserver, ControlLoopError> {
        self.ensure_loaded(state_root)?;
        let mut manager = self.inner.lock().map_err(|_| {
            err(
                "RUNTIME_LOCK_FAILED",
                "Codex runtime manager is unavailable",
            )
        })?;
        if manager.observer.is_none() {
            manager.observer = Some(default_runtime(authorization));
        }
        manager.normalize_observer();
        manager.reconcile_process();
        manager.reconcile_missing_process();
        manager.observer.clone().ok_or_else(|| {
            err(
                "RUNTIME_UNAVAILABLE",
                "Codex runtime evidence is unavailable",
            )
        })
    }

    fn send(&self, request: Value) -> Result<(), ControlLoopError> {
        let mut manager = self.inner.lock().map_err(|_| {
            err(
                "RUNTIME_LOCK_FAILED",
                "Codex runtime manager is unavailable",
            )
        })?;
        let stdin = manager
            .stdin
            .as_mut()
            .ok_or_else(|| err("CODEX_CHANNEL_CLOSED", "App Server stdin is unavailable"))?;
        serde_json::to_writer(&mut *stdin, &request).map_err(|_| {
            err(
                "CODEX_PROTOCOL_WRITE_FAILED",
                "App Server request could not be encoded",
            )
        })?;
        stdin
            .write_all(b"\n")
            .and_then(|_| stdin.flush())
            .map_err(|_| {
                err(
                    "CODEX_PROTOCOL_WRITE_FAILED",
                    "App Server request could not be sent",
                )
            })
    }

    fn wait_response(&self, id: u64) -> Result<Value, ControlLoopError> {
        let start = Instant::now();
        loop {
            {
                let mut manager = self.inner.lock().map_err(|_| {
                    err(
                        "RUNTIME_LOCK_FAILED",
                        "Codex runtime manager is unavailable",
                    )
                })?;
                manager.reconcile_process();
                if let Some(response) = manager.responses.remove(&id) {
                    if let Some(message) = protocol_error(&response) {
                        return Err(err("CODEX_PROTOCOL_ERROR", &message));
                    }
                    return Ok(response);
                }
                if let Some(observer) = &manager.observer {
                    if matches!(
                        observer.current_phase,
                        CodexRuntimePhase::Failed | CodexRuntimePhase::Blocked
                    ) {
                        return Err(err(
                            observer.blocker.as_deref().unwrap_or("CODEX_START_FAILED"),
                            observer
                                .failure
                                .as_deref()
                                .unwrap_or("Codex App Server failed during startup"),
                        ));
                    }
                }
                if manager.child.is_none() {
                    return Err(err(
                        "CODEX_APP_SERVER_EXITED",
                        "App Server exited before responding",
                    ));
                }
            }
            if start.elapsed() > APP_SERVER_START_TIMEOUT {
                return Err(err(
                    "CODEX_PROTOCOL_TIMEOUT",
                    "App Server did not respond before the startup deadline",
                ));
            }
            thread::sleep(Duration::from_millis(20));
        }
    }

    fn wait_running(&self) -> Result<CodexRuntimeObserver, ControlLoopError> {
        let start = Instant::now();
        loop {
            {
                let mut manager = self.inner.lock().map_err(|_| {
                    err(
                        "RUNTIME_LOCK_FAILED",
                        "Codex runtime manager is unavailable",
                    )
                })?;
                manager.reconcile_process();
                if let Some(observer) = &manager.observer {
                    if matches!(
                        observer.current_phase,
                        CodexRuntimePhase::Failed | CodexRuntimePhase::Blocked
                    ) {
                        return Err(err(
                            observer.blocker.as_deref().unwrap_or("CODEX_START_FAILED"),
                            observer
                                .failure
                                .as_deref()
                                .unwrap_or("Codex App Server failed during startup"),
                        ));
                    }
                    if manager.turn_started
                        && observer.process_state == "RUNNING"
                        && observer.process_id.is_some()
                        && observer.thread_id.is_some()
                        && observer.session_id.is_some()
                        && observer.turn_id.is_some()
                    {
                        return Ok(observer.clone());
                    }
                }
            }
            if start.elapsed() > APP_SERVER_START_TIMEOUT {
                return Err(err(
                    "CODEX_START_TIMEOUT",
                    "App Server did not report a running turn before the startup deadline",
                ));
            }
            thread::sleep(Duration::from_millis(20));
        }
    }

    fn fail_start(&self, failure: &ControlLoopError) {
        if let Ok(mut manager) = self.inner.lock() {
            if let Some(mut child) = manager.child.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
            manager.stdin = None;
            if let Some(observer) = manager.observer_mut() {
                observer.process_state = "EXITED".into();
                observer.current_phase = CodexRuntimePhase::Failed;
                observer.session_state = CodexRuntimePhase::Failed;
                observer.active_run = false;
                observer.writer_lock_held = false;
                observer.active_work_package = None;
                observer.last_activity = Some(timestamp());
                observer.current_event = Some("app-server/start-failed".into());
                observer.blocker = Some(failure.code.clone());
                observer.failure = Some(failure.message.clone());
                observer.next_action = "RETRY".into();
            }
            manager.persist();
        }
    }

    fn start(
        &self,
        record: &OwnerAuthorizationRecord,
        state_root: &Path,
    ) -> Result<CodexRuntimeObserver, ControlLoopError> {
        {
            let mut manager = self.inner.lock().map_err(|_| {
                err(
                    "RUNTIME_LOCK_FAILED",
                    "Codex runtime manager is unavailable",
                )
            })?;
            manager.reconcile_process();
            if manager
                .observer
                .as_ref()
                .map(|observer| observer.active_run || observer.writer_lock_held)
                .unwrap_or(false)
            {
                return Err(err("ACTIVE_RUN", "a managed Codex run is already active"));
            }
            if let Some(mut inactive_child) = manager.child.take() {
                let _ = inactive_child.kill();
                let _ = inactive_child.wait();
                manager.stdin = None;
            }
        }
        let mut child = Command::new("codex")
            .args(codex_app_server_args())
            .current_dir(&record.worktree)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|_| {
                err(
                    "CODEX_START_FAILED",
                    "Codex App Server could not be started",
                )
            })?;
        let process_id = child.id();
        let Some(stdin) = child.stdin.take() else {
            let _ = child.kill();
            let _ = child.wait();
            return Err(err(
                "CODEX_CHANNEL_CLOSED",
                "App Server stdin is unavailable",
            ));
        };
        let Some(stdout) = child.stdout.take() else {
            let _ = child.kill();
            let _ = child.wait();
            return Err(err(
                "CODEX_CHANNEL_CLOSED",
                "App Server stdout is unavailable",
            ));
        };
        let stderr = child.stderr.take();
        {
            let mut manager = match self.inner.lock() {
                Ok(manager) => manager,
                Err(_) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(err(
                        "RUNTIME_LOCK_FAILED",
                        "Codex runtime manager is unavailable",
                    ));
                }
            };
            if manager.child.is_some()
                || manager
                    .observer
                    .as_ref()
                    .map(|observer| observer.active_run || observer.writer_lock_held)
                    .unwrap_or(false)
            {
                let _ = child.kill();
                let _ = child.wait();
                return Err(err("ACTIVE_RUN", "a managed Codex run is already active"));
            }
            let mut observer = default_runtime(&OwnerAuthorizationEvidence {
                status: "START_ALLOWED".into(),
                valid: true,
                blocker: None,
                record: Some(record.clone()),
            });
            observer.process_id = Some(process_id);
            observer.process_state = "RUNNING".into();
            observer.active_work_package = Some(record.work_package_id.clone());
            observer.current_phase = CodexRuntimePhase::Starting;
            observer.session_state = CodexRuntimePhase::Starting;
            observer.active_run = true;
            observer.last_activity = Some(timestamp());
            observer.current_event = Some("app-server/spawned".into());
            observer.current_task = Some("initialize".into());
            observer.blocker = None;
            observer.next_action = "INITIALIZE_APP_SERVER".into();
            manager.child = Some(child);
            manager.stdin = Some(stdin);
            manager.observer = Some(observer);
            manager.responses.clear();
            manager.turn_started = false;
            manager.state_root = Some(state_root.to_path_buf());
            manager.persist();
        }

        let runtime = Arc::downgrade(&self.inner);
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                let Ok(line) = line else {
                    break;
                };
                let Ok(message) = serde_json::from_str::<Value>(&line) else {
                    if let Some(runtime) = runtime.upgrade() {
                        if let Ok(mut manager) = runtime.lock() {
                            if let Some(observer) = manager.observer_mut() {
                                observer.current_event = Some("app-server/invalid-jsonl".into());
                                observer.current_phase = CodexRuntimePhase::Blocked;
                                observer.session_state = CodexRuntimePhase::Blocked;
                                observer.active_run = true;
                                observer.writer_lock_held = true;
                                observer.blocker = Some("CODEX_PROTOCOL_INVALID".into());
                                observer.failure =
                                    Some("App Server emitted malformed JSONL".into());
                                observer.next_action = "RESOLVE_BLOCKER".into();
                            }
                            if let Some(child) = manager.child.as_mut() {
                                let _ = child.kill();
                            }
                            manager.persist();
                        }
                    }
                    break;
                };
                let Some(runtime) = runtime.upgrade() else {
                    break;
                };
                let Ok(mut manager) = runtime.lock() else {
                    break;
                };
                manager.handle_protocol_message(message);
            }
            let Some(runtime) = runtime.upgrade() else {
                return;
            };
            let Ok(mut manager) = runtime.lock() else {
                return;
            };
            let channel_failed = manager
                .observer
                .as_ref()
                .map(|observer| observer.active_run)
                .unwrap_or(false);
            if channel_failed {
                if let Some(observer) = manager.observer_mut() {
                    observer.current_event = Some("app-server/stdout-closed".into());
                    observer.current_phase = CodexRuntimePhase::Blocked;
                    observer.session_state = CodexRuntimePhase::Blocked;
                    observer.writer_lock_held = true;
                    if observer.blocker.is_none() {
                        observer.blocker = Some("CODEX_CHANNEL_CLOSED".into());
                        observer.failure = Some("App Server stdout channel closed".into());
                    }
                    observer.next_action = "RESOLVE_BLOCKER".into();
                }
                if let Some(child) = manager.child.as_mut() {
                    let _ = child.kill();
                }
                manager.persist();
            }
        });
        if let Some(stderr) = stderr {
            let runtime = Arc::downgrade(&self.inner);
            thread::spawn(move || {
                for line in BufReader::new(stderr).lines() {
                    if line.is_err() {
                        break;
                    }
                    let Some(runtime) = runtime.upgrade() else {
                        break;
                    };
                    let Ok(mut manager) = runtime.lock() else {
                        break;
                    };
                    if let Some(observer) = manager.observer_mut() {
                        observer.last_activity = Some(timestamp());
                        observer.current_event = Some("app-server/stderr".into());
                    }
                    manager.persist();
                }
            });
        }

        let startup = (|| {
            self.send(initialize_request())?;
            self.wait_response(0)?;
            self.send(initialized_notification())?;
            self.send(thread_start_request(record))?;
            let thread_response = self.wait_response(1)?;
            let thread_id =
                json_string(&thread_response, "/result/thread/id").ok_or_else(|| {
                    err(
                        "CODEX_PROTOCOL_INVALID",
                        "thread/start returned no thread id",
                    )
                })?;
            let session_id =
                json_string(&thread_response, "/result/thread/sessionId").ok_or_else(|| {
                    err(
                        "CODEX_PROTOCOL_INVALID",
                        "thread/start returned no session id",
                    )
                })?;
            {
                let mut manager = self.inner.lock().map_err(|_| {
                    err(
                        "RUNTIME_LOCK_FAILED",
                        "Codex runtime manager is unavailable",
                    )
                })?;
                if let Some(observer) = manager.observer_mut() {
                    observer.thread_id = Some(thread_id.clone());
                    observer.session_id = Some(session_id);
                    observer.current_event = Some("thread/start".into());
                    observer.current_task = Some("turn/start".into());
                }
                manager.persist();
            }
            self.send(turn_start_request(&thread_id, record))?;
            let turn_response = self.wait_response(2)?;
            let turn_id = json_string(&turn_response, "/result/turn/id")
                .ok_or_else(|| err("CODEX_PROTOCOL_INVALID", "turn/start returned no turn id"))?;
            {
                let mut manager = self.inner.lock().map_err(|_| {
                    err(
                        "RUNTIME_LOCK_FAILED",
                        "Codex runtime manager is unavailable",
                    )
                })?;
                if let Some(observer) = manager.observer_mut() {
                    observer.turn_id = Some(turn_id);
                }
                manager.persist();
            }
            self.wait_running()
        })();
        if let Err(failure) = &startup {
            self.fail_start(failure);
        }
        startup
    }

    #[cfg(test)]
    fn observe_message(
        &self,
        observer: CodexRuntimeObserver,
        message: Value,
    ) -> CodexRuntimeObserver {
        let mut manager = self.inner.lock().unwrap();
        manager.observer = Some(observer);
        manager.handle_protocol_message(message);
        manager.observer.clone().unwrap()
    }
}

fn unsupported_control(action: &CodexControlAction) -> Option<ControlLoopError> {
    match action {
        CodexControlAction::Pause
        | CodexControlAction::Resume
        | CodexControlAction::StopAfterCurrentStep => Some(err(
            "UNSUPPORTED_CONTROL",
            "installed Codex App Server contract does not support this control",
        )),
        CodexControlAction::Start | CodexControlAction::Retry => None,
    }
}

fn control_codex_runtime<R: GitRunner>(
    runner: &R,
    repository_root: &Path,
    state_root: &Path,
    production: bool,
    managed_runtime: &ManagedCodexRuntime,
    action: CodexControlAction,
) -> Result<CodexRuntimeObserver, ControlLoopError> {
    if let Some(error) = unsupported_control(&action) {
        return Err(error);
    }
    let guards = managed_runtime.snapshot();
    let authorization =
        start_allowed_authorization(runner, repository_root, state_root, production, &guards)?;
    if authorization.status != "START_ALLOWED" {
        return Err(err(
            authorization
                .blocker
                .as_deref()
                .unwrap_or("OWNER_AUTHORIZATION_REQUIRED"),
            "Codex start requires matching Owner authorization and START_ALLOWED",
        ));
    }
    let current = managed_runtime.read(state_root, &authorization)?;
    if current.active_run || current.writer_lock_held {
        return Err(err("ACTIVE_RUN", "a managed Codex run is already active"));
    }
    let record = authorization
        .record
        .ok_or_else(|| err("OWNER_AUTHORIZATION_REQUIRED", "authorization is missing"))?;
    managed_runtime.start(&record, state_root)
}

fn app_state_root(app: &tauri::AppHandle) -> Result<PathBuf, ControlLoopError> {
    app.path().app_data_dir().map_err(|_| {
        err(
            "STATE_PATH_INVALID",
            "application data directory is unavailable",
        )
    })
}
#[tauri::command]
fn read_repository_identity(
    runtime: tauri::State<'_, ManagedCodexRuntime>,
) -> Result<RepositoryIdentity, ControlLoopError> {
    production_service(runtime.inner().clone()).read_identity()
}
#[tauri::command]
fn check_remote_authority(
    runtime: tauri::State<'_, ManagedCodexRuntime>,
) -> Result<RemoteAuthority, ControlLoopError> {
    production_service(runtime.inner().clone()).check_authority()
}
#[tauri::command]
fn evaluate_workspace_sync(
    app: tauri::AppHandle,
    runtime: tauri::State<'_, ManagedCodexRuntime>,
) -> Result<WorkspaceSyncEvaluation, ControlLoopError> {
    runtime.ensure_loaded(&app_state_root(&app)?)?;
    production_service(runtime.inner().clone()).evaluate_sync()
}
#[tauri::command]
fn sync_workspace(
    app: tauri::AppHandle,
    runtime: tauri::State<'_, ManagedCodexRuntime>,
    confirmed: bool,
) -> Result<WorkspaceSyncResult, ControlLoopError> {
    runtime.ensure_loaded(&app_state_root(&app)?)?;
    production_service(runtime.inner().clone()).sync(confirmed)
}
#[tauri::command]
fn resolve_next_work_package(
    app: tauri::AppHandle,
    runtime: tauri::State<'_, ManagedCodexRuntime>,
) -> Result<ResolverDecisionResult, ControlLoopError> {
    runtime.ensure_loaded(&app_state_root(&app)?)?;
    let service = production_service(runtime.inner().clone());
    let root = service.root()?;
    resolve(&service.runner, &root, true, &service.guards.snapshot())
}
#[tauri::command]
fn read_roadmap_evidence(
    runtime: tauri::State<'_, ManagedCodexRuntime>,
) -> Result<RoadmapEvidence, ControlLoopError> {
    let service = production_service(runtime.inner().clone());
    let root = service.root()?;
    load_roadmap_evidence(&root)
}
#[tauri::command]
fn read_owner_authorization(
    app: tauri::AppHandle,
    runtime: tauri::State<'_, ManagedCodexRuntime>,
) -> Result<OwnerAuthorizationEvidence, ControlLoopError> {
    let state_root = app_state_root(&app)?;
    runtime.ensure_loaded(&state_root)?;
    let service = production_service(runtime.inner().clone());
    let root = service.root()?;
    start_allowed_authorization(
        &service.runner,
        &root,
        &state_root,
        true,
        &service.guards.snapshot(),
    )
}
#[tauri::command]
fn authorize_work_package(
    app: tauri::AppHandle,
    runtime: tauri::State<'_, ManagedCodexRuntime>,
    work_package_id: String,
    confirmed: bool,
) -> Result<OwnerAuthorizationEvidence, ControlLoopError> {
    runtime.ensure_loaded(&app_state_root(&app)?)?;
    let service = production_service(runtime.inner().clone());
    let root = service.root()?;
    authorize_owner(
        &service.runner,
        &root,
        &app_state_root(&app)?,
        true,
        &work_package_id,
        confirmed,
    )
}
#[tauri::command]
fn read_codex_runtime(
    app: tauri::AppHandle,
    runtime: tauri::State<'_, ManagedCodexRuntime>,
) -> Result<CodexRuntimeObserver, ControlLoopError> {
    let state_root = app_state_root(&app)?;
    runtime.ensure_loaded(&state_root)?;
    let service = production_service(runtime.inner().clone());
    let root = service.root()?;
    let authorization = start_allowed_authorization(
        &service.runner,
        &root,
        &state_root,
        true,
        &service.guards.snapshot(),
    )?;
    runtime.read(&state_root, &authorization)
}
#[tauri::command]
fn control_codex(
    app: tauri::AppHandle,
    runtime: tauri::State<'_, ManagedCodexRuntime>,
    action: CodexControlAction,
) -> Result<CodexRuntimeObserver, ControlLoopError> {
    let state_root = app_state_root(&app)?;
    runtime.ensure_loaded(&state_root)?;
    let service = production_service(runtime.inner().clone());
    let root = service.root()?;
    control_codex_runtime(
        &service.runner,
        &root,
        &state_root,
        true,
        runtime.inner(),
        action,
    )
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ManagedCodexRuntime::default())
        .invoke_handler(tauri::generate_handler![
            read_repository_identity,
            check_remote_authority,
            evaluate_workspace_sync,
            sync_workspace,
            resolve_next_work_package,
            read_roadmap_evidence,
            read_owner_authorization,
            authorize_work_package,
            read_codex_runtime,
            control_codex
        ])
        .run(tauri::generate_context!())
        .expect("error while running AI Control Center");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        sync::{
            atomic::{AtomicU64, Ordering},
            Arc, Mutex,
        },
        time::{SystemTime, UNIX_EPOCH},
    };
    static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);
    fn temp(name: &str) -> PathBuf {
        let n = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let p = std::env::temp_dir().join(format!("aicc-{name}-{n}-{counter}"));
        fs::create_dir_all(&p).unwrap();
        p
    }
    fn git(root: &Path, args: &[&str]) -> String {
        let o = Command::new("git")
            .args(args)
            .current_dir(root)
            .output()
            .unwrap();
        assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stderr));
        String::from_utf8_lossy(&o.stdout).trim().into()
    }
    fn repo() -> (PathBuf, PathBuf) {
        let remote = temp("remote.git");
        git(&remote, &["init", "--bare", "--initial-branch=main"]);
        let local = temp("local");
        git(&local, &["init", "--initial-branch=main"]);
        git(&local, &["config", "user.name", "AICC Test"]);
        git(
            &local,
            &["config", "user.email", "aicc-test@example.invalid"],
        );
        fs::write(local.join("README"), "initial").unwrap();
        git(&local, &["add", "."]);
        git(&local, &["commit", "-m", "initial"]);
        git(
            &local,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git(&local, &["push", "-u", "origin", "main"]);
        (local, remote)
    }
    fn authorization_contract_fixture() -> &'static str {
        "authorization_scope:\n  - Codex-only migration\n  - repository-standard validation\n  - independent review\nallowed_capabilities:\n  - REPOSITORY_SCOPED_EDIT\n  - STANDARD_VALIDATION\nforbidden_capabilities:\n  - ARBITRARY_SHELL_UI\n  - FORCE_PUSH\n"
    }
    fn authorization_fixture(contract: &str) -> (PathBuf, PathBuf, String) {
        let (local, _) = repo();
        let authority_sha = git(&local, &["rev-parse", "HEAD"]);
        git(&local, &["switch", "-c", "authorization-binding"]);
        let packages = local.join("docs/60_Operations/work-packages");
        fs::create_dir_all(&packages).unwrap();
        fs::write(
            packages.join("AUTHORIZATION-WP.md"),
            format!(
                "---\nschema: aicc-work-package/v1\nid: AUTHORIZATION-WP\ntitle: Authorization fixture\nstatus: AUTHORIZED\nauthority_sha: {authority_sha}\nopenspec_change: authorization-fixture\ndependencies: []\nprevious_run_status: HUMAN_UAT_FAIL\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n{contract}---\n"
            ),
        )
        .unwrap();
        git(&local, &["add", "docs"]);
        git(&local, &["commit", "-m", "authorization-fixture"]);
        (local, temp("authorization-state"), authority_sha)
    }
    fn authorize_fixture(local: &Path, state: &Path) -> OwnerAuthorizationEvidence {
        authorize_owner(
            &ProductionGitRunner,
            local,
            state,
            false,
            "AUTHORIZATION-WP",
            true,
        )
        .unwrap()
    }
    struct RecordingGitRunner {
        inner: ProductionGitRunner,
        history: Arc<Mutex<Vec<GitOperation>>>,
    }
    impl GitRunner for RecordingGitRunner {
        fn run(&self, root: &Path, op: GitOperation) -> Result<GitOutput, ControlLoopError> {
            self.history.lock().unwrap().push(op);
            self.inner.run(root, op)
        }
    }
    struct SequenceGuardProvider {
        values: Mutex<Vec<ExecutionGuardSnapshot>>,
    }
    impl GuardProvider for SequenceGuardProvider {
        fn snapshot(&self) -> ExecutionGuardSnapshot {
            self.values.lock().unwrap().remove(0)
        }
    }
    #[test]
    fn real_valid_temporary_identity() {
        let (local, _) = repo();
        let i = identity(&ProductionGitRunner, &local, false).unwrap();
        assert!(i.repository_valid && i.origin_present && i.worktree_clean);
    }
    #[test]
    fn fake_git_directory_rejected() {
        let p = temp("fake");
        fs::create_dir(p.join(".git")).unwrap();
        assert!(validate_root(&ProductionGitRunner, &p, false).is_err());
    }
    #[test]
    fn repository_subdirectory_rejected() {
        let (local, _) = repo();
        let sub = local.join("sub");
        fs::create_dir(&sub).unwrap();
        assert!(validate_root(&ProductionGitRunner, &sub, false).is_err());
    }
    #[test]
    fn similar_prefix_rejected() {
        let p = PathBuf::from(CANONICAL_PATH).with_file_name("AIcontrolcenter-other");
        assert!(validate_root(&ProductionGitRunner, &p, true).is_err());
    }
    #[test]
    fn symlink_escape_rejected() {
        let (local, _) = repo();
        let link = temp("link").join("repo");
        std::os::unix::fs::symlink(&local, &link).unwrap();
        let outside = link.join("child");
        assert!(validate_root(&ProductionGitRunner, &outside, false).is_err());
    }
    #[test]
    fn missing_origin_reported() {
        let (local, _) = repo();
        let out = Command::new("git")
            .args(["remote", "remove", "origin"])
            .current_dir(&local)
            .output()
            .unwrap();
        assert!(out.status.success());
        let i = identity(&ProductionGitRunner, &local, false).unwrap();
        assert!(!i.origin_present && !i.diagnostics.is_empty());
    }
    #[test]
    fn detached_head_reported() {
        let (local, _) = repo();
        let sha = git(&local, &["rev-parse", "HEAD"]);
        git(&local, &["checkout", "--detach", &sha]);
        assert!(
            identity(&ProductionGitRunner, &local, false)
                .unwrap()
                .detached_head
        );
    }
    #[test]
    fn dirty_entries_returned() {
        let (local, _) = repo();
        fs::write(local.join("dirty"), "x").unwrap();
        assert!(!identity(&ProductionGitRunner, &local, false)
            .unwrap()
            .worktree_entries
            .is_empty());
    }
    #[test]
    fn show_toplevel_matches_root() {
        let (local, _) = repo();
        assert_eq!(
            validate_root(&ProductionGitRunner, &local, false).unwrap(),
            fs::canonicalize(local).unwrap()
        );
    }
    #[test]
    fn bare_remote_authority_valid() {
        let (local, _) = repo();
        assert_eq!(
            authority(&ProductionGitRunner, &local, false).status,
            AuthorityStatus::Verified
        );
    }
    #[test]
    fn authority_malformed_empty_fake() {
        let (local, _) = repo();
        let fake = FakeRunner::with(GitOperation::RemoteMainSha, "", "");
        assert_eq!(
            authority(&fake, &local, false).status,
            AuthorityStatus::RemoteInvalidResponse
        );
    }
    #[test]
    fn authority_malformed_multiple_fake() {
        let (local, _) = repo();
        let fake = FakeRunner::with(
            GitOperation::RemoteMainSha,
            "a refs/heads/main\nb refs/heads/main",
            "",
        );
        assert_eq!(
            authority(&fake, &local, false).status,
            AuthorityStatus::RemoteInvalidResponse
        );
    }
    #[test]
    fn authority_failure_fake() {
        let (local, _) = repo();
        let fake = FakeRunner::failing(GitOperation::RemoteMainSha);
        assert_eq!(
            authority(&fake, &local, false).status,
            AuthorityStatus::RemoteUnavailable
        );
    }
    #[test]
    fn authority_history_has_no_fetch() {
        let (local, _) = repo();
        let fake = RecordingGitRunner {
            inner: ProductionGitRunner,
            history: Arc::new(Mutex::new(Vec::new())),
        };
        let _ = authority(&fake, &local, false);
        assert!(!fake
            .history
            .lock()
            .unwrap()
            .contains(&GitOperation::FetchOriginMain));
    }
    #[test]
    fn confirmation_required() {
        let (local, _) = repo();
        let service = ControlLoopService {
            runner: ProductionGitRunner,
            guards: LocalControlState::default(),
            root_path: local,
            production: false,
        };
        assert_eq!(
            service.sync(false).unwrap_err().code,
            "OWNER_CONFIRMATION_REQUIRED"
        );
    }
    #[test]
    fn behind_sync_evaluation_allowed() {
        let (local, _) = repo();
        let sha = git(&local, &["rev-parse", "HEAD"]);
        git(&local, &["reset", "--hard", &sha]);
        let i = identity(&ProductionGitRunner, &local, false).unwrap();
        let mut a = authority(&ProductionGitRunner, &local, false);
        a.remote_main_sha = Some("0000000000000000000000000000000000000000".into());
        let e = evaluate(&i, &a, &ExecutionGuardSnapshot::default());
        assert!(e.allowed);
    }
    #[test]
    fn clean_behind_temporary_repository_sync_succeeds() {
        let (local, remote) = repo();
        let other = temp("other");
        git(&other, &["clone", remote.to_str().unwrap(), "."]);
        git(&other, &["config", "user.name", "AICC Test"]);
        git(
            &other,
            &["config", "user.email", "aicc-test@example.invalid"],
        );
        fs::write(other.join("remote-ahead"), "ahead").unwrap();
        git(&other, &["add", "."]);
        git(&other, &["commit", "-m", "remote-ahead"]);
        git(&other, &["push", "origin", "main"]);
        let service = ControlLoopService {
            runner: ProductionGitRunner,
            guards: LocalControlState::default(),
            root_path: local.clone(),
            production: false,
        };
        let result = service.sync(true).unwrap();
        assert!(result.success);
        assert_eq!(
            git(&local, &["rev-parse", "HEAD"]),
            git(&local, &["rev-parse", "refs/remotes/origin/main"])
        );
    }
    #[test]
    fn sync_operation_order_recorded() {
        let (local, remote) = repo();
        let other = temp("order");
        git(&other, &["clone", remote.to_str().unwrap(), "."]);
        git(&other, &["config", "user.name", "AICC Test"]);
        git(
            &other,
            &["config", "user.email", "aicc-test@example.invalid"],
        );
        fs::write(other.join("ahead"), "x").unwrap();
        git(&other, &["add", "."]);
        git(&other, &["commit", "-m", "ahead"]);
        git(&other, &["push", "origin", "main"]);
        let h = Arc::new(Mutex::new(Vec::new()));
        let r = RecordingGitRunner {
            inner: ProductionGitRunner,
            history: h.clone(),
        };
        let _ = ControlLoopService {
            runner: r,
            guards: LocalControlState::default(),
            root_path: local,
            production: false,
        }
        .sync(true);
        let history = h.lock().unwrap();
        let fetch = history
            .iter()
            .position(|o| *o == GitOperation::FetchOriginMain)
            .unwrap();
        let fetched = history
            .iter()
            .position(|o| *o == GitOperation::FetchedOriginMainSha)
            .unwrap();
        let switch = history
            .iter()
            .position(|o| *o == GitOperation::SwitchMain)
            .unwrap();
        let merge = history
            .iter()
            .position(|o| *o == GitOperation::MergeOriginMainFastForwardOnly)
            .unwrap();
        assert!(fetch < fetched && fetched < switch && switch < merge);
    }
    #[test]
    fn divergent_ff_only_fails() {
        let (local, remote) = repo();
        fs::write(local.join("local"), "x").unwrap();
        git(&local, &["add", "."]);
        git(&local, &["commit", "-m", "diverge"]);
        let other = temp("divergent-remote");
        git(&other, &["clone", remote.to_str().unwrap(), "."]);
        git(&other, &["config", "user.name", "AICC Test"]);
        git(
            &other,
            &["config", "user.email", "aicc-test@example.invalid"],
        );
        fs::write(other.join("remote"), "x").unwrap();
        git(&other, &["add", "."]);
        git(&other, &["commit", "-m", "remote-diverge"]);
        git(&other, &["push", "origin", "main"]);
        let service = ControlLoopService {
            runner: ProductionGitRunner,
            guards: LocalControlState::default(),
            root_path: local,
            production: false,
        };
        assert_ne!(
            service.sync(true).unwrap_err().code,
            "OWNER_CONFIRMATION_REQUIRED"
        );
    }
    #[test]
    fn failed_sync_has_no_recovery_operations() {
        let (local, _) = repo();
        let h = Arc::new(Mutex::new(Vec::new()));
        let r = RecordingGitRunner {
            inner: ProductionGitRunner,
            history: h.clone(),
        };
        let _ = ControlLoopService {
            runner: r,
            guards: LocalControlState::default(),
            root_path: local,
            production: false,
        }
        .sync(true);
        assert!(!h.lock().unwrap().iter().any(|o| matches!(
            o,
            GitOperation::MergeOriginMainFastForwardOnly
        ) && git_args(*o).contains(&"reset")));
    }
    #[test]
    fn post_fetch_guard_blocks_writer() {
        let (local, remote) = repo();
        let other = temp("guard-remote");
        git(&other, &["clone", remote.to_str().unwrap(), "."]);
        git(&other, &["config", "user.name", "AICC Test"]);
        git(
            &other,
            &["config", "user.email", "aicc-test@example.invalid"],
        );
        fs::write(other.join("remote-ahead"), "x").unwrap();
        git(&other, &["add", "."]);
        git(&other, &["commit", "-m", "remote-ahead"]);
        git(&other, &["push", "origin", "main"]);
        let service = ControlLoopService {
            runner: ProductionGitRunner,
            guards: SequenceGuardProvider {
                values: Mutex::new(vec![
                    ExecutionGuardSnapshot::default(),
                    ExecutionGuardSnapshot {
                        writer_lock_held: true,
                        ..Default::default()
                    },
                ]),
            },
            root_path: local,
            production: false,
        };
        assert_eq!(
            service.sync(true).unwrap_err().code,
            "SYNC_REVALIDATION_FAILED"
        );
    }
    #[test]
    fn authorization_copies_formal_work_package_contract_exactly() {
        let (local, state, authority_sha) = authorization_fixture(authorization_contract_fixture());
        let evidence = authorize_fixture(&local, &state);
        let record = evidence.record.unwrap();
        assert!(evidence.valid);
        assert_eq!(record.work_package_id, "AUTHORIZATION-WP");
        assert_eq!(record.authority_sha, authority_sha);
        assert_eq!(
            record.scope,
            vec![
                "Codex-only migration",
                "repository-standard validation",
                "independent review"
            ]
        );
        assert_eq!(
            record.allowed_capabilities,
            vec!["REPOSITORY_SCOPED_EDIT", "STANDARD_VALIDATION"]
        );
        assert_eq!(
            record.forbidden_capabilities,
            vec!["ARBITRARY_SHELL_UI", "FORCE_PUSH"]
        );
        assert!(authorization_path(&state).is_file());
    }
    #[test]
    fn authorization_missing_contract_fails_closed_without_record() {
        let (local, state, _) = authorization_fixture("");
        let error = authorize_owner(
            &ProductionGitRunner,
            &local,
            &state,
            false,
            "AUTHORIZATION-WP",
            true,
        )
        .unwrap_err();
        assert_eq!(error.code, "AUTHORIZATION_CONTRACT_MISSING");
        assert!(!authorization_path(&state).exists());
    }
    #[test]
    fn authorization_formal_authority_drift_fails_closed_without_record() {
        let (local, state, authority_sha) = authorization_fixture(authorization_contract_fixture());
        let package = local.join("docs/60_Operations/work-packages/AUTHORIZATION-WP.md");
        let content = fs::read_to_string(&package).unwrap();
        fs::write(
            &package,
            content.replace(
                &format!("authority_sha: {authority_sha}"),
                "authority_sha: different-authority",
            ),
        )
        .unwrap();
        git(&local, &["add", "docs"]);
        git(&local, &["commit", "-m", "authorization-authority-drift"]);
        let error = authorize_owner(
            &ProductionGitRunner,
            &local,
            &state,
            false,
            "AUTHORIZATION-WP",
            true,
        )
        .unwrap_err();
        assert_eq!(error.code, "AUTHORITY_DRIFT");
        assert!(!authorization_path(&state).exists());
    }
    #[test]
    fn authorization_malformed_contract_fails_closed_without_record() {
        let contract = "authorization_scope:\n  - scoped work\nallowed_capabilities:\n  - STANDARD_VALIDATION\nforbidden_capabilities:\n  - STANDARD_VALIDATION\n";
        let (local, state, _) = authorization_fixture(contract);
        let error = authorize_owner(
            &ProductionGitRunner,
            &local,
            &state,
            false,
            "AUTHORIZATION-WP",
            true,
        )
        .unwrap_err();
        assert_eq!(error.code, "AUTHORIZATION_CONTRACT_INVALID");
        assert!(!authorization_path(&state).exists());
    }
    #[test]
    fn authorization_wrong_contract_field_type_fails_closed_without_record() {
        let contract = "authorization_scope:\n  - scoped work\nallowed_capabilities: STANDARD_VALIDATION\nforbidden_capabilities:\n  - FORCE_PUSH\n";
        let (local, state, _) = authorization_fixture(contract);
        let error = authorize_owner(
            &ProductionGitRunner,
            &local,
            &state,
            false,
            "AUTHORIZATION-WP",
            true,
        )
        .unwrap_err();
        assert_eq!(error.code, "AUTHORIZATION_CONTRACT_INVALID");
        assert!(!authorization_path(&state).exists());
    }
    #[test]
    fn authorization_scope_drift_invalidates_persisted_authorization() {
        let (local, state, _) = authorization_fixture(authorization_contract_fixture());
        authorize_fixture(&local, &state);
        let package = local.join("docs/60_Operations/work-packages/AUTHORIZATION-WP.md");
        let content = fs::read_to_string(&package).unwrap();
        fs::write(
            &package,
            content.replace("Codex-only migration", "changed scope"),
        )
        .unwrap();
        let evidence = authorization_evidence(&ProductionGitRunner, &local, &state, false).unwrap();
        assert_eq!(
            evidence.blocker.as_deref(),
            Some("AUTHORIZATION_CONTRACT_DRIFT")
        );
        assert!(!evidence.valid);
    }
    #[test]
    fn authorization_allowed_capability_drift_invalidates_persisted_authorization() {
        let (local, state, _) = authorization_fixture(authorization_contract_fixture());
        authorize_fixture(&local, &state);
        let package = local.join("docs/60_Operations/work-packages/AUTHORIZATION-WP.md");
        let content = fs::read_to_string(&package).unwrap();
        fs::write(
            &package,
            content.replace("STANDARD_VALIDATION", "ALTERNATE_VALIDATION"),
        )
        .unwrap();
        let evidence = authorization_evidence(&ProductionGitRunner, &local, &state, false).unwrap();
        assert_eq!(
            evidence.blocker.as_deref(),
            Some("AUTHORIZATION_CONTRACT_DRIFT")
        );
        assert!(!evidence.valid);
    }
    #[test]
    fn authorization_forbidden_capability_drift_invalidates_persisted_authorization() {
        let (local, state, _) = authorization_fixture(authorization_contract_fixture());
        authorize_fixture(&local, &state);
        let package = local.join("docs/60_Operations/work-packages/AUTHORIZATION-WP.md");
        let content = fs::read_to_string(&package).unwrap();
        fs::write(&package, content.replace("FORCE_PUSH", "NO_FORCE_PUSH")).unwrap();
        let evidence = authorization_evidence(&ProductionGitRunner, &local, &state, false).unwrap();
        assert_eq!(
            evidence.blocker.as_deref(),
            Some("AUTHORIZATION_CONTRACT_DRIFT")
        );
        assert!(!evidence.valid);
    }
    #[test]
    fn authorization_branch_mismatch_blocks_start() {
        let (local, state, _) = authorization_fixture(authorization_contract_fixture());
        authorize_fixture(&local, &state);
        git(&local, &["switch", "-c", "authorization-binding-other"]);
        let evidence = authorization_evidence(&ProductionGitRunner, &local, &state, false).unwrap();
        assert_eq!(evidence.blocker.as_deref(), Some("BRANCH_MISMATCH"));
        assert!(!evidence.valid);
    }
    #[test]
    fn authorization_worktree_mismatch_blocks_start() {
        let (local, state, _) = authorization_fixture(authorization_contract_fixture());
        let record = authorize_fixture(&local, &state).record.unwrap();
        write_json(
            &authorization_path(&state),
            &OwnerAuthorizationRecord {
                worktree: "/different/worktree".into(),
                ..record
            },
        )
        .unwrap();
        let evidence = authorization_evidence(&ProductionGitRunner, &local, &state, false).unwrap();
        assert_eq!(evidence.blocker.as_deref(), Some("WORKTREE_MISMATCH"));
        assert!(!evidence.valid);
    }
    #[test]
    fn authorization_authority_drift_blocks_start() {
        let (local, state, _) = authorization_fixture(authorization_contract_fixture());
        let record = authorize_fixture(&local, &state).record.unwrap();
        write_json(
            &authorization_path(&state),
            &OwnerAuthorizationRecord {
                authority_sha: "different-authority".into(),
                ..record
            },
        )
        .unwrap();
        let evidence = authorization_evidence(&ProductionGitRunner, &local, &state, false).unwrap();
        assert_eq!(evidence.blocker.as_deref(), Some("AUTHORITY_DRIFT"));
        assert!(!evidence.valid);
    }
    #[test]
    fn parser_valid_front_matter() {
        let p = temp("wp").join("wp.md");
        fs::write(&p, "---\nschema: aicc-work-package/v1\nid: WP\ntitle: Test\nstatus: CLOSED\nauthority_sha: x\nopenspec_change: x\ndependencies: []\nprevious_run_status: CLOSED\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\nstatus: AUTHORIZED\n").unwrap();
        assert_eq!(parse_package(&p).unwrap().status, "CLOSED");
    }
    #[test]
    fn codex_runtime_without_authorization_fails_closed() {
        let state = temp("codex-runtime");
        let evidence = OwnerAuthorizationEvidence {
            status: "NOT_AUTHORIZED".into(),
            valid: false,
            blocker: Some("OWNER_AUTHORIZATION_REQUIRED".into()),
            record: None,
        };
        let runtime = ManagedCodexRuntime::default()
            .read(&state, &evidence)
            .unwrap();
        assert_eq!(runtime.engine, "Codex App Server");
        assert_eq!(runtime.profile, "sol");
        assert_eq!(runtime.process_state, "NOT_STARTED");
        assert!(!runtime.active_run && !runtime.writer_lock_held);
        assert_eq!(
            runtime.current_phase,
            CodexRuntimePhase::WaitingOwnerAuthorization
        );
        assert_eq!(
            runtime.blocker.as_deref(),
            Some("OWNER_AUTHORIZATION_REQUIRED")
        );
        assert_eq!(runtime.next_action, "AUTHORIZE_WORK_PACKAGE");
    }
    fn start_allowed_runtime() -> CodexRuntimeObserver {
        default_runtime(&OwnerAuthorizationEvidence {
            status: "START_ALLOWED".into(),
            valid: true,
            blocker: None,
            record: Some(OwnerAuthorizationRecord {
                work_package_id: "WP".into(),
                authority_sha: "authority".into(),
                branch: "feature/runtime".into(),
                worktree: "/repo".into(),
                scope: vec!["runtime supervision".into()],
                allowed_capabilities: vec![],
                forbidden_capabilities: vec![],
                authorized_at: "1".into(),
            }),
        })
    }
    #[test]
    fn codex_app_server_protocol_event_produces_real_running_evidence() {
        let runtime = ManagedCodexRuntime::default();
        let mut observer = start_allowed_runtime();
        observer.process_id = Some(4242);
        observer.process_state = "RUNNING".into();
        observer.active_work_package = Some("WP".into());
        observer.current_phase = CodexRuntimePhase::Starting;
        observer.session_state = CodexRuntimePhase::Starting;
        observer.thread_id = Some("thread-1".into());
        observer.session_id = Some("session-1".into());
        let observed = runtime.observe_message(
            observer,
            json!({"method": "turn/started", "params": {"threadId": "thread-1", "turn": {"id": "turn-1", "status": "inProgress", "items": []}}}),
        );
        assert_eq!(observed.current_phase, CodexRuntimePhase::Running);
        assert_eq!(observed.turn_id.as_deref(), Some("turn-1"));
        assert!(observed.active_run && observed.writer_lock_held);
        assert_eq!(observed.current_event.as_deref(), Some("turn/started"));
    }
    #[test]
    fn stale_persisted_runtime_fails_closed_without_managed_process() {
        let state = temp("stale-runtime");
        let mut stale = start_allowed_runtime();
        stale.process_id = Some(4242);
        stale.process_state = "RUNNING".into();
        stale.active_work_package = Some("WP".into());
        stale.current_phase = CodexRuntimePhase::Running;
        stale.session_state = CodexRuntimePhase::Running;
        stale.active_run = true;
        stale.writer_lock_held = true;
        write_json(&runtime_path(&state), &stale).unwrap();
        let authorization = OwnerAuthorizationEvidence {
            status: "START_ALLOWED".into(),
            valid: true,
            blocker: None,
            record: None,
        };
        let runtime = ManagedCodexRuntime::default();
        let observed = runtime.read(&state, &authorization).unwrap();
        assert_eq!(observed.current_phase, CodexRuntimePhase::Failed);
        assert_eq!(observed.process_state, "MISSING");
        assert!(observed.process_id.is_none());
        assert_eq!(
            observed.blocker.as_deref(),
            Some("CODEX_APP_SERVER_PROCESS_MISSING")
        );
        assert!(!observed.active_run && !observed.writer_lock_held);
    }
    #[test]
    fn guard_loading_reconciles_stale_persisted_liveness_before_snapshot() {
        let state = temp("stale-guard-runtime");
        let mut stale = start_allowed_runtime();
        stale.process_id = Some(4242);
        stale.process_state = "RUNNING".into();
        stale.active_work_package = Some("WP".into());
        stale.current_phase = CodexRuntimePhase::Running;
        stale.session_state = CodexRuntimePhase::Running;
        stale.active_run = true;
        stale.writer_lock_held = true;
        write_json(&runtime_path(&state), &stale).unwrap();
        let runtime = ManagedCodexRuntime::default();
        runtime.ensure_loaded(&state).unwrap();
        let guards = runtime.snapshot();
        let observed = runtime.inner.lock().unwrap().observer.clone().unwrap();
        assert!(!guards.active_codex_run && !guards.writer_lock_held);
        assert_eq!(observed.current_phase, CodexRuntimePhase::Failed);
        assert_eq!(observed.process_state, "MISSING");
    }
    #[test]
    fn exited_managed_process_reconciles_exit_status_and_releases_guards() {
        let runtime = ManagedCodexRuntime::default();
        let mut observer = start_allowed_runtime();
        observer.process_state = "RUNNING".into();
        observer.active_work_package = Some("WP".into());
        observer.current_phase = CodexRuntimePhase::Running;
        observer.session_state = CodexRuntimePhase::Running;
        observer.active_run = true;
        observer.writer_lock_held = true;
        let mut child = Command::new("false").spawn().unwrap();
        observer.process_id = Some(child.id());
        child.wait().unwrap();
        {
            let mut manager = runtime.inner.lock().unwrap();
            manager.observer = Some(observer);
            manager.child = Some(child);
        }
        let guards = runtime.snapshot();
        let observed = runtime.inner.lock().unwrap().observer.clone().unwrap();
        assert!(!guards.active_codex_run && !guards.writer_lock_held);
        assert_eq!(observed.process_state, "EXITED");
        assert_eq!(observed.current_phase, CodexRuntimePhase::Failed);
        assert!(observed.exit_status.as_deref().unwrap().contains('1'));
        assert_eq!(observed.blocker.as_deref(), Some("CODEX_APP_SERVER_EXITED"));
    }
    #[test]
    fn active_run_and_writer_lock_guards_follow_runtime_observer() {
        let runtime = ManagedCodexRuntime::default();
        let mut observer = start_allowed_runtime();
        observer.current_phase = CodexRuntimePhase::Running;
        observer.session_state = CodexRuntimePhase::Running;
        observer.active_run = true;
        observer.writer_lock_held = true;
        {
            let mut manager = runtime.inner.lock().unwrap();
            manager.observer = Some(observer);
            manager.child = Some(Command::new("sleep").arg("5").spawn().unwrap());
        }
        let guards = runtime.snapshot();
        assert!(guards.active_codex_run && guards.writer_lock_held);
    }
    #[test]
    fn managed_runtime_guards_block_workspace_sync() {
        let (local, remote) = repo();
        let other = temp("runtime-guard-remote");
        git(&other, &["clone", remote.to_str().unwrap(), "."]);
        git(&other, &["config", "user.name", "AICC Test"]);
        git(
            &other,
            &["config", "user.email", "aicc-test@example.invalid"],
        );
        fs::write(other.join("remote-ahead"), "x").unwrap();
        git(&other, &["add", "."]);
        git(&other, &["commit", "-m", "remote-ahead"]);
        git(&other, &["push", "origin", "main"]);
        let runtime = ManagedCodexRuntime::default();
        let mut observer = start_allowed_runtime();
        observer.current_phase = CodexRuntimePhase::Running;
        observer.session_state = CodexRuntimePhase::Running;
        observer.active_run = true;
        observer.writer_lock_held = true;
        {
            let mut manager = runtime.inner.lock().unwrap();
            manager.observer = Some(observer);
            manager.child = Some(Command::new("sleep").arg("5").spawn().unwrap());
        }
        let service = ControlLoopService {
            runner: ProductionGitRunner,
            guards: LocalControlState { runtime },
            root_path: local,
            production: false,
        };
        let evaluation = service.evaluate_sync().unwrap();
        assert!(!evaluation.allowed);
        assert!(evaluation.blockers.contains(&SyncBlocker::ActiveRun));
        assert!(evaluation.blockers.contains(&SyncBlocker::WriterLocked));
    }
    #[test]
    fn completed_turn_releases_active_run_and_writer_lock() {
        let runtime = ManagedCodexRuntime::default();
        let mut observer = start_allowed_runtime();
        observer.active_work_package = Some("WP".into());
        observer.current_phase = CodexRuntimePhase::Running;
        observer.session_state = CodexRuntimePhase::Running;
        observer.active_run = true;
        observer.writer_lock_held = true;
        let observer = runtime.observe_message(
            observer,
            json!({"method": "turn/started", "params": {"threadId": "thread-1", "turn": {"id": "turn-1", "status": "inProgress", "items": []}}}),
        );
        let observed = runtime.observe_message(
            observer,
            json!({"method": "turn/completed", "params": {"threadId": "thread-1", "turn": {"id": "turn-1", "status": "completed", "items": []}}}),
        );
        assert_eq!(observed.current_phase, CodexRuntimePhase::Idle);
        assert!(!observed.active_run && !observed.writer_lock_held);
        assert!(observed.active_work_package.is_none());
        assert!(runtime.inner.lock().unwrap().turn_started);
    }
    #[test]
    fn unexpected_server_request_blocks_without_faking_a_response() {
        let runtime = ManagedCodexRuntime::default();
        let mut observer = start_allowed_runtime();
        observer.active_work_package = Some("WP".into());
        observer.current_phase = CodexRuntimePhase::Running;
        observer.session_state = CodexRuntimePhase::Running;
        observer.active_run = true;
        observer.writer_lock_held = true;
        let observed = runtime.observe_message(
            observer,
            json!({"id": 91, "method": "item/commandExecution/requestApproval", "params": {}}),
        );
        assert_eq!(observed.current_phase, CodexRuntimePhase::Blocked);
        assert_eq!(
            observed.blocker.as_deref(),
            Some("CODEX_SERVER_REQUEST_UNSUPPORTED")
        );
        assert!(observed.active_run && observed.writer_lock_held);
        assert!(runtime.inner.lock().unwrap().responses.is_empty());
    }
    #[test]
    fn unsupported_controls_return_error_without_mutating_runtime() {
        let runtime = ManagedCodexRuntime::default();
        let observer = start_allowed_runtime();
        runtime.inner.lock().unwrap().observer = Some(observer.clone());
        for action in [
            CodexControlAction::Pause,
            CodexControlAction::Resume,
            CodexControlAction::StopAfterCurrentStep,
        ] {
            assert_eq!(
                unsupported_control(&action).unwrap().code,
                "UNSUPPORTED_CONTROL"
            );
            assert_eq!(
                runtime.inner.lock().unwrap().observer,
                Some(observer.clone())
            );
        }
    }
    #[test]
    fn app_server_launch_and_protocol_methods_are_exact() {
        assert_eq!(codex_app_server_args(), &["-p", "sol", "app-server"]);
        let record = OwnerAuthorizationRecord {
            work_package_id: "WP".into(),
            authority_sha: "authority".into(),
            branch: "feature/runtime".into(),
            worktree: "/repo".into(),
            scope: vec!["runtime supervision".into()],
            allowed_capabilities: vec![],
            forbidden_capabilities: vec![],
            authorized_at: "1".into(),
        };
        assert_eq!(initialize_request()["method"], "initialize");
        assert_eq!(initialized_notification()["method"], "initialized");
        assert_eq!(thread_start_request(&record)["method"], "thread/start");
        assert_eq!(
            thread_start_request(&record)["params"]["sandbox"],
            "workspace-write"
        );
        assert_eq!(
            thread_start_request(&record)["params"]["approvalPolicy"],
            "never"
        );
        assert_eq!(
            turn_start_request("thread-1", &record)["method"],
            "turn/start"
        );
        assert!(supported_codex_controls().contains(&CodexControlAction::Start));
        assert!(!supported_codex_controls().contains(&CodexControlAction::Pause));
    }
    #[test]
    fn codex_runtime_contract_contains_only_bounded_actions() {
        let actions = [
            CodexControlAction::Start,
            CodexControlAction::Pause,
            CodexControlAction::Resume,
            CodexControlAction::StopAfterCurrentStep,
            CodexControlAction::Retry,
        ];
        assert_eq!(actions.len(), 5);
        assert_eq!(
            serde_json::to_string(&CodexRuntimePhase::ReadyForHumanUat).unwrap(),
            "\"READY_FOR_HUMAN_UAT\""
        );
        assert_eq!(
            serde_json::to_string(&CodexControlAction::StopAfterCurrentStep).unwrap(),
            "\"STOP_AFTER_CURRENT_STEP\""
        );
    }
    #[test]
    fn parser_unknown_field_rejects() {
        let p = temp("wp").join("wp.md");
        fs::write(&p, "---\nschema: aicc-work-package/v1\nunknown: x\n---\n").unwrap();
        assert!(parse_package(&p).is_err());
    }
    #[test]
    fn parser_nonzero_front_matter_rejects() {
        let p = temp("wp").join("wp.md");
        fs::write(&p, "text\n---\nschema: x\n---\n").unwrap();
        assert!(parse_package(&p).is_err());
    }
    #[test]
    fn parser_invalid_status_rejects() {
        let p = temp("wp").join("wp.md");
        fs::write(&p, "---\nschema: aicc-work-package/v1\nid: WP\ntitle: T\nstatus: NOPE\nauthority_sha: x\nopenspec_change: x\ndependencies: []\nprevious_run_status: CLOSED\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\n").unwrap();
        assert!(parse_package(&p).is_err());
    }
    #[test]
    fn parser_previous_run_status_closed_is_accepted() {
        let p = temp("wp").join("wp.md");
        fs::write(&p, "---\nschema: aicc-work-package/v1\nid: WP\ntitle: T\nstatus: AUTHORIZED\nauthority_sha: x\nopenspec_change: x\ndependencies: []\nprevious_run_status: CLOSED\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\n").unwrap();
        assert_eq!(parse_package(&p).unwrap().previous_run_status, "CLOSED");
    }
    #[test]
    fn parser_previous_run_status_human_uat_fail_is_accepted() {
        let p = temp("wp").join("wp.md");
        fs::write(&p, "---\nschema: aicc-work-package/v1\nid: WP\ntitle: T\nstatus: AUTHORIZED\nauthority_sha: x\nopenspec_change: x\ndependencies: []\nprevious_run_status: HUMAN_UAT_FAIL\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\n").unwrap();
        assert_eq!(
            parse_package(&p).unwrap().previous_run_status,
            "HUMAN_UAT_FAIL"
        );
    }
    #[test]
    fn parser_malformed_previous_run_status_rejects_with_schema_blocker() {
        let p = temp("wp").join("wp.md");
        fs::write(&p, "---\nschema: aicc-work-package/v1\nid: WP\ntitle: T\nstatus: AUTHORIZED\nauthority_sha: x\nopenspec_change: x\ndependencies: []\nprevious_run_status: NOT_A_LIFECYCLE_STATUS\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\n").unwrap();
        assert_eq!(
            parse_package(&p),
            Err(ResolverBlocker::WorkPackageSchemaInvalid)
        );
    }
    #[test]
    fn parser_valid_planned_not_authorized_record_is_not_schema_invalid() {
        let p = temp("planned-wp").join("wp.md");
        fs::write(&p, "---\nschema: aicc-work-package/v1\nid: PLANNED\ntitle: Planned\nstatus: PLANNED\nauthority_sha: x\nopenspec_change: x\ndependencies: []\nprevious_run_status: HUMAN_UAT_FAIL\nowner_authorization: NOT_AUTHORIZED\n---\n").unwrap();
        let parsed = parse_package(&p).unwrap();
        assert_eq!(parsed.status, "PLANNED");
        assert_eq!(parsed.owner_authorization, "NOT_AUTHORIZED");
    }
    #[test]
    fn living_roadmap_evidence_preserves_current_and_planned_states() {
        let root = temp("roadmap");
        fs::create_dir_all(root.join("docs/10_Planning_Roadmap")).unwrap();
        fs::create_dir_all(root.join("docs/60_Operations/work-packages")).unwrap();
        fs::write(
            root.join("docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md"),
            "# AI Control Center Living Roadmap\n\n## Current milestone\n\n`M2 — Authority And Workspace Control`\n\n## Authority\n\nCurrent Authority: `authority`\n\nClosed Work Packages: `AICC-CLOSED`\n\nCurrent Work Package: `AICC-POST-MERGE-UAT-001-R2`\n\nNext Work Packages: `001B OpenSpec Binding`, `001C Codex Runtime Observer`\n\n## Milestones\n\n### M1 — Visible Foundation\n\nWork Packages:\n`AICC-CLOSED`\n\n### M2 — Authority And Workspace Control\n\nWork Packages:\n`AICC-POST-MERGE-UAT-001-R2`,\n`AICC-CONTROL-LOOP-001B`\n\n### M3 — Runtime\n\nFuture Work Packages:\n`AICC-CONTROL-LOOP-001C`,\n`AICC-CONTROL-LOOP-001D`\n\n## Delivery sequence\n\n1. AICC-CLOSED — closed foundation.\n2. AICC-POST-MERGE-UAT-001-R2 — current Human UAT remediation.\n3. 001B — OpenSpec Binding (planned, owner authorization not authorized).\n\n## Current safety state\n\nThe application remains fail closed.",
        )
        .unwrap();
        let package = "---\nschema: aicc-work-package/v1\nid: AICC-POST-MERGE-UAT-001-R2\ntitle: R2\nstatus: AUTHORIZED\nauthority_sha: authority\nopenspec_change: current\ndependencies: []\nprevious_run_status: HUMAN_UAT_FAIL\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\n";
        let planned = "---\nschema: aicc-work-package/v1\nid: AICC-CONTROL-LOOP-001B\ntitle: Binding\nstatus: PLANNED\nauthority_sha: authority\nopenspec_change: binding\ndependencies: []\nprevious_run_status: CLOSED\nowner_authorization: NOT_AUTHORIZED\n---\n";
        let closed = "---\nschema: aicc-work-package/v1\nid: AICC-CLOSED\ntitle: Closed\nstatus: CLOSED\nauthority_sha: authority\nopenspec_change: closed\ndependencies: []\nprevious_run_status: CLOSED\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\n";
        fs::write(
            root.join("docs/60_Operations/work-packages/AICC-POST-MERGE-UAT-001-R2.md"),
            package,
        )
        .unwrap();
        fs::write(
            root.join("docs/60_Operations/work-packages/AICC-CONTROL-LOOP-001B.md"),
            planned,
        )
        .unwrap();
        fs::write(
            root.join("docs/60_Operations/work-packages/AICC-CLOSED.md"),
            closed,
        )
        .unwrap();
        let evidence = load_roadmap_evidence(&root).unwrap();
        assert_eq!(
            evidence.current_milestone,
            "M2 — Authority And Workspace Control"
        );
        assert_eq!(evidence.current_work_package, "AICC-POST-MERGE-UAT-001-R2");
        assert!(!evidence.milestones.is_empty());
        assert_eq!(evidence.milestones.len(), 3);
        assert!(evidence
            .milestones
            .iter()
            .find(|milestone| milestone.id == "M1")
            .unwrap()
            .work_packages
            .contains(&"AICC-CLOSED".to_string()));
        let runtime_milestone = evidence
            .milestones
            .iter()
            .find(|milestone| milestone.id == "M3")
            .unwrap();
        assert!(runtime_milestone.work_packages.is_empty());
        assert_eq!(
            runtime_milestone.future_items,
            vec![
                "AICC-CONTROL-LOOP-001C".to_string(),
                "AICC-CONTROL-LOOP-001D".to_string()
            ]
        );
        assert_eq!(
            evidence
                .entries
                .iter()
                .find(|entry| entry.id == "AICC-POST-MERGE-UAT-001-R2")
                .unwrap()
                .milestone,
            "M2"
        );
        assert!(evidence.progress_percent > 0);
        assert!(evidence
            .milestones
            .iter()
            .any(|milestone| milestone.progress_percent > 0));
        assert!(evidence
            .entries
            .iter()
            .any(|entry| entry.id == "AICC-CLOSED" && entry.status == "CLOSED"));
        assert!(evidence
            .entries
            .iter()
            .any(|entry| entry.id == "AICC-CONTROL-LOOP-001B"
                && entry.status == "PLANNED"
                && entry.authorization == "NOT_AUTHORIZED"));
        assert!(evidence.entries.iter().any(|entry| {
            entry.id == "AICC-POST-MERGE-UAT-001-R2" && entry.status == "AUTHORIZED"
        }));
    }
    #[test]
    fn roadmap_membership_changes_with_formal_evidence() {
        let root = temp("roadmap-move");
        fs::create_dir_all(root.join("docs/10_Planning_Roadmap")).unwrap();
        fs::create_dir_all(root.join("docs/60_Operations/work-packages")).unwrap();
        let header = "## Current milestone\n\n`M2 — Authority And Workspace Control`\n\nCurrent Authority: `authority`\nCurrent Work Package: `R2`\n\n## Milestones\n\n### M2 — Authority And Workspace Control\n\nWork Packages:\n`R2`\n\n### M3 — Runtime\n\nWork Packages:\n`RUNTIME`\n";
        fs::write(
            root.join("docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md"),
            header,
        )
        .unwrap();
        let r2 = "---\nschema: aicc-work-package/v1\nid: R2\ntitle: R2\nstatus: AUTHORIZED\nauthority_sha: authority\nopenspec_change: r2\ndependencies: []\nprevious_run_status: HUMAN_UAT_FAIL\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\n";
        let runtime = "---\nschema: aicc-work-package/v1\nid: RUNTIME\ntitle: Runtime\nstatus: PLANNED\nauthority_sha: authority\nopenspec_change: runtime\ndependencies: []\nprevious_run_status: CLOSED\nowner_authorization: NOT_AUTHORIZED\n---\n";
        fs::write(root.join("docs/60_Operations/work-packages/R2.md"), r2).unwrap();
        fs::write(
            root.join("docs/60_Operations/work-packages/RUNTIME.md"),
            runtime,
        )
        .unwrap();
        let first = load_roadmap_evidence(&root).unwrap();
        assert_eq!(first.entries[0].milestone, "M2");
        let moved_header = "## Current milestone\n\n`M2 — Authority And Workspace Control`\n\n## Authority\n\nCurrent Authority: `authority`\nCurrent Work Package: `R2`\n\n## Milestones\n\n### M2 — Authority And Workspace Control\n\nWork Packages:\n`RUNTIME`\n\n### M3 — Runtime\n\nWork Packages:\n`R2`";
        fs::write(
            root.join("docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md"),
            moved_header,
        )
        .unwrap();
        let moved = load_roadmap_evidence(&root).unwrap();
        assert_eq!(moved.entries[0].milestone, "M3");
    }
    #[test]
    fn malformed_or_missing_milestone_evidence_fails_closed() {
        let root = temp("roadmap-invalid");
        fs::create_dir_all(root.join("docs/10_Planning_Roadmap")).unwrap();
        fs::create_dir_all(root.join("docs/60_Operations/work-packages")).unwrap();
        fs::write(
            root.join("docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md"),
            "## Current milestone\n\n`M2`\n\n## Authority\n\nCurrent Work Package: `R2`\n\n## Milestones\n\n### M2 — Control\n\nWork Packages:\n`MISSING`",
        )
        .unwrap();
        assert_eq!(
            load_roadmap_evidence(&root).unwrap_err().code,
            "ROADMAP_HIERARCHY_INVALID"
        );
    }
    #[test]
    fn resolver_preserves_valid_unauthorized_package_without_schema_blocker() {
        let (local, _) = repo();
        git(&local, &["switch", "-c", "candidate"]);
        fs::create_dir_all(local.join("docs/60_Operations/work-packages")).unwrap();
        fs::write(
            local.join("docs/60_Operations/work-packages/planned.md"),
            "---\nschema: aicc-work-package/v1\nid: PLANNED\ntitle: Planned\nstatus: PLANNED\nauthority_sha: x\nopenspec_change: planned-change\ndependencies: []\nprevious_run_status: HUMAN_UAT_FAIL\nowner_authorization: NOT_AUTHORIZED\n---\n",
        )
        .unwrap();
        let result = resolve(
            &ProductionGitRunner,
            &local,
            false,
            &ExecutionGuardSnapshot::default(),
        )
        .unwrap();
        assert!(result
            .blockers
            .contains(&ResolverBlocker::WorkPackageNotAuthorized));
        assert!(!result
            .blockers
            .contains(&ResolverBlocker::WorkPackageSchemaInvalid));
    }
    #[test]
    fn parser_prose_cannot_override_status() {
        let p = temp("wp").join("wp.md");
        fs::write(&p, "---\nschema: aicc-work-package/v1\nid: WP\ntitle: T\nstatus: CLOSED\nauthority_sha: x\nopenspec_change: x\ndependencies: []\nprevious_run_status: CLOSED\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\nstatus: AUTHORIZED\n").unwrap();
        assert_eq!(parse_package(&p).unwrap().status, "CLOSED");
    }
    #[test]
    fn security_no_dangerous_git_operation() {
        for op in [
            GitOperation::ShowTopLevel,
            GitOperation::GetOriginUrl,
            GitOperation::CurrentBranch,
            GitOperation::HeadSha,
            GitOperation::LocalMainSha,
            GitOperation::WorktreeStatus,
            GitOperation::RemoteMainSha,
            GitOperation::FetchedOriginMainSha,
            GitOperation::FetchOriginMain,
            GitOperation::SwitchMain,
            GitOperation::MergeOriginMainFastForwardOnly,
        ] {
            assert!(!git_args(op)
                .iter()
                .any(|a| ["reset", "clean", "rebase", "push", "sh", "bash"].contains(a)));
        }
    }
    #[test]
    fn security_redacts_credentials_and_path() {
        let out = redact("https://user:password@example.invalid/Users/a/AI/007/AIcontrolcenter");
        assert!(!out.contains("password") && !out.contains(CANONICAL_PATH));
    }
    #[test]
    fn security_output_cap_defined() {
        assert_eq!(MAX_OUTPUT, 64 * 1024);
    }
    #[test]
    fn evaluation_does_not_mutate_input() {
        let (local, _) = repo();
        let i = identity(&ProductionGitRunner, &local, false).unwrap();
        let before = i.worktree_entries.clone();
        let a = authority(&ProductionGitRunner, &local, false);
        let _ = evaluate(&i, &a, &ExecutionGuardSnapshot::default());
        assert_eq!(i.worktree_entries, before);
    }
    #[test]
    fn no_origin_authority_is_unavailable() {
        let (local, _) = repo();
        git(&local, &["remote", "remove", "origin"]);
        assert_eq!(
            authority(&ProductionGitRunner, &local, false).status,
            AuthorityStatus::RemoteUnavailable
        );
    }
    #[test]
    fn fetched_operation_is_exact() {
        assert_eq!(
            git_args(GitOperation::FetchedOriginMainSha),
            &["rev-parse", "refs/remotes/origin/main"]
        );
    }
    fn write_resolver_fixture(root: &Path, authority_sha: &str, dependency: &str) {
        let packages = root.join("docs/60_Operations/work-packages");
        fs::create_dir_all(&packages).unwrap();
        fs::write(
            packages.join("candidate.md"),
            format!(
                "---\nschema: aicc-work-package/v1\nid: CANDIDATE\ntitle: Candidate\nstatus: AUTHORIZED\nauthority_sha: {authority_sha}\nopenspec_change: candidate-change\ndependencies: {dependency}\nprevious_run_status: CLOSED\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\n"
            ),
        )
        .unwrap();
        let change = root.join("openspec/changes/candidate-change");
        fs::create_dir_all(change.join("specs/capability")).unwrap();
        for file in ["proposal.md", "design.md", "tasks.md"] {
            fs::write(change.join(file), "complete\n").unwrap();
        }
        fs::write(change.join("specs/capability/spec.md"), "complete\n").unwrap();
    }
    #[test]
    fn resolver_starts_single_authorized_complete_temporary_work_package() {
        let (local, _) = repo();
        let remote = authority(&ProductionGitRunner, &local, false)
            .remote_main_sha
            .unwrap();
        git(&local, &["switch", "-c", "candidate"]);
        write_resolver_fixture(&local, &remote, "[]");
        git(&local, &["add", "docs", "openspec"]);
        git(&local, &["commit", "-m", "resolver-fixture"]);
        let result = resolve(
            &ProductionGitRunner,
            &local,
            false,
            &ExecutionGuardSnapshot::default(),
        )
        .unwrap();
        assert_eq!(result.decision, ResolverDecision::StartAllowed);
        assert_eq!(result.work_package.unwrap().id, "CANDIDATE");
        assert!(result.blockers.is_empty());
    }
    #[test]
    fn resolver_blocks_temporary_work_package_with_unclosed_dependency() {
        let (local, _) = repo();
        let remote = authority(&ProductionGitRunner, &local, false)
            .remote_main_sha
            .unwrap();
        git(&local, &["switch", "-c", "candidate"]);
        write_resolver_fixture(&local, &remote, "\n  - id: MISSING\n    status: CLOSED");
        git(&local, &["add", "docs", "openspec"]);
        git(&local, &["commit", "-m", "resolver-fixture"]);
        let result = resolve(
            &ProductionGitRunner,
            &local,
            false,
            &ExecutionGuardSnapshot::default(),
        )
        .unwrap();
        assert_eq!(result.decision, ResolverDecision::Blocked);
        assert!(result
            .blockers
            .contains(&ResolverBlocker::DependencyNotClosed));
    }
    struct FakeRunner {
        operation: GitOperation,
        output: GitOutput,
        fail: bool,
    }
    impl FakeRunner {
        fn with(operation: GitOperation, stdout: &str, stderr: &str) -> Self {
            Self {
                operation,
                output: GitOutput {
                    stdout: stdout.into(),
                    stderr: stderr.into(),
                },
                fail: false,
            }
        }
        fn failing(operation: GitOperation) -> Self {
            Self {
                operation,
                output: GitOutput {
                    stdout: String::new(),
                    stderr: "failure".into(),
                },
                fail: true,
            }
        }
    }
    impl GitRunner for FakeRunner {
        fn run(&self, root: &Path, operation: GitOperation) -> Result<GitOutput, ControlLoopError> {
            if self.fail && operation == self.operation {
                return Err(err("FAKE_FAILURE", &self.output.stderr));
            }
            if operation == self.operation {
                return Ok(self.output.clone());
            }
            match operation {
                GitOperation::ShowTopLevel => Ok(GitOutput {
                    stdout: root.display().to_string(),
                    stderr: String::new(),
                }),
                GitOperation::WorktreeStatus => Ok(GitOutput {
                    stdout: String::new(),
                    stderr: String::new(),
                }),
                _ => Err(err("FAKE_MISSING", "missing fake operation")),
            }
        }
    }
}
