import { spawn } from 'node:child_process';

export class GitHubReadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GitHubReadError';
    this.code = code;
  }
}

export function createGhApiClient({ cwd = process.cwd(), env = process.env, timeoutMs = 10000, spawnFn = spawn } = {}) {
  const execute = (args, label) => new Promise((resolve, reject) => {
    const child = spawnFn('gh', args, {
      cwd,
      env: { ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn) => { if (settled) return false; settled = true; clearTimeout(timer); fn(); return true; };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(() => reject(new GitHubReadError('GITHUB_API_TIMEOUT', `gh api timed out after ${timeoutMs}ms: ${label}`)));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => finish(() => reject(new GitHubReadError('GITHUB_CLIENT_UNAVAILABLE', error.message))));
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(() => reject(new GitHubReadError('GITHUB_API_READ_FAILED', stderr.trim() || `gh api exited ${code}`)));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        finish(() => resolve(parsed));
      } catch (error) {
        finish(() => reject(new GitHubReadError('GITHUB_API_INVALID_JSON', error.message)));
      }
    });
  });

  return Object.freeze({
    api(apiPath) { return execute(['api', apiPath], apiPath); },
    graphql(query) { return execute(['api', 'graphql', '-f', `query=${query}`], 'graphql bulk project facts'); }
  });
}
