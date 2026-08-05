import { buildReadModel } from './openspecReadModel.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const baseFiles = {
  'openspec/specs/core/spec.md': '# Core\n\n## Requirement\n\nText',
  'openspec/changes/demo/proposal.md': '# Demo Work Package\n\nSummary',
  'openspec/changes/demo/design.md': '# Design\n\nDetails',
  'openspec/changes/demo/tasks.md': '- [x] Parse sources\n- [ ] Map view',
  'openspec/changes/demo/specs/read-model/spec.md': '# Delta\n\n## Requirement\n\nText'
};

const valid = buildReadModel({ files: baseFiles, git: { head: 'abc123', branch: 'main', clean: true }, verificationReports: { 'reports/test.txt': 'PASS all tests' } });
assert(valid.activeWorkPackages.length === 1, 'discovers active changes');
assert(valid.activeWorkPackages[0].progress?.percentage === 50, 'calculates partial progress');
assert(valid.activeWorkPackages[0].state === 'IMPLEMENTING', 'normalizes partial implementation');
assert(valid.rightColumn.authority.remote.available === false, 'does not claim remote authority');

const archived = buildReadModel({ files: { 'openspec/archive/old/proposal.md': '# Old', 'openspec/archive/old/tasks.md': '- [x] Done' } });
assert(archived.archivedWorkPackages[0].state === 'ARCHIVED', 'separates archived changes');
assert(archived.activeWorkPackages.length === 0, 'does not treat archived changes as active');

const ambiguous = buildReadModel({ files: {
  'openspec/changes/one/proposal.md': '# One',
  'openspec/changes/two/proposal.md': '# Two'
} });
assert(ambiguous.selectedWorkPackageId === null, 'does not silently select among active changes');
assert(ambiguous.leftColumn.ambiguous, 'reports active change ambiguity');
assert(ambiguous.activeWorkPackages.every((item) => item.state === 'BLOCKED'), 'blocks ambiguous work packages');

const invalid = buildReadModel({ files: { 'openspec/changes/empty/proposal.md': '# Empty', 'openspec/changes/empty/tasks.md': '# No tasks\n```' } });
assert(invalid.activeWorkPackages[0].state === 'INVALID', 'invalidates empty or malformed tasks');
assert(invalid.activeWorkPackages[0].diagnostics.some((item) => item.code === 'EMPTY_TASKS'), 'reports empty tasks');
assert(invalid.activeWorkPackages[0].diagnostics.some((item) => item.code === 'MALFORMED_MARKDOWN'), 'reports malformed markdown');

const dirty = buildReadModel({ files: baseFiles, git: { head: 'abc123', branch: 'main', clean: false }, verificationReports: { 'reports/test.txt': 'PASS all tests' } });
assert(dirty.activeWorkPackages[0].git.clean === false, 'preserves dirty working tree evidence');
assert(dirty.activeWorkPackages[0].state !== 'VERIFIED', 'does not verify dirty work');

console.log('openspec read model contract tests passed');
