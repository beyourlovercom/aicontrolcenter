import { buildReadModel, type RepositorySnapshot } from './openspecReadModel.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const proposal = '# Demo Work Package\n\nSummary';
const design = '# Design\n\nDetails';
const delta = '# Delta\n\n## Requirement\n\nText';
const files = (tasks = '- [ ] First task\n- [ ] Second task'): Record<string, string> => ({
  'openspec/specs/core/spec.md': '# Core\n\n## Requirement\n\nText',
  'openspec/changes/demo/proposal.md': proposal,
  'openspec/changes/demo/design.md': design,
  'openspec/changes/demo/tasks.md': tasks,
  'openspec/changes/demo/specs/read-model/spec.md': delta,
  'openspec/changes/demo/.openspec.yaml': 'schema: spec-driven'
});

function model(overrides: Partial<RepositorySnapshot> = {}) {
  return buildReadModel({ files: files(), git: { head: 'abc123', branch: 'main', clean: true }, ...overrides });
}

assert(model().activeWorkPackages[0].state === 'READY', 'complete planning with zero completed tasks is ready');
assert(model({ files: { 'openspec/changes/demo/proposal.md': proposal } }).activeWorkPackages[0].state === 'PLANNING', 'proposal-only change is planning');
assert(model({ files: { 'openspec/changes/demo/.openspec.yaml': 'schema: spec-driven' } }).activeWorkPackages[0].state === 'PROPOSED', 'metadata-only change is proposed');
assert(model({ files: files('- [x] First task\n- [ ] Second task') }).activeWorkPackages[0].state === 'IMPLEMENTING', 'partial tasks are implementing');
assert(model({ files: files('- [x] First task\n- [x] Second task') }).activeWorkPackages[0].state === 'VERIFYING', 'complete tasks without verification are verifying');
assert(model({ files: files('- [x] First task\n- [x] Second task') , verificationReports: { 'reports/test.txt': 'RESULT: PASS' } }).activeWorkPackages[0].state === 'VERIFIED', 'pass and clean are verified');
assert(model({ files: files('- [x] First task\n- [x] Second task') , verificationReports: { 'reports/test.txt': 'RESULT: FAIL' } }).activeWorkPackages[0].state === 'BLOCKED', 'failed verification is blocked');
assert(model({ files: { 'openspec/changes/demo/proposal.md': `${proposal}\n\n\`\`\`` } }).activeWorkPackages[0].state === 'INVALID', 'malformed markdown is invalid');
assert(model({ files: { 'openspec/changes/demo/weird.txt': 'unsupported' } }).activeWorkPackages[0].state === 'UNKNOWN', 'unsupported structure is unknown');

const multiple = buildReadModel({ files: { 'openspec/changes/one/proposal.md': proposal, 'openspec/changes/two/proposal.md': proposal } });
assert(multiple.activeWorkPackages.length === 2 && multiple.selectedWorkPackageId === null, 'multiple active changes are not silently selected');
assert(multiple.activeWorkPackages.every((item) => item.state === 'BLOCKED'), 'multiple active changes are blocked');

const archived = buildReadModel({ files: {
  'openspec/changes/archive/2026-08-05-old/proposal.md': '# Old',
  'openspec/changes/archive/2026-08-05-old/tasks.md': '- [x] Done',
  'openspec/changes/archive/2026-08-05-old/specs/read-model/spec.md': delta
} });
assert(archived.archivedWorkPackages[0].state === 'ARCHIVED', 'real archive path is archived');
assert(archived.archivedWorkPackages[0].id === '2026-08-05-old', 'archive keeps date prefix');
assert(archived.activeWorkPackages.length === 0, 'archive is not active');

const metadata = model().activeWorkPackages[0].files.find((file) => file.path.endsWith('.openspec.yaml'));
assert(metadata?.kind === 'metadata', 'metadata is classified separately');
assert(model().activeWorkPackages[0].sections.specifications.length === 1, 'metadata is excluded from specifications');
assert(model({ files: { 'openspec/changes/demo/proposal.md': proposal }, planningComplete: true }).activeWorkPackages[0].diagnostics.some((item) => item.code === 'MISSING_FILE' && item.severity === 'error'), 'missing files have diagnostics');
assert(model({ files: { 'openspec/changes/demo/proposal.md': proposal, 'openspec/changes/demo/design.md': design, 'openspec/changes/demo/tasks.md': '- [ ] Task' } }).activeWorkPackages[0].diagnostics.some((item) => item.code === 'MISSING_DELTA_SPEC'), 'missing delta specs have diagnostics');
assert(model({ files: { ...files(), 'openspec/changes/demo/specs/read-model/notes.md': 'notes' } }).activeWorkPackages[0].files.some((file) => file.kind === 'unknown'), 'unknown files preserve provenance');

const dirty = model({ git: { head: 'abc123', branch: 'main', clean: false }, verificationReports: { 'reports/test.txt': 'RESULT: PASS' }, files: files('- [x] First task\n- [x] Second task') });
assert(dirty.activeWorkPackages[0].state !== 'VERIFIED', 'dirty tree cannot be verified');
assert(model({ files: files('- [x] First task\n- [x] Second task'), verificationReports: { 'reports/test.txt': '0 errors\nno failures\nfailed: 0' } }).activeWorkPackages[0].state === 'UNKNOWN', 'non-result text is unknown, not failed');

const snapshot: RepositorySnapshot = { files: files() };
const before = JSON.stringify(snapshot);
buildReadModel(snapshot);
assert(JSON.stringify(snapshot) === before, 'snapshot input is not mutated');
assert(!Object.keys(buildReadModel(snapshot)).some((key) => /shell|fetch|process|write/i.test(key)), 'read model exposes no execution interface');

console.log('openspec read model contract tests passed');
