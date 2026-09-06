import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectRegistry, ProjectRegistryError } from '../lib/project-registry.mjs';

const base = {
  schema: 'aicc.v4.project-registry.v1',
  projects: [
    { id: 'andy-core', name: 'Andy-Core', repository: 'beyourlovercom/YBY-Core', roadmapPath: 'docs/andy.md' },
    { id: 'yby-core', name: 'YBY-Core', repository: 'beyourlovercom/YBY-Core' }
  ]
};

test('registry stores locators only and allows multiple project views for one repo', () => {
  const registry = validateProjectRegistry(base);
  assert.equal(registry.projects.length, 2);
  assert.equal(registry.projects[0].repository, registry.projects[1].repository);
});

test('registry rejects persisted GitHub facts', () => {
  assert.throws(() => validateProjectRegistry({ ...base, projects: [{ ...base.projects[0], mainSha: 'a'.repeat(40) }] }), (error) => {
    assert(error instanceof ProjectRegistryError);
    assert.equal(error.code, 'PROJECT_REGISTRY_FACT_PERSISTENCE_FORBIDDEN');
    return true;
  });
});

test('registry rejects path traversal and duplicate project ids', () => {
  assert.throws(() => validateProjectRegistry({ ...base, projects: [{ ...base.projects[0], roadmapPath: '../secret' }] }));
  assert.throws(() => validateProjectRegistry({ ...base, projects: [base.projects[0], { ...base.projects[1], id: 'andy-core' }] }));
});
