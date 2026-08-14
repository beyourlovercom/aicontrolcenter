import type { WorkPackage } from './controlService.ts';

export type CodexExecutionType = 'IMPLEMENTATION' | 'REMEDIATION' | 'READ_ONLY_AUDIT' | 'REVIEW' | 'ANALYSIS';
export type CodexSandboxMode = 'workspace-write' | 'read-only';
export type CodexExecutionPolicy = { executionType: CodexExecutionType; sandboxMode: CodexSandboxMode };

export function resolveCodexExecutionPolicy(workPackage: WorkPackage): CodexExecutionPolicy {
  const value = (workPackage.fields['Execution Type'] ?? workPackage.fields['执行类型'] ?? '').toUpperCase().replace(/[- ]/g, '_');
  const executionType: CodexExecutionType = ['REMEDIATION', 'READ_ONLY_AUDIT', 'REVIEW', 'ANALYSIS'].includes(value) ? value as CodexExecutionType : 'IMPLEMENTATION';
  return { executionType, sandboxMode: ['READ_ONLY_AUDIT', 'REVIEW', 'ANALYSIS'].includes(executionType) ? 'read-only' : 'workspace-write' };
}
