import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REPOSITORY_ROOT = '/Users/a/AI/007/AIcontrolcenter';
const ROADMAP = join(REPOSITORY_ROOT, 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md');
const WORK_PACKAGES = join(REPOSITORY_ROOT, 'docs/60_Operations/work-packages');

export type WorkPackage = { id: string; title: string; source: string; fields: Record<string, string>; sections: Record<string, string> };
export type RepositoryModel = { repository: string; branch: string; head: string; localMain: string; remoteMain: string; worktree: 'CLEAN' | 'DIRTY' | 'UNAVAILABLE'; lastCommit: string };

export function validWorkPackageId(id: string): boolean { return /^AICC-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(id) && !id.includes('..') && !id.includes('/') && !id.includes('\\'); }
export function readRoadmap(): string { return readFileSync(ROADMAP, 'utf8'); }
export function readWorkPackage(id: string): WorkPackage {
  if (!validWorkPackageId(id)) throw new Error('WP_INVALID_ID');
  const source = join(WORK_PACKAGES, `${id}.md`);
  const text = readFileSync(source, 'utf8');
  const heading = text.match(/^#\s+(.+)$/m)?.[1] ?? id;
  const fields: Record<string, string> = {};
  for (const line of text.split('\n')) { const match = line.match(/^\*\*(.+?)\*\*:\s*(.+)$/); if (match) fields[match[1].trim()] = match[2].trim(); }
  const sections: Record<string, string> = {};
  for (const match of text.matchAll(/^##\s+(.+?)\n([\s\S]*?)(?=^##\s|\s*$)/gm)) sections[match[1].trim()] = match[2].trim();
  return { id, title: heading.replace(/^AICC-[^:：]+[:：]\s*/, ''), source: `docs/60_Operations/work-packages/${id}.md`, fields, sections };
}

function git(args: string[]): string { return execFileSync('git', args, { cwd: REPOSITORY_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function safeGit(args: string[]): string { try { return git(args); } catch { return 'unavailable'; } }
export function readRepository(): RepositoryModel {
  const head = safeGit(['rev-parse', 'HEAD']);
  const branch = safeGit(['branch', '--show-current']);
  const localMain = safeGit(['rev-parse', 'refs/heads/main']);
  let remoteMain = '读取失败 / unavailable';
  try { remoteMain = git(['ls-remote', 'origin', 'refs/heads/main']).split(/\s+/)[0] || remoteMain; } catch { /* remote access is optional and read-only */ }
  return { repository: REPOSITORY_ROOT, branch, head, localMain, remoteMain, worktree: safeGit(['status', '--porcelain']) === '' ? 'CLEAN' : 'DIRTY', lastCommit: safeGit(['log', '-1', '--format=%h %s']) };
}
