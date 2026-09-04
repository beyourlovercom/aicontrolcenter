import type {AiccStatus,RoadmapNode,RoadmapPresentationGroup} from '../workflow.ts';
import type {ProgressTruthState} from './progressTruth.ts';

export type SelectedEntityRef=
  | {type:'milestone';id:string}
  | {type:'work_package';id:string}
  | {type:'phase';id:string}
  | {type:'pull_request';id:string};

export type SourceAvailability='AVAILABLE'|'UNAVAILABLE';
export type SourceValue<T>={availability:SourceAvailability;value:T|null;errorCode?:string};
export type FormalizationState='PLANNED_ONLY'|'FORMAL_READY'|'FORMAL_INVALID';
export type RepositoryState={repository:string;branch:string;head:string;localMain:string;remoteMain:string;worktree:'CLEAN'|'DIRTY'|'UNAVAILABLE';lastCommit:string};
export type RoadmapSyncStatus='SYNCED'|'LOCAL_AHEAD'|'GITHUB_AHEAD'|'DIVERGED';
export type RoadmapProgressSource='Local'|'GitHub'|'Local + GitHub'|'Local / GitHub';
export type RoadmapEvidence={content:string;workPackages?:Record<string,FormalWorkPackage>;phaseEvidence?:Record<string,string>};
export type RoadmapSyncState={localEvidence:RoadmapEvidence;githubEvidence:RoadmapEvidence|null;syncStatus:RoadmapSyncStatus;currentProgressSource:RoadmapProgressSource;updatedAt:string};
export type FormalWorkPackage={id:string;title:string;source:string;fields:Record<string,string>;sections:Record<string,string>};
export type WorkPackagePhaseStatus='COMPLETE'|'ACTIVE'|'PENDING';
export type WorkPackagePhase={number:number;title:string;status:WorkPackagePhaseStatus};
export type WorkPackagePhaseProgress={workPackageId:string;milestoneId:string;totalPhases:number;completedCount:number;currentPhaseNumber:number|null;currentPhaseTitle:string|null;phases:WorkPackagePhase[]};
export type AuthorizationRecord={authorizationId:string;workPackageId:string;authoritySha:string;branch:string;headShaAtAuthorization:string;repositoryRoot:string;authorizedAt:string;status?:string};
export type CodexResult='PASS'|'FAIL'|'BLOCKED'|'CANCELLED'|'NOT_STARTED';
export type ReturnState='RESULT_READY'|'RETURN_SUBMITTING'|'RETURNED_TO_GPT'|'CLOSED'|'DELIVERY_FAILED';
/** Result text is Codex-owned verbatim evidence. Legacy semantic fields are read-only compatibility data and are never generated for new results. */
export type CanonicalExecutionResult={version:'AICC_EXECUTION_RESULT_V1';executionId:string;projectId:string;repositoryIdentity:string;repositoryPath?:string;instructionId?:string;originConversationId?:string;originMessageId?:string;originBlockId?:string;aiccStatus?:'RESULT_RECEIVED';codexResult?:CodexResult;codexReason?:string;rawResult:string;receivedAt:string;resultId:string;resultHash:string;returnState?:ReturnState;returnAttemptedAt?:string;returnedAt?:string;returnFailure?:string};
export type RuntimeRecord={runId:string;projectId:string;repositoryIdentity:string;repositoryPath?:string;workPackageId:string|null;entityType?:'global_task'|'work_package'|'pull_request';entityId?:string;parentWorkPackageId?:string;authorizationId:string;authoritySha:string;branch:string;startingHeadSha:string;pid:number|null;pidAlive?:boolean;processAlive?:boolean;supervisorPid?:number|null;supervisorPidAlive?:boolean;ptySessionId?:string;terminalSequence?:number;terminalFirstSequence?:number;terminalChunks?:string[];terminalTruncated?:boolean;terminalStartedAt?:string;terminalUpdatedAt?:string;terminalClosedAt?:string;processExitedAt?:string;processClosedAt?:string;processExitObserved?:boolean;processCloseObserved?:boolean;processSignal?:string|null;spawnArgv?:string[];spawnExecutable?:string;spawnCwd?:string;spawnedAt?:string;model?:string;requestedModel?:string;resolvedModel?:string;reasoningLevel?:string;worktreePath?:string;threadId:string|null;phase:string;currentTask:string;latestEvent:string;startedAt:string;lastActivityAt:string;events?:string[];startupTransitions?:string[];healthWarning?:string;agentMessageCount?:number;commandExecutionCount?:number;fileChangeEventCount?:number;toolCallCount?:number;errorEventCount?:number;executionType?:string;sandboxMode?:string;executionProfile?:'OWNER_AUTHORIZED_GIT_DELIVERY';authorizedHead?:string;postRunHead?:string;changedFiles?:string[];codeChangePresent?:boolean;implementationResult?:string;stderr?:string;finalAgentMessage?:string;canonicalResult?:CanonicalExecutionResult;exitCode?:number|null;completedAt?:string;failure?:string;instructionText?:string;instructionId?:string;originConversationId?:string;originMessageId?:string;originBlockId?:string;outputMode?:'json'|'human';finalMessagePath?:string;finalMessageReadAt?:string;finalMessageReadFailure?:string};
export type HumanUatItemState='PENDING'|'PASS'|'FAIL'|'N_A';
export type HumanUatPlanItem={id:string;roundId:string;round:string;order:number;title:string;instruction:string;passCriteria:string};
export type HumanUatItem={id:string;title:string;description:string;state:HumanUatItemState;note?:string;ownerNote?:string;evidence?:string[];roundId?:string;round?:string;instruction?:string;passCriteria?:string};
export type HumanUatRecord={repository:string;workPackageId:string;entityType:'work_package'|'pull_request';entityId?:string;parentWorkPackageId?:string;prIdentity?:string;status:'NOT_STARTED'|'IN_PROGRESS'|'NEEDS_REMEDIATION'|'PASS';ownerLabel?:string;items:HumanUatItem[];overallNote?:string;decision?:'PASS';decisionMode?:'ITEMIZED_PASS'|'OWNER_OVERRIDE_PASS';decisionCode?:'ITEMIZED_PASS'|'OWNER_OVERRIDE_PASS';createdAt:string;updatedAt:string;finalDecisionAt?:string;source:string};
export type PhaseEvidenceRecord={phaseNumber:number;phaseTitle:string;status:WorkPackagePhaseStatus;evidenceType:'CODEX_AUDIT';evidenceSource:string;recordedAt:string;reason:string;executionReference?:string;resultReference?:string;implemented:'YES'|'NO';machineValidated:'YES'|'NO';ownerUat:'PASS'|'PENDING'|'NOT_APPLICABLE'};
export type LifecycleEvidenceRecord={repository:string;workPackageId:string;implementation:{status:'COMPLETE'|'FAILED';commitSha?:string;source?:'VERIFIED_EXISTING_CHECKPOINT';recordedAt:string};validation:{status:'COMPLETE'|'FAILED';checks:string[];recordedAt:string};phaseEvidence?:PhaseEvidenceRecord[];closure?:{status:'COMPLETE';recordedAt:string;source:string};};
export type WriterLockState={status:'HELD'|'NOT_HELD'|'UNAVAILABLE';scope:'repository';workPackageId?:string|null};
export type PullRequestRecord={id:string;workPackageId?:string;status:AiccStatus;progress?:number;number?:number;title?:string;repository?:string;url?:string;sourceBranch?:string;targetBranch?:string;deliveryBranch?:string;deliveryHeadSha?:string;prIdentity?:string;headSha?:string;state?:'DRAFT'|'OPEN'|'CLOSED'|'MERGED';draft?:boolean;createdAt?:string;updatedAt?:string;mergeState?:string;correlatedBranch?:string;correlatedWorktree?:string;latestCommit?:string;commitEvidence?:string;reviewEvidence?:string;ciEvidence?:string;filesChanged?:number;mergeability?:string;mergeResult?:string;mainVerification?:string;lifecycleGateStates?:Record<string,string>;fixture?:boolean;correlationSource?:'FORMAL_WP'|'EXTERNAL_FACT'|'UNKNOWN'};
import type {CiEvidence,ExactHeadValidation,ReviewEvidence} from '../exactHeadEvidence.ts';
import type {PrLifecycleWorkspace} from '../prLifecycleWorkspace.ts';
import type {PrLayer2Record} from '../prCanonicalProjection.ts';

