import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProcessStatus,
  normalizeTerminalLinePage,
  optInPowerShellUtf8Command,
  presentTerminalLinePage,
} from './p2-terminal-fidelity.mjs';

const status = (overrides = {}) => ({
  state: 'completed', exitCode: 0, signal: null, runtimeMs: 12.5, ...overrides,
});
const page = (overrides = {}) => ({
  lines: ['alpha', ''], totalLines: 2, readFrom: 0, readCount: 2, remaining: 0, isComplete: true,
  evictedLines: 0, ...overrides,
});

test('normalizes running, exit-zero, exit-one, signal, and completed-unknown facts', () => {
  assert.deepEqual(normalizeProcessStatus(status({ state: 'running', exitCode: null, runtimeMs: null })), {
    status: 'running', exitCode: null, signal: null, runtimeMs: null,
  });
  assert.equal(normalizeProcessStatus(status()).status, 'exited');
  assert.equal(normalizeProcessStatus(status({ exitCode: 1 })).exitCode, 1);
  assert.deepEqual(normalizeProcessStatus(status({ exitCode: null, signal: 'SIGTERM' })), {
    status: 'signaled', exitCode: null, signal: 'SIGTERM', runtimeMs: 12.5,
  });
  assert.equal(normalizeProcessStatus(status({ exitCode: null })).status, 'unknown');
});

test('status rejects missing, contradictory, malformed, and malicious shapes', () => {
  const invalid = [
    {}, status({ state: 'running', exitCode: 0 }), status({ exitCode: 1, signal: 'SIGTERM' }),
    status({ exitCode: '0' }), status({ signal: 'not-a-signal', exitCode: null }),
    status({ runtimeMs: Infinity }), status({ runtimeMs: '12' }), status({ extra: 'ignored' }),
    status({ signal: 'SIGTERM', state: 'running', exitCode: null }),
  ];
  for (const value of invalid) assert.throws(() => normalizeProcessStatus(value), /^Error: P2_TERMINAL_STATUS_/);
});

test('status snapshots only safe own data properties and sanitizes traps', () => {
  const getter = {};
  Object.defineProperty(getter, 'state', { enumerable: true, get() { throw new Error('secret'); } });
  for (const value of [getter, new Proxy(status(), { getOwnPropertyDescriptor() { throw new Error('secret'); } }), new Proxy(status(), { ownKeys() { throw new Error('secret'); } })])
    assert.throws(() => normalizeProcessStatus(value), { code: 'P2_TERMINAL_STATUS_INVALID' });
  assert.throws(() => normalizeProcessStatus(Object.create({ state: 'completed' })), { code: 'P2_TERMINAL_STATUS_INVALID' });
  const nullRecord = Object.assign(Object.create(null), status());
  assert.equal(normalizeProcessStatus(nullRecord).status, 'exited');
});

test('typed line pages preserve intentional empty lines and counts', () => {
  assert.deepEqual(normalizeTerminalLinePage(page()).lines, ['alpha', '']);
  assert.deepEqual(normalizeTerminalLinePage(page({ lines: [], totalLines: 0, readCount: 0 })).lines, []);
  assert.equal(normalizeTerminalLinePage(page({ lines: ['b'], totalLines: 3, readFrom: 1, readCount: 1, remaining: 1, isComplete: false })).readFrom, 1);
});

test('line pages reject impossible geometry and malformed projection fields', () => {
  const invalid = [
    page({ readCount: 1 }), page({ readFrom: -1 }), page({ totalLines: 1 }),
    page({ lines: ['a'], totalLines: 1, readCount: 1, remaining: 1 }),
    page({ readFrom: 3, totalLines: 2, readCount: 1, remaining: 0 }),
    page({ evictedLines: -1 }), page({ extra: 'prose' }),
  ];
  for (const value of invalid) assert.throws(() => normalizeTerminalLinePage(value), /^Error: P2_TERMINAL_PAGE_/);
});

test('line pages reject accessor/proxy traps and clone safe line data', () => {
  const getter = page();
  Object.defineProperty(getter, 'lines', { enumerable: true, get() { throw new Error('secret'); } });
  assert.throws(() => normalizeTerminalLinePage(getter), { code: 'P2_TERMINAL_PAGE_INVALID' });
  assert.throws(() => normalizeTerminalLinePage(new Proxy(page(), { getOwnPropertyDescriptor() { throw new Error('secret'); } })), { code: 'P2_TERMINAL_PAGE_INVALID' });
  const lines = ['safe'];
  Object.defineProperty(lines, '0', { enumerable: true, get() { throw new Error('secret'); } });
  assert.throws(() => normalizeTerminalLinePage(page({ lines, totalLines: 1, readCount: 1 })), { code: 'P2_TERMINAL_PAGE_INVALID' });
  const nullRecord = Object.assign(Object.create(null), page());
  const normalized = normalizeTerminalLinePage(nullRecord);
  assert.deepEqual(normalized.lines, ['alpha', '']);
  assert.notEqual(normalized.lines, nullRecord.lines);
  assert.equal(Object.isFrozen(normalized.lines), true);
});

