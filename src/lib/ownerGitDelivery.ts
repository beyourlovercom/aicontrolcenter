import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export const OWNER_AUTHORIZED_GIT_DELIVERY = 'OWNER_AUTHORIZED_GIT_DELIVERY' as const;
export const OWNER_GIT_DELIVERY_PROFILE = {
  name: OWNER_AUTHORIZED_GIT_DELIVERY,
  gitMetadataWrite: 1,
  networkAccess: 1,
  httpsGithub: 1,
  requiresSsh22: 0,
  requiresExplicitOwnerAction: 1,
  executionOwner: 'CODEX',
} as const;

export type GitDeliveryPreflight = {
  GIT_METADATA_WRITE_CAPABILITY: 'PASS' | 'BLOCKED';
  GITHUB_API_REACHABLE: 'PASS' | 'BLOCKED';
  HTTPS_GIT_REACHABLE: 'PASS' | 'BLOCKED';
  GH_AUTH_AVAILABLE_INSIDE_DELIVERY_PROFILE: 'PASS' | 'BLOCKED';
};

function succeeds(command: string, args: string[], cwd?: string): boolean {
  try { execFileSync(command, args, {cwd, stdio: 'ignore', timeout: 10_000}); return true; } catch { return false; }
}

/** Read-only network checks plus a disposable Git metadata-write check. */
export function runOwnerGitDeliveryPreflight(repositoryRoot: string): GitDeliveryPreflight {
  const scratch = mkdtempSync(join(tmpdir(), 'aicc-git-delivery-'));
  let metadata = false;
  try {
    metadata = succeeds('git', ['init', '-q', scratch]) &&
      succeeds('git', ['-C', scratch, 'config', 'user.name', 'AICC preflight']) &&
      succeeds('git', ['-C', scratch, 'config', 'user.email', 'aicc-preflight@localhost']) &&
      (() => { try { writeFileSync(join(scratch, 'preflight'), 'ok'); return succeeds('git', ['-C', scratch, 'add', 'preflight']); } catch { return false; } })();
  } finally { rmSync(scratch, {recursive: true, force: true}); }
  const remote = (() => { try { return execFileSync('git', ['config', '--get', 'remote.origin.url'], {cwd: repositoryRoot, encoding: 'utf8', timeout: 3_000}).trim(); } catch { return ''; } })();
  const httpsRemote = remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
  return {
    GIT_METADATA_WRITE_CAPABILITY: metadata ? 'PASS' : 'BLOCKED',
    GITHUB_API_REACHABLE: succeeds('gh', ['api', 'rate_limit', '--silent']) ? 'PASS' : 'BLOCKED',
    HTTPS_GIT_REACHABLE: httpsRemote.startsWith('https://github.com/') && succeeds('git', ['ls-remote', '--heads', `${httpsRemote}.git`]) ? 'PASS' : 'BLOCKED',
    GH_AUTH_AVAILABLE_INSIDE_DELIVERY_PROFILE: succeeds('gh', ['auth', 'status']) ? 'PASS' : 'BLOCKED',
  };
}
