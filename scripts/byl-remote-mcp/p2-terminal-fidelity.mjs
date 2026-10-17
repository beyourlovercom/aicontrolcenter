/**
 * Offline P2 terminal-fidelity candidate.
 *
 * This module consumes only typed facts from an upstream adapter. It does not
 * parse process prose, execute commands, read devices, or change approvals.
 */

const STATUS_KEYS = ['state', 'exitCode', 'signal', 'runtimeMs'];
const PAGE_KEYS = ['lines', 'totalLines', 'readFrom', 'readCount', 'remaining', 'isComplete', 'evictedLines'];
const SIGNALS = new Set([
  'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS', 'SIGFPE',
  'SIGKILL', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGPIPE', 'SIGALRM', 'SIGTERM',
  'SIGCHLD', 'SIGCONT', 'SIGSTOP', 'SIGTSTP', 'SIGTTIN', 'SIGTTOU', 'SIGURG',
  'SIGXCPU', 'SIGXFSZ', 'SIGVTALRM', 'SIGPROF', 'SIGWINCH', 'SIGIO', 'SIGPWR',
  'SIGSYS',
]);
const UTF8_PREFIX =
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ' +
  '$OutputEncoding = [System.Text.Encoding]::UTF8; ';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function ownDataRecordSnapshot(value, expected, invalidCode, required = expected) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (keys.length > expected.length) return null;

    const snapshot = Object.create(null);
    for (const key of keys) {
      if (typeof key !== 'string' || !expected.includes(key)) return null;
      const descriptor = descriptors[key];
      if (!descriptor || descriptor.enumerable !== true ||
          !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      snapshot[key] = descriptor.value;
    }
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(snapshot, key)) return null;
    }
    return snapshot;
  } catch {
    throw fail(invalidCode);
  }
}

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

function safeInteger(value) {
  return Number.isSafeInteger(value);
}

/** Normalize typed terminal facts without inventing an exit code or signal. */
export function normalizeProcessStatus(facts) {
  let snapshot;
  try {
    snapshot = ownDataRecordSnapshot(facts, STATUS_KEYS, 'P2_TERMINAL_STATUS_INVALID');
  } catch {
    throw fail('P2_TERMINAL_STATUS_INVALID');
  }
  if (!snapshot || !['running', 'completed'].includes(snapshot.state) ||
      !(snapshot.runtimeMs === null || finiteNonNegative(snapshot.runtimeMs)))
    throw fail('P2_TERMINAL_STATUS_INVALID');

  const { exitCode, signal } = snapshot;
  if (!(exitCode === null || safeInteger(exitCode)) || !(signal === null ||
      (typeof signal === 'string' && SIGNALS.has(signal))))
    throw fail('P2_TERMINAL_STATUS_INVALID');

  if (snapshot.state === 'running' && (exitCode !== null || signal !== null))
    throw fail('P2_TERMINAL_STATUS_CONTRADICTORY');
  if (snapshot.state === 'completed' && exitCode !== null && signal !== null)
    throw fail('P2_TERMINAL_STATUS_CONTRADICTORY');

  const status = snapshot.state === 'running' ? 'running' :
    exitCode !== null ? 'exited' : signal !== null ? 'signaled' : 'unknown';
  return Object.freeze({
    status,
    exitCode,
    signal,
    runtimeMs: snapshot.runtimeMs,
  });
}

function safeLineSnapshot(lines) {
  try {
    if (!Array.isArray(lines)) return null;
    const keys = Reflect.ownKeys(lines);
    const descriptors = Object.getOwnPropertyDescriptors(lines);
    const lengthDescriptor = descriptors.length;
    if (!lengthDescriptor || lengthDescriptor.enumerable !== false ||
        !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ||
        !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0)
      return null;

    const clone = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const key = String(index);
      const descriptor = descriptors[key];
      if (!descriptor || descriptor.enumerable !== true ||
          !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          typeof descriptor.value !== 'string') return null;
      clone.push(descriptor.value);
    }
    // Inspect every own property so an accessor cannot hide a later trap.
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
    }
    return Object.freeze(clone);
  } catch {
    throw fail('P2_TERMINAL_PAGE_INVALID');
  }
}

/**
 * Validate a page made from the upstream authoritative lines array.
 * `evictedLines` is the upstream count; it is never inferred locally.
 */
