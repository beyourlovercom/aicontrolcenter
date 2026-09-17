export type ExternalRuntime = {
  path: string;
  branch: string | null;
  head: string;
  dirty: boolean;
  detached: boolean;
  executable: boolean;
  committedAt: string | null;
};
export type ExternalWorkstream = { id: string; name: string; runtimes: ExternalRuntime[] };
export type ExternalProject = { id: string; name: string; repositoryIdentity: string; repositoryRoots: string[]; workstreams: ExternalWorkstream[] };
export type ExternalProjectCatalog = { schema: string; projects: ExternalProject[] };

export async function readExternalProjects(fetcher: typeof fetch = fetch): Promise<ExternalProjectCatalog> {
  const response = await fetcher('/api/external-projects', { headers: { accept: 'application/json' }, cache: 'no-store' });
  let body: any = {}; try { body = await response.json(); } catch {}
  if (!response.ok || body.available === false || !body.catalog || !Array.isArray(body.catalog.projects)) {
    throw new Error(typeof body.errorCode === 'string' ? body.errorCode : `EXTERNAL_PROJECTS_HTTP_${response.status}`);
  }
  return body.catalog as ExternalProjectCatalog;
}
