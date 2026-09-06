import { spawn } from 'node:child_process';

export class GitHubReadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GitHubReadError';
    this.code = code;
  }
}

export function createGhApiClient({ cwd = process.cwd(), env = process.env } = {}) {
  return Object.freeze({
    async api(apiPath) {
      return new Promise((resolve, reject) => {
        const child = spawn('gh', ['api', apiPath], {
          cwd,
          env: { ...env },
          stdio: ['ignore', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.on('error', (error) => reject(new GitHubReadError('GITHUB_CLIENT_UNAVAILABLE', error.message)));
        child.on('close', (code) => {
          if (code !== 0) {
            reject(new GitHubReadError('GITHUB_API_READ_FAILED', stderr.trim() || `gh api exited ${code}`));
            return;
          }
          try {
            resolve(JSON.parse(stdout));
          } catch (error) {
            reject(new GitHubReadError('GITHUB_API_INVALID_JSON', error.message));
          }
        });
      });
    }
  });
}