export function normalizeTerminalLinePage(page) {
  let snapshot;
  try {
    snapshot = ownDataRecordSnapshot(page, PAGE_KEYS, 'P2_TERMINAL_PAGE_INVALID');
  } catch {
    throw fail('P2_TERMINAL_PAGE_INVALID');
  }
  if (!snapshot)
    throw fail('P2_TERMINAL_PAGE_INVALID');
  const lines = safeLineSnapshot(snapshot.lines);
  if (!lines ||
      !safeInteger(snapshot.totalLines) || snapshot.totalLines < 0 ||
      !safeInteger(snapshot.readFrom) || snapshot.readFrom < 0 ||
      !safeInteger(snapshot.readCount) || snapshot.readCount < 0 ||
      !safeInteger(snapshot.remaining) || snapshot.remaining < 0 ||
      typeof snapshot.isComplete !== 'boolean' ||
      !safeInteger(snapshot.evictedLines) || snapshot.evictedLines < 0 ||
      lines.length !== snapshot.readCount)
    throw fail('P2_TERMINAL_PAGE_INVALID');

  if ((snapshot.readFrom >= snapshot.totalLines && (snapshot.readCount !== 0 || snapshot.remaining !== 0)) ||
      (snapshot.readFrom < snapshot.totalLines && snapshot.readFrom + snapshot.readCount > snapshot.totalLines) ||
      snapshot.remaining > Math.max(0, snapshot.totalLines - snapshot.readFrom - snapshot.readCount))
    throw fail('P2_TERMINAL_PAGE_CONTRADICTORY');

  return Object.freeze({
    lines,
    totalLines: snapshot.totalLines,
    readFrom: snapshot.readFrom,
    readCount: snapshot.readCount,
    remaining: snapshot.remaining,
    isComplete: snapshot.isComplete,
    evictedLines: snapshot.evictedLines,
  });
}

function commandStartsWithDirective(command) {
  return /^(?:\uFEFF)?\s*(?:#|#requires\b|using\b|param\s*\()/iu.test(command);
}

function isSafeSingleLinePowerShellCommand(command) {
  return command.length > 0 && !/[\r\n]/u.test(command) &&
    !commandStartsWithDirective(command) &&
    !/(?:@['"]|['"]@|\{[^}]*\})/u.test(command);
}

/**
 * Construct, but never execute, the explicitly opted-in per-process PowerShell
 * UTF-8 prefix. The caller must authorize the returned complete command.
 */
export function optInPowerShellUtf8Command(options = {}) {
  let snapshot;
  try {
    snapshot = ownDataRecordSnapshot(options, ['command', 'deviceId', 'shell', 'optIn'], 'P2_TERMINAL_COMMAND_INVALID', ['command']);
  } catch {
    throw fail('P2_TERMINAL_COMMAND_INVALID');
  }
  if (!snapshot || typeof snapshot.command !== 'string' ||
      ('deviceId' in snapshot && typeof snapshot.deviceId !== 'string') ||
      ('shell' in snapshot && typeof snapshot.shell !== 'string') ||
      ('optIn' in snapshot && typeof snapshot.optIn !== 'boolean'))
    throw fail('P2_TERMINAL_COMMAND_INVALID');
  const { command } = snapshot;
  const optIn = Object.prototype.hasOwnProperty.call(snapshot, 'optIn') ? snapshot.optIn : false;
  if (!optIn) return command;
  if (typeof snapshot.deviceId !== 'string' || typeof snapshot.shell !== 'string' ||
      !snapshot.deviceId || !snapshot.shell)
    throw fail('P2_TERMINAL_COMMAND_INVALID');
  if (!/^(?:windows|007windows)$/iu.test(snapshot.deviceId) || !/^(?:powershell\.exe|pwsh\.exe)$/iu.test(snapshot.shell))
    throw fail('P2_TERMINAL_UTF8_SCOPE_DENIED');
  if (commandStartsWithDirective(command)) throw fail('P2_TERMINAL_UTF8_DIRECTIVE_UNSUPPORTED');
  if (!isSafeSingleLinePowerShellCommand(command)) throw fail('P2_TERMINAL_UTF8_COMMAND_UNSAFE');
  return UTF8_PREFIX + command;
}

/**
 * Render an already-authoritative typed page without conflating a real blank
 * line with a page that contains zero lines. This is PRESENTATION ONLY:
 * upstream must independently remove a terminal newline's phantom sentinel.
 *
 * 'rawText' retains the exact joined output (including real blank lines).
 * 'displayText' adds a label ONLY when the page is entirely blank. A caller
 * must use hasOutput/readCount rather than truthiness of the joined string.
 * No transport, process, device or Agent integration occurs in this helper.
 */
export function presentTerminalLinePage(page) {
  const normalized = normalizeTerminalLinePage(page);
  const { lines, readCount } = normalized;
  const hasOutput = readCount > 0;
  const blankOnly = hasOutput && lines.every((line) => line.length === 0);
  const rawText = lines.join('\n');
  const displayText = !hasOutput ? '(No output in requested range)' :
    blankOnly ? `(Blank output: ${readCount} line${readCount === 1 ? '' : 's'})` : rawText;
  return Object.freeze({
    rawText,
    displayText,
    hasOutput,
    blankOnly,
    lineCount: readCount,
  });
}

export const P2_TERMINAL_FIDELITY_CONTRACT = Object.freeze({
  version: 'aicc-p2-terminal-fidelity/v1',
  upstreamLineRule: 'Remove only the phantom empty trailing line after a newline upstream; preserve real blank lines here.',
  authorizationRule: 'The returned PowerShell command is unapproved data until the caller authorizes the complete value.',
});
