/**
 * Tiny structured logger. No dependency.
 *
 * Output rules:
 *   - development: human-readable, coloured, single line.
 *   - production:  one JSON object per line, no colour.
 *   - test:        JSON (so tests can parse), but only warn and above
 *                  so the suite output stays readable.
 *
 * Levels: debug < info < warn < error.
 *
 * `info` and `debug` go to stdout; `warn` and `error` go to stderr.
 * This is the convention log aggregators expect and it means a CI
 * that captures only stderr still sees problems.
 *
 * No global mutable state: callers pass `requestId` in the context when
 * they have one. A shared "current request" variable would leak across
 * async operations.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown> & {
  /** Optional correlation id; passed through unchanged. */
  requestId?: string;
};

export type LogRecord = {
  level: LogLevel;
  timestamp: string;
  msg: string;
  context?: Record<string, unknown>;
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Reads the current minimum level. Exposed as a settable hook so tests
 * can override it without mutating process.env.NODE_ENV (which is
 * readonly in @types/node).
 *
 * Callers never touch `setMinLevel` in production code.
 */
let minLevelOverride: LogLevel | null = null;

export function setMinLevel(level: LogLevel | null): void {
  minLevelOverride = level;
}

function minLevel(): LogLevel {
  if (minLevelOverride) return minLevelOverride;
  const env = process.env.NODE_ENV;
  if (env === 'test') return 'warn';
  if (env === 'production') return 'info';
  return 'debug';
}

function isEnabled(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel()];
}

/**
 * Output format is decided by NODE_ENV. In tests, we still want JSON
 * (so assertions can parse), so `test` is treated like production for
 * output format. No override needed for the format.
 */
function useJsonOutput(): boolean {
  const env = process.env.NODE_ENV;
  return env === 'production' || env === 'test';
}

/**
 * Recursively prepare a value for JSON output. Errors become
 * { name, message, stack } rather than {} (JSON.stringify(new Error())
 * returns {}). Buffers are summarized rather than dumped.
 */
function prepare(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth exceeded]';
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }
  if (Array.isArray(value)) {
    return value.map((v) => prepare(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = prepare(v, depth + 1);
    }
    return out;
  }
  return value;
}

function prepareContext(context: LogContext | undefined): Record<string, unknown> | undefined {
  if (!context) return undefined;
  return prepare(context) as Record<string, unknown>;
}

function safeWrite(stream: 'stdout' | 'stderr', line: string): void {
  // In Node.js runtimes (server, routes, server components, scripts),
  // process.stdout / process.stderr exist and should be used so log
  // aggregators (Vercel, CloudWatch) capture the structured output.
  // In Edge runtimes (middleware), they don't. Fall back to console.*,
  // which Edge supports. The JSON shape is preserved.
  try {
    if (
      typeof process !== 'undefined' &&
      process &&
      process[stream] &&
      typeof process[stream].write === 'function'
    ) {
      process[stream].write(line);
      return;
    }
  } catch {
    // Fall through to console.
  }
  // eslint-disable-next-line no-console
  if (stream === 'stderr') console.error(line.trimEnd());
  // eslint-disable-next-line no-console
  else console.log(line.trimEnd());
}

function writeJson(record: LogRecord): void {
  const line = JSON.stringify(record) + '\n';
  const stream: 'stdout' | 'stderr' =
    record.level === 'warn' || record.level === 'error' ? 'stderr' : 'stdout';
  safeWrite(stream, line);
}

const COLOURS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m', // green
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
};
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

function writeHuman(record: LogRecord): void {
  const colour = COLOURS[record.level];
  const ts = record.timestamp.slice(11, 23); // HH:MM:SS.mmm
  const level = record.level.toUpperCase().padEnd(5);
  const ctx =
    record.context && Object.keys(record.context).length > 0
      ? ' ' + DIM + JSON.stringify(record.context) + RESET
      : '';
  const line = `${DIM}${ts}${RESET} ${colour}${level}${RESET} ${record.msg}${ctx}\n`;
  const stream: 'stdout' | 'stderr' =
    record.level === 'warn' || record.level === 'error' ? 'stderr' : 'stdout';
  safeWrite(stream, line);
}


function emit(level: LogLevel, msg: string, context?: LogContext): void {
  if (!isEnabled(level)) return;
  const preparedContext = prepareContext(context);
  const record: LogRecord = {
    level,
    timestamp: new Date().toISOString(),
    msg,
    ...(preparedContext && Object.keys(preparedContext).length > 0
      ? { context: preparedContext }
      : {}),
  };
  if (useJsonOutput()) {
    writeJson(record);
  } else {
    writeHuman(record);
  }
}

export const logger = {
  debug(msg: string, context?: LogContext): void {
    emit('debug', msg, context);
  },
  info(msg: string, context?: LogContext): void {
    emit('info', msg, context);
  },
  warn(msg: string, context?: LogContext): void {
    emit('warn', msg, context);
  },
  error(msg: string, context?: LogContext): void {
    emit('error', msg, context);
  },
};

export type Logger = typeof logger;
