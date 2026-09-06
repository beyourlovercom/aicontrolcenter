import { readFile } from 'node:fs/promises';

export const PROJECT_REGISTRY_SCHEMA = 'aicc.v4.project-registry.v1';
const PROJECT_KEYS = new Set(['id', 'name', 'repository', 'roadmapPath']);
const FORBIDDEN_FACT_KEYS = new Set([
  'branch', 'defaultBranch', 'head', 'mainSha', 'sha', 'status', 'progress',
  'workPackage', 'task', 'pullRequests', 'prs', 'ci', 'checks', 'runtime'
]);

export class ProjectRegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProjectRegistryError';
    this.code = code;
  }
}

function assertRelativeLocator(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProjectRegistryError('PROJECT_REGISTRY_SCHEMA_INVALID', `${field} must be a non-empty string`);
  }
  if (value.startsWith('/') || value.includes('\\') || value.split('/').includes('..')) {
    throw new ProjectRegistryError('PROJECT_REGISTRY_SCHEMA_INVALID', `${field} must be repository-relative`);
  }
}

export function validateProjectRegistry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ProjectRegistryError('PROJECT_REGISTRY_SCHEMA_INVALID', 'registry must be an object');
  }
  const topKeys = Object.keys(input);
  if (topKeys.some((key) => !['schema', 'projects'].includes(key))) {
    throw new ProjectRegistryError('PROJECT_REGISTRY_SCHEMA_INVALID', 'registry has unknown top-level fields');
  }
  if (input.schema !== PROJECT_REGISTRY_SCHEMA || !Array.isArray(input.projects)) {
    throw new ProjectRegistryError('PROJECT_REGISTRY_SCHEMA_INVALID', 'registry schema/projects are invalid');
  }

  const ids = new Set();
  const projects = input.projects.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ProjectRegistryError('PROJECT_REGISTRY_SCHEMA_INVALID', 'project must be an object');
    }
    for (const key of Object.keys(raw)) {
      if (FORBIDDEN_FACT_KEYS.has(key)) {
        throw new ProjectRegistryError('PROJECT_REGISTRY_FACT_PERSISTENCE_FORBIDDEN', `${key} is a GitHub fact, not registry data`);
      }
      if (!PROJECT_KEYS.has(key)) {
        throw new ProjectRegistryError('PROJECT_REGISTRY_SCHEMA_INVALID', `unknown project field: ${key}`);
      }
    }
    if (typeof raw.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(raw.id)) {
      throw new ProjectRegistryError('PROJECT_REGISTRY_SCHEMA_INVALID', 'project id is invalid');
    }
    if (ids.has(raw.id)) {
      throw new ProjectRegistryError('PROJECT_REGISTRY_DUPLICATE_ID', `duplicate project id: ${raw.id}`);
    }
    ids.add(raw.id);
    if (typeof raw.name !== 'string' || !raw.name.trim()) {
      throw new ProjectRegistryError('PROJECT_REGISTRY_SCHEMA_INVALID', 'project name is invalid');
    }
    if (typeof raw.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw.repository)) {
      throw new ProjectRegistryError('PROJECT_REGISTRY_SCHEMA_INVALID', 'repository must be owner/name');
    }
    if (raw.roadmapPath !== undefined) assertRelativeLocator(raw.roadmapPath, 'roadmapPath');
    return Object.freeze({
      id: raw.id,
      name: raw.name.trim(),
      repository: raw.repository,
      ...(raw.roadmapPath ? { roadmapPath: raw.roadmapPath } : {})
    });
  });

  return Object.freeze({ schema: PROJECT_REGISTRY_SCHEMA, projects: Object.freeze(projects) });
}

export async function loadProjectRegistry(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error instanceof ProjectRegistryError) throw error;
    throw new ProjectRegistryError('PROJECT_REGISTRY_UNAVAILABLE', error.message);
  }
  return validateProjectRegistry(parsed);
}

export function getProjectLocator(registry, projectId) {
  return registry.projects.find((project) => project.id === projectId) ?? null;
}