export type AiccProjectSnapshot={
  roadmap:SourceValue<RoadmapNode[]>;
  repository:SourceValue<RepositoryState>;
  formalWorkPackages:SourceValue<Record<string,FormalWorkPackage>>;
  authorizations:SourceValue<AuthorizationRecord[]>;
  runtime:SourceValue<RuntimeRecord|null>;
  writerLock:SourceValue<WriterLockState>;
  humanUat:SourceValue<HumanUatRecord[]>;
  lifecycleEvidence:SourceValue<LifecycleEvidenceRecord[]>;
  pullRequests:SourceValue<PullRequestRecord[]>;
  roadmapSource:string; roadmapSync:RoadmapSyncState; formalWorkPackageReadError?:string;
  progressTruth:Record<string,ProgressTruthState>; reviewEvidence:SourceValue<ReviewEvidence[]>; ciEvidence:SourceValue<CiEvidence[]>;
};

export type LifecycleStage={id:string;label:string;status:AiccStatus;evidence:string[];startedAt?:string;completedAt?:string;reasonCode?:string};
export type WorkPackageLifecycle={currentStage:string;effectiveStatus:AiccStatus;stages:LifecycleStage[]};
export type AuthorizationEffectiveState='NONE'|'VALID'|'STALE_HEAD'|'STALE_BRANCH'|'CONTEXT_MISMATCH'|'CONFLICT'|'UNAVAILABLE';
export type ResolvedAuthorization={state:AuthorizationEffectiveState;record:AuthorizationRecord|null;reasonCode?:string};
export type ActionId='REFRESH'|'AUTHORIZE'|'START_CODEX'|'STOP_CODEX'|'RETRY'|'SAFE_MAIN_SYNC'|'PR_CREATE_DRAFT'|'PR_OPEN'|'PR_START_CODEX'|'PR_RETRY'|'PR_STOP'|'PR_APPROVE_MERGE';
export type ActionEligibility={id:ActionId;visible:boolean;enabled:boolean;reasonCode?:string;reasonLabel?:string};

