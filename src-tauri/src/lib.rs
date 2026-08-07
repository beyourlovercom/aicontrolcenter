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
#[derive(Debug, Deserialize, Serialize, Clone, Default, PartialEq, Eq)]
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
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoadmapEntry {
    pub id: String,
    pub title: String,
    pub status: String,
    pub authorization: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoadmapEvidence {
    pub current_milestone: String,
    pub authority_sha: String,
    pub current_work_package: String,
    pub closed_work_packages: Vec<String>,
    pub next_work_packages: Vec<String>,
    pub progress_percent: u8,
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
pub struct LocalControlState;
impl GuardProvider for LocalControlState {
    fn snapshot(&self) -> ExecutionGuardSnapshot {
        ExecutionGuardSnapshot::default()
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
    if blockers.is_empty() {
        if identity.local_main_sha == authority.remote_main_sha {
            blockers.push(SyncBlocker::SyncNotRequired);
        } else {
            blockers.push(SyncBlocker::SyncRequired);
        }
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
    let packages_root = root.join("docs/60_Operations/work-packages");
    let mut entries = Vec::new();
    for entry in fs::read_dir(packages_root).map_err(|_| {
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
            entries.push(RoadmapEntry {
                id: package.id,
                title: package.title,
                status: package.status,
                authorization: package.owner_authorization,
            });
        }
    }
    entries.sort_by(|left, right| left.id.cmp(&right.id));
    let total = entries.len().max(1);
    let closed = entries
        .iter()
        .filter(|entry| entry.status == "CLOSED")
        .count();
    Ok(RoadmapEvidence {
        current_milestone,
        authority_sha,
        current_work_package,
        closed_work_packages,
        next_work_packages,
        progress_percent: ((closed * 100) / total) as u8,
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
    let mut records = HashMap::new();
    let mut candidates = vec![];
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
                if p.status == "AUTHORIZED" {
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

fn production_service() -> ControlLoopService<ProductionGitRunner, LocalControlState> {
    ControlLoopService {
        runner: ProductionGitRunner,
        guards: LocalControlState,
        root_path: PathBuf::from(CANONICAL_PATH),
        production: true,
    }
}
#[tauri::command]
fn read_repository_identity() -> Result<RepositoryIdentity, ControlLoopError> {
    production_service().read_identity()
}
#[tauri::command]
fn check_remote_authority() -> Result<RemoteAuthority, ControlLoopError> {
    production_service().check_authority()
}
#[tauri::command]
fn evaluate_workspace_sync() -> Result<WorkspaceSyncEvaluation, ControlLoopError> {
    production_service().evaluate_sync()
}
#[tauri::command]
fn sync_workspace(confirmed: bool) -> Result<WorkspaceSyncResult, ControlLoopError> {
    production_service().sync(confirmed)
}
#[tauri::command]
fn resolve_next_work_package() -> Result<ResolverDecisionResult, ControlLoopError> {
    let service = production_service();
    let root = service.root()?;
    resolve(&service.runner, &root, true, &service.guards.snapshot())
}
#[tauri::command]
fn read_roadmap_evidence() -> Result<RoadmapEvidence, ControlLoopError> {
    let service = production_service();
    let root = service.root()?;
    load_roadmap_evidence(&root)
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_repository_identity,
            check_remote_authority,
            evaluate_workspace_sync,
            sync_workspace,
            resolve_next_work_package,
            read_roadmap_evidence
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
            guards: LocalControlState,
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
            guards: LocalControlState,
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
            guards: LocalControlState,
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
            guards: LocalControlState,
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
            guards: LocalControlState,
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
    fn parser_valid_front_matter() {
        let p = temp("wp").join("wp.md");
        fs::write(&p, "---\nschema: aicc-work-package/v1\nid: WP\ntitle: Test\nstatus: CLOSED\nauthority_sha: x\nopenspec_change: x\ndependencies: []\nprevious_run_status: CLOSED\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\nstatus: AUTHORIZED\n").unwrap();
        assert_eq!(parse_package(&p).unwrap().status, "CLOSED");
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
            "## Current milestone\n\n`M2 — Authority And Workspace Control`\n\nCurrent Authority: `authority`\nClosed Work Packages: `AICC-001A`\nCurrent Work Package: `AICC-CURRENT`\nNext Work Packages: `001B OpenSpec Binding`",
        )
        .unwrap();
        let package = "---\nschema: aicc-work-package/v1\nid: AICC-CURRENT\ntitle: Current\nstatus: AUTHORIZED\nauthority_sha: authority\nopenspec_change: current\ndependencies: []\nprevious_run_status: CLOSED\nowner_authorization: AUTHORIZED_FOR_IMPLEMENTATION\n---\n";
        let planned = "---\nschema: aicc-work-package/v1\nid: AICC-CONTROL-LOOP-001B\ntitle: Binding\nstatus: PLANNED\nauthority_sha: authority\nopenspec_change: binding\ndependencies: []\nprevious_run_status: CLOSED\nowner_authorization: NOT_AUTHORIZED\n---\n";
        fs::write(
            root.join("docs/60_Operations/work-packages/current.md"),
            package,
        )
        .unwrap();
        fs::write(
            root.join("docs/60_Operations/work-packages/planned.md"),
            planned,
        )
        .unwrap();
        let evidence = load_roadmap_evidence(&root).unwrap();
        assert_eq!(
            evidence.current_milestone,
            "M2 — Authority And Workspace Control"
        );
        assert_eq!(evidence.current_work_package, "AICC-CURRENT");
        assert!(evidence
            .entries
            .iter()
            .any(|entry| entry.id == "AICC-CONTROL-LOOP-001B"
                && entry.status == "PLANNED"
                && entry.authorization == "NOT_AUTHORIZED"));
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