test('upstream eviction count is retained, including at readFrom zero', () => {
  const normalized = normalizeTerminalLinePage({
    lines: [], totalLines: 5, readFrom: 0, readCount: 0, remaining: 0, isComplete: false, evictedLines: 3,
  });
  assert.equal(normalized.evictedLines, 3);
  assert.equal(normalized.readCount, 0);
});

test('completion is process state, independent of unread output and retained-line geometry', () => {
  assert.equal(normalizeTerminalLinePage(page({ lines: [], totalLines: 0, readCount: 0, remaining: 0, isComplete: false })).isComplete, false);
  assert.equal(normalizeTerminalLinePage(page({ lines: ['a'], totalLines: 21, readCount: 1, remaining: 20, isComplete: true })).remaining, 20);
  assert.deepEqual(normalizeTerminalLinePage(page({ lines: [], totalLines: 2, readFrom: 4, readCount: 0, remaining: 0, isComplete: true })).lines, []);
});

test('remaining may be lower than total-line arithmetic for an incomplete last line', () => {
  assert.equal(normalizeTerminalLinePage(page({ lines: ['a'], totalLines: 3, readCount: 1, remaining: 1, isComplete: false })).remaining, 1);
});

test('phantom trailing sentinel is an upstream concern; real blank tails remain data', () => {
  const realBlankTail = normalizeTerminalLinePage({
    lines: ['output', ''], totalLines: 2, readFrom: 0, readCount: 2, remaining: 0, isComplete: true, evictedLines: 0,
  });
  assert.deepEqual(realBlankTail.lines, ['output', '']);
  assert.deepEqual(normalizeTerminalLinePage({
    lines: ['output'], totalLines: 1, readFrom: 0, readCount: 1, remaining: 0, isComplete: true, evictedLines: 0,
  }).lines, ['output']);
});

test('PowerShell UTF-8 opt-in is unchanged by default and preserves the command suffix exactly', () => {
  const command = 'Write-Output "中文"; # explicit caller text';
  assert.equal(optInPowerShellUtf8Command({ deviceId: 'windows', shell: 'pwsh.exe', command }), command);
  assert.equal(optInPowerShellUtf8Command({ deviceId: 'windows', shell: 'pwsh.exe', command, optIn: false }), command);
  const enabled = optInPowerShellUtf8Command({ deviceId: '007windows', shell: 'PowerShell.EXE', command, optIn: true });
  assert.equal(enabled.slice(enabled.indexOf('Write-Output')), command);
  assert.match(enabled, /^\[Console\]::OutputEncoding = \[System\.Text\.Encoding\]::UTF8; \$OutputEncoding = \[System\.Text\.Encoding\]::UTF8; /);
});

test('UTF-8 opt-in rejects macOS, other shells, directives, and malformed inputs without execution', () => {
  const base = { command: 'Write-Output ok', optIn: true };
  assert.throws(() => optInPowerShellUtf8Command({ ...base, deviceId: 'macos', shell: 'pwsh.exe' }), { code: 'P2_TERMINAL_UTF8_SCOPE_DENIED' });
  assert.throws(() => optInPowerShellUtf8Command({ ...base, deviceId: 'windows', shell: 'cmd.exe' }), { code: 'P2_TERMINAL_UTF8_SCOPE_DENIED' });
  for (const command of ['#requires -Version 7\nWrite-Output ok', 'using namespace X\nWrite-Output ok', 'param($x)\n$x', '# comment\nWrite-Output ok'])
    assert.throws(() => optInPowerShellUtf8Command({ ...base, deviceId: 'windows', shell: 'pwsh.exe', command }), { code: 'P2_TERMINAL_UTF8_DIRECTIVE_UNSUPPORTED' });
  assert.throws(() => optInPowerShellUtf8Command({ deviceId: 'windows', shell: 'pwsh.exe', command: 42 }), { code: 'P2_TERMINAL_COMMAND_INVALID' });
  for (const command of ['', 'Write-Output ok\r\n', '@\'\nWrite-Output ok\n\'@', '& { Write-Output ok }'])
    assert.throws(() => optInPowerShellUtf8Command({ ...base, deviceId: 'windows', shell: 'pwsh.exe', command }), { code: 'P2_TERMINAL_UTF8_COMMAND_UNSAFE' });
});

