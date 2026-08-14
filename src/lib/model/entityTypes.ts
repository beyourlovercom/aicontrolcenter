import type {AiccStatus,RoadmapNode} from '../workflow.ts';

export type SelectedEntityRef=
  | {type:'milestone';id:string}
  | {type:'work_package';id:string}
  | {type:'pull_request';id:string};

export type SourceAvailability='AVAILABLE'|'UNAVAILABLE';
export type SourceValue<T>={availability:SourceAvailability;value:T|null;errorCode?:string};
export type FormalizationState='PLANNED_ONLY'|'FORMAL_READY'|'FORMAL_INVALID';
export type RepositoryState={repository:string;branch:string;head:string;localMain:string;remoteMain:string;worktree:'CLEAN'|'DIRTY'|'UNAVAILABLE';lastCommit:string};
export type FormalWorkPackage={id:string;title:string;source:string;fields:Record<string,string>;sections:Record<string,string>};
export type AuthorizationRecord={authorizationId:string;workPackageId:string;authoritySha:string;branch:string;headShaAtAuthorization:string;repositoryRoot:string;authorizedAt:string;status?:string};
export type RuntimeRecord={runId:string;workPackageId:string;authorizationId:string;authoritySha:string;branch:string;startingHeadSha:string;pid:number|null;pidAlive?:boolean;threadId:string|null;phase:string;currentTask:string;latestEvent:string;startedAt:string;lastActivityAt:string;events?:string[];agentMessageCount?:number;commandExecutionCount?:number;fileChangeEventCount?:number;toolCallCount?:number;errorEventCount?:number;executionType?:string;sandboxMode?:string;executionProfile?:'OWNER_AUTHORIZED_GIT_DELIVERY';authorizedHead?:string;postRunHead?:string;changedFiles?:string[];codeChangePresent?:boolean;implementationResult?:string;stderr?:string;finalAgentMessage?:string;exitCode?:number|null;completedAt?:string;failure?:string;instructionText?:string};
export type HumanUatItemState='PENDING'|'PASS'|'FAIL'|'N_A';
export type HumanUatPlanItem={id:string;roundId:string;round:string;order:number;title:string;instruction:string;passCriteria:string};
export type HumanUatItem={id:string;title:string;description:string;state:HumanUatItemState;note?:string;ownerNote?:string;evidence?:string[];roundId?:string;round?:string;instruction?:string;passCriteria?:string};
export type HumanUatRecord={repository:string;workPackageId:string;entityType:'work_package';status:'NOT_STARTED'|'IN_PROGRESS'|'NEEDS_REMEDIATION'|'PASS';ownerLabel?:string;items:HumanUatItem[];overallNote?:string;decision?:'PASS';decisionMode?:'ITEMIZED_PASS'|'OWNER_OVERRIDE_PASS';decisionCode?:'ITEMIZED_PASS'|'OWNER_OVERRIDE_PASS';createdAt:string;updatedAt:string;finalDecisionAt?:string;source:string};
export type LifecycleEvidenceRecord={repository:string;workPackageId:string;implementation:{status:'COMPLETE'|'FAILED';commitSha?:string;source?:'VERIFIED_EXISTING_CHECKPOINT';recordedAt:string};validation:{status:'COMPLETE'|'FAILED';checks:string[];recordedAt:string};closure?:{status:'COMPLETE';recordedAt:string;source:string};};
export type WriterLockState={status:'HELD'|'NOT_HELD'|'UNAVAILABLE';scope:'repository';workPackageId?:string};
export type PullRequestRecord={id:string;workPackageId:string;status:AiccStatus;number?:number;title?:string;repository?:string;url?:string;sourceBranch?:string;targetBranch?:string;headSha?:string;state?:'DRAFT'|'OPEN'|'CLOSED'|'MERGED';draft?:boolean;createdAt?:string;updatedAt?:string;mergeState?:string;correlatedBranch?:string;correlatedWorktree?:string;latestCommit?:string;commitEvidence?:string;reviewEvidence?:string;ciEvidence?:string;filesChanged?:number;mergeability?:string;mergeResult?:string;mainVerification?:string;fixture?:boolean;correlationSource?:'FORMAL_WP'|'EXTERNAL_FACT'|'UNKNOWN'};

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
  roadmapSource:string; formalWorkPackageReadError?:string;
};

export type LifecycleStage={id:string;label:string;status:AiccStatus;evidence:string[];startedAt?:string;completedAt?:string;reasonCode?:string};
export type WorkPackageLifecycle={currentStage:string;effectiveStatus:AiccStatus;stages:LifecycleStage[]};
export type AuthorizationEffectiveState='NONE'|'VALID'|'STALE_HEAD'|'STALE_BRANCH'|'CONTEXT_MISMATCH'|'CONFLICT'|'UNAVAILABLE';
export type ResolvedAuthorization={state:AuthorizationEffectiveState;record:AuthorizationRecord|null;reasonCode?:string};
export type ActionId='REFRESH'|'AUTHORIZE'|'START_CODEX'|'STOP_CODEX'|'RETRY'|'SAFE_MAIN_SYNC'|'PR_CREATE_DRAFT'|'PR_OPEN'|'PR_START_CODEX'|'PR_RETRY'|'PR_STOP'|'PR_APPROVE_MERGE';
export type ActionEligibility={id:ActionId;visible:boolean;enabled:boolean;reasonCode?:string;reasonLabel?:string};

type ContextBase={entity:SelectedEntityRef;type:SelectedEntityRef['type'];id:string;title:string;displayTitle:string;status:AiccStatus;statusLabel:string;progress:number|null;breadcrumb:string;evidence:string[];availableActions:ActionEligibility[]};
export type MilestoneEntityContext=ContextBase&{type:'milestone';entity:{type:'milestone';id:string};goal:string;dependencies:string;children:RoadmapNode[];summary:{workPackages:number;complete:number;waiting:number;blocked:number;pullRequests:number};blockers:string[];nextAction:string;recentActivity:string};
export type WorkPackageEntityContext=ContextBase&{type:'work_package';entity:{type:'work_package';id:string};parentMilestone:RoadmapNode|null;formalization:FormalizationState;formalWorkPackage:FormalWorkPackage|null;lifecycle:WorkPackageLifecycle;authorization:ResolvedAuthorization;runtime:RuntimeRecord|null;writerLock:WriterLockState;humanUat:HumanUatRecord|null;relatedPullRequests:PullRequestRecord[]};
export type PullRequestEntityContext=ContextBase&{type:'pull_request';entity:{type:'pull_request';id:string};parentWorkPackageId:string|null;record:PullRequestRecord|null;stages:LifecycleStage[];currentStage:string;tabs:string[]};
export type ResolvedEntityContext=MilestoneEntityContext|WorkPackageEntityContext|PullRequestEntityContext;
