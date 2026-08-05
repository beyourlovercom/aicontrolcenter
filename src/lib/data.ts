export type WorkItem = {
  key: string;
  id: string;
  title: string;
  summary: string;
  status: 'CURRENT' | 'PLANNED' | 'BLOCKED' | 'DEFERRED';
  gate: string;
  authorization: string;
  progress: string;
  progressPercent: number;
  parent: string;
  dependency: string;
  change: string;
  path: string;
  spec: string;
  task: string;
  run: string;
  criteria: string[];
};

export type RoadmapPhase = {
  key: string;
  label: string;
  subtitle: string;
  icon: string;
  items: WorkItem[];
};

export const roadmap: RoadmapPhase[] = [
  {
    key: 'foundation',
    label: 'Phase 1 · Foundation',
    subtitle: '首版可见与只读基础',
    icon: 'P1',
    items: [
      {
        key: 'bootstrap',
        id: 'AICC-BOOTSTRAP-001',
        title: 'Repository Bootstrap',
        summary: '建立最小 Tauri 桌面壳、基础工程配置和只读安全边界。',
        status: 'PLANNED',
        gate: 'PREFLIGHT',
        authorization: 'WORK PACKAGE CANDIDATE',
        progress: '0 / 6',
        progressPercent: 4,
        parent: 'Phase 1 · Foundation',
        dependency: 'Project Charter',
        change: 'aicc-bootstrap-001',
        path: 'docs/60_Operations/work-packages/AICC-BOOTSTRAP-001.md',
        spec: '4/4', task: '0/6', run: 'OFF',
        criteria: ['确认仓库身份', '建立最小 Tauri + Svelte 工程', '生成固定三栏桌面壳', '冻结禁止写入原则', '建立 macOS CI', '输出本地构建']
      },
      {
        key: 'visible',
        id: 'AICC-VISIBLE-SLICE-001',
        title: 'First Readable Self-Control App',
        summary: '显示自身 Roadmap、OpenSpec 工件状态和 OmO Slim 配置，但不启动 Agent，也不允许任何写操作。',
        status: 'CURRENT',
        gate: 'PLANNING',
        authorization: 'PLANNING ONLY · IMPLEMENTATION AUTHORIZED FOR VISIBLE APP',
        progress: '1 / 8',
        progressPercent: 12,
        parent: 'Phase 1 · Foundation',
        dependency: 'AICC-BOOTSTRAP-001',
        change: 'aicc-visible-slice-001',
        path: 'docs/60_Operations/work-packages/AICC-VISIBLE-SLICE-001.md',
        spec: '3/4', task: '1/8', run: 'OFF',
        criteria: ['macOS App 可以启动', '显示自身 Roadmap 层级', '支持折叠和独立滚动', '显示 Authority 状态', '显示 OpenSpec Artifacts', '显示 OmO Slim Agent 配置', '打开正式 Evidence', '不存在写操作或 Agent 启动入口']
      },
      {
        key: 'readonly',
        id: 'AICC-READONLY-MVP-001',
        title: 'Reliable Read-only MVP',
        summary: '完善 Roadmap、OpenSpec、OmO Slim、Authority Drift 和错误合同。',
        status: 'BLOCKED',
        gate: 'WAITING DEPENDENCY',
        authorization: 'NOT AUTHORIZED',
        progress: '0 / 9',
        progressPercent: 0,
        parent: 'Phase 1 · Foundation',
        dependency: 'AICC-VISIBLE-SLICE-001',
        change: 'aicc-readonly-mvp-001',
        path: 'docs/60_Operations/work-packages/AICC-READONLY-MVP-001.md',
        spec: '0/4', task: '0/9', run: 'OFF',
        criteria: ['完整 Work Package Index', 'Roadmap 关系', 'OpenSpec Parser', 'OmO Config Parser', 'Authority Drift', '路径持久化', 'Fail closed', 'Evidence 校验', '自动测试']
      }
    ]
  },
  {
    key: 'owner-control',
    label: 'Phase 2 · Owner Control',
    subtitle: '审批、Policy、Writer Lock',
    icon: 'P2',
    items: [
      {
        key: 'owner', id: 'AICC-OWNER-GATE-001', title: 'Owner Gate',
        summary: '加入 Y/N/R/A、Approval Log、Action Policy 和状态机。', status: 'DEFERRED', gate: 'OUT OF SCOPE', authorization: 'DEFERRED', progress: '0 / 7', progressPercent: 0,
        parent: 'Phase 2 · Owner Control', dependency: 'AICC-READONLY-MVP-001', change: 'aicc-owner-gate-001', path: 'docs/60_Operations/work-packages/AICC-OWNER-GATE-001.md', spec: '0/4', task: '0/7', run: 'OFF',
        criteria: ['Y/N/R/A', 'Approval Request', 'Owner Intent', 'Action Policy', '状态机', 'Writer Lock', 'Pause / Resume']
      },
      {
        key: 'writer', id: 'AICC-WRITER-LOCK-001', title: 'Single Writer Lock',
        summary: '同一仓库同一时间仅允许一个受控写入任务。', status: 'DEFERRED', gate: 'OUT OF SCOPE', authorization: 'DEFERRED', progress: '0 / 5', progressPercent: 0,
        parent: 'Phase 2 · Owner Control', dependency: 'AICC-OWNER-GATE-001', change: 'aicc-writer-lock-001', path: 'docs/60_Operations/work-packages/AICC-WRITER-LOCK-001.md', spec: '0/4', task: '0/5', run: 'OFF',
        criteria: ['Repository Lock', 'Run Lock', '冲突检测', '异常恢复', '退出清理']
      }
    ]
  },
  {
    key: 'execution',
    label: 'Phase 3 · Execution',
    subtitle: 'OpenSpec 与 OmO Slim',
    icon: 'P3',
    items: [
      {
        key: 'openspec', id: 'AICC-OPENSPEC-CONTROL-001', title: 'OpenSpec Control',
        summary: '把 OpenSpec Action 包装为受 Authority、Policy 和 Owner Gate 控制的固定动作。', status: 'DEFERRED', gate: 'OUT OF SCOPE', authorization: 'DEFERRED', progress: '0 / 8', progressPercent: 0,
        parent: 'Phase 3 · Execution', dependency: 'AICC-OWNER-GATE-001', change: 'aicc-openspec-control-001', path: 'docs/60_Operations/work-packages/AICC-OPENSPEC-CONTROL-001.md', spec: '0/5', task: '0/8', run: 'OFF',
        criteria: ['Explore', 'Propose', 'Update', 'Verify', 'Apply Gate', '禁止 Sync', 'Archive Gate', 'Action Audit']
      },
      {
        key: 'omo', id: 'AICC-OMO-SLIM-RUNNER-001', title: 'OmO Slim Runner',
        summary: '接入专业 Agent，并实施读并行、写串行与预算控制。', status: 'DEFERRED', gate: 'OUT OF SCOPE', authorization: 'DEFERRED', progress: '0 / 9', progressPercent: 0,
        parent: 'Phase 3 · Execution', dependency: 'AICC-OPENSPEC-CONTROL-001', change: 'aicc-omo-runner-001', path: 'docs/60_Operations/work-packages/AICC-OMO-SLIM-RUNNER-001.md', spec: '0/4', task: '0/9', run: 'OFF',
        criteria: ['Config Loader', 'Doctor', 'Agent 映射', 'Read Lanes', 'Write Lane', 'Budget', 'Retry', 'Session Binding', 'Audit']
      },
      {
        key: 'level3', id: 'AICC-LEVEL3-RUNNER-001', title: 'Controlled Level 3',
        summary: '完成 Authority、OpenSpec、OmO Slim、Review 和 Owner Handoff 的端到端运行。', status: 'DEFERRED', gate: 'OUT OF SCOPE', authorization: 'DEFERRED', progress: '0 / 12', progressPercent: 0,
        parent: 'Phase 3 · Execution', dependency: 'AICC-OMO-SLIM-RUNNER-001', change: 'aicc-level3-runner-001', path: 'docs/60_Operations/work-packages/AICC-LEVEL3-RUNNER-001.md', spec: '0/5', task: '0/12', run: 'OFF',
        criteria: ['Authority', 'Plan', 'Builder', 'Tests', 'Retry', 'Reviewer', 'Validation', 'Local Commit', 'Handoff', 'Pause', 'Resume', 'Recovery']
      }
    ]
  },
  {
    key: 'platform',
    label: 'Phase 4 · Platform',
    subtitle: '多项目 Adapter 平台',
    icon: 'P4',
    items: [
      {
        key: 'multi', id: 'AICC-MULTIPROJECT-001', title: 'Multi-project Platform',
        summary: '自举版本验证后支持 BYL ERP 与其他项目。', status: 'DEFERRED', gate: 'OUT OF SCOPE', authorization: 'DEFERRED', progress: '0 / 10', progressPercent: 0,
        parent: 'Phase 4 · Platform', dependency: 'AICC-LEVEL3-RUNNER-001', change: 'aicc-multiproject-001', path: 'docs/60_Operations/work-packages/AICC-MULTIPROJECT-001.md', spec: '0/4', task: '0/10', run: 'OFF',
        criteria: ['Adapter SDK', 'Project Registry', 'Workflow Packs', 'Schema Migration', 'ERP Adapter', 'Simple Adapter', 'Compatibility', 'Audit', 'Signing', 'DMG']
      }
    ]
  }
];

export const agents = [
  ['OR', 'Orchestrator', 'Planning and delegation', 'CONTROL LANE', 'IDLE'],
  ['EX', 'Explorer', 'Codebase discovery', 'READ PARALLEL', 'IDLE'],
  ['OL', 'Oracle', 'Architecture reasoning', 'READ PARALLEL', 'IDLE'],
  ['CO', 'Council', 'Multi-model synthesis', 'READ PARALLEL', 'IDLE'],
  ['LI', 'Librarian', 'Documentation research', 'READ PARALLEL', 'IDLE'],
  ['DE', 'Designer', 'UI implementation', 'WRITE CAPABLE', 'DISABLED'],
  ['FI', 'Fixer', 'Scoped implementation', 'WRITE CAPABLE', 'DISABLED']
] as const;