test('explicit code-page text is never rewritten when opt-in is off', () => {
  const command = '$OutputEncoding = [Text.Encoding]::Unicode; chcp 65001; Write-Output ok';
  assert.equal(optInPowerShellUtf8Command({ deviceId: 'windows', shell: 'powershell.exe', command }), command);
});

test('UTF-8 command options require own safe data properties', () => {
  const command = 'Write-Output ok';
  assert.equal(optInPowerShellUtf8Command({ command }), command);
  assert.throws(() => optInPowerShellUtf8Command(Object.assign(Object.create({ optIn: true }), {
    command, deviceId: 'windows', shell: 'pwsh.exe',
  })), { code: 'P2_TERMINAL_COMMAND_INVALID' });
  const getter = { command };
  Object.defineProperty(getter, 'optIn', { enumerable: true, get() { throw new Error('secret'); } });
  assert.throws(() => optInPowerShellUtf8Command(getter), { code: 'P2_TERMINAL_COMMAND_INVALID' });
  assert.throws(() => optInPowerShellUtf8Command(new Proxy({ command }, { getOwnPropertyDescriptor() { throw new Error('secret'); } })), { code: 'P2_TERMINAL_COMMAND_INVALID' });
  const nullRecord = Object.assign(Object.create(null), { command });
  assert.equal(optInPowerShellUtf8Command(nullRecord), command);
  const enabled = Object.assign(Object.create(null), { command, optIn: true, deviceId: 'windows', shell: 'pwsh.exe' });
  assert.match(optInPowerShellUtf8Command(enabled), /OutputEncoding/);
});

test('single real blank line is distinguishable from a zero-line page', () => {
  const realBlank = presentTerminalLinePage(page({
    lines: [''], totalLines: 1, readCount: 1, remaining: 0, isComplete: true,
  }));
  assert.deepEqual(realBlank, {
    rawText: '',
    displayText: '(Blank output: 1 line)',
    hasOutput: true,
    blankOnly: true,
    lineCount: 1,
  });
  const noLines = presentTerminalLinePage(page({
    lines: [], totalLines: 0, readCount: 0, remaining: 0, isComplete: true,
  }));
  assert.equal(noLines.rawText, '');
  assert.equal(noLines.displayText, '(No output in requested range)');
  assert.equal(noLines.hasOutput, false);
  assert.equal(noLines.blankOnly, false);
});

test('multiple genuine blank lines preserve count instead of false no-output', () => {
  const result = presentTerminalLinePage(page({
    lines: ['', ''], totalLines: 2, readCount: 2, remaining: 0,
  }));
  assert.equal(result.rawText, '\n');
  assert.equal(result.displayText, '(Blank output: 2 lines)');
  assert.equal(result.lineCount, 2);
});

test('mixed lines and literal no-output text are not censored or invented', () => {
  const mixed = presentTerminalLinePage(page());
  assert.equal(mixed.displayText, 'alpha\n');
  assert.equal(mixed.rawText, 'alpha\n');
  assert.equal(mixed.hasOutput, true);
  assert.equal(mixed.blankOnly, false);
  const literal = presentTerminalLinePage(page({
    lines: ['(No output in requested range)'], totalLines: 1, readCount: 1,
  }));
  assert.equal(literal.displayText, '(No output in requested range)');
  assert.equal(literal.hasOutput, true);
  assert.equal(literal.blankOnly, false);
});

test('renderer respects geometry and refuses malformed or accessor-backed page', () => {
  assert.throws(() => presentTerminalLinePage(page({ readCount: 3 })), {
    code: 'P2_TERMINAL_PAGE_INVALID',
  });
  assert.throws(() => presentTerminalLinePage(page({ readFrom: 3, totalLines: 2 })), {
    code: 'P2_TERMINAL_PAGE_CONTRADICTORY',
  });
  const getterPage = page();
  Object.defineProperty(getterPage, 'lines', {
    enumerable: true,
    get() { throw Error('should be redacted'); },
  });
  assert.throws(() => presentTerminalLinePage(getterPage), {
    code: 'P2_TERMINAL_PAGE_INVALID',
  });
});

test('presentation result is frozen and cannot mutate original line buffers', () => {
  const lineValues = ['hello', '', '中文'];
  const r = presentTerminalLinePage(page({
    lines: lineValues, totalLines: 3, readCount: 3,
  }));
  assert.equal(Object.isFrozen(r), true);
  assert.equal(r.displayText, 'hello\n\n中文');
  lineValues[0] = 'changed';
  assert.equal(r.rawText, 'hello\n\n中文');
});