type ContextBase={entity:SelectedEntityRef;type:SelectedEntityRef['type'];id:string;title:string;displayTitle:string;status:AiccStatus;statusLabel:string;progress:number|null;breadcrumb:string;evidence:string[];availableActions:ActionEligibility[]};
export type MilestoneEntityContext=ContextBase&{type:'milestone';entity:{type:'milestone';id:string};goal:string;dependencies:string;children:RoadmapNode[];roadmapGroups:readonly RoadmapPresentationGroup[];phaseProgress?:WorkPackagePhaseProgress|null;summary:{workPackages:number;complete:number;waiting:number;blocked:number;pullRequests:number};blockers:string[];nextAction:string;recentActivity:string};
export type WorkPackageEntityContext=ContextBase&{type:'work_package';entity:{type:'work_package';id:string};parentMilestone:RoadmapNode|null;formalization:FormalizationState;formalWorkPackage:FormalWorkPackage|null;lifecycle:WorkPackageLifecycle;phaseProgress:WorkPackagePhaseProgress|null;authorization:ResolvedAuthorization;runtime:RuntimeRecord|null;writerLock:WriterLockState;humanUat:HumanUatRecord|null;relatedPullRequests:PullRequestRecord[]};
export type PullRequestEntityContext=ContextBase&{type:'pull_request';entity:{type:'pull_request';id:string};parentWorkPackageId:string|null;record:PullRequestRecord|null;prProjection:PrLayer2Record|null;runtime:RuntimeRecord|null;stages:LifecycleStage[];currentStage:string;tabs:string[];exactHeadValidation?:ExactHeadValidation|null;lifecycleWorkspace:PrLifecycleWorkspace};
export type PhaseEntityContext=ContextBase&{type:'phase';entity:{type:'phase';id:string};parentWorkPackageId:string|null;phaseNumber:number|null};
export type ResolvedEntityContext=MilestoneEntityContext|WorkPackageEntityContext|PhaseEntityContext|PullRequestEntityContext;
