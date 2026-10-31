import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger, setMinLevel } from '../logger';

describe('logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    // Restore the default behaviour for each test.
    setMinLevel(null);
  });

  afterEach(() => {
    setMinLevel(null);
    vi.restoreAllMocks();
  });

  function lastStdout(): string {
    const calls = stdoutSpy.mock.calls;
    return String(calls[calls.length - 1]?.[0] ?? '');
  }

  function lastStderr(): string {
    const calls = stderrSpy.mock.calls;
    return String(calls[calls.length - 1]?.[0] ?? '');
  }

  it('emits JSON with the expected shape', () => {
    setMinLevel('debug');
    logger.info('hello', { requestId: 'abc', userId: 'u1' });

    const line = lastStdout();
    expect(line.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: 'info',
      msg: 'hello',
      context: { requestId: 'abc', userId: 'u1' },
    });
    expect(typeof parsed.timestamp).toBe('string');
    expect(new Date(parsed.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('routes warn and error to stderr', () => {
    setMinLevel('debug');
    logger.warn('careful');
    expect(lastStderr()).toContain('"level":"warn"');

    logger.error('boom');
    expect(lastStderr()).toContain('"level":"error"');
  });

  it('routes info and debug to stdout', () => {
    setMinLevel('debug');
    logger.info('ok');
    logger.debug('detail');
    expect(lastStdout()).toContain('"level":"debug"');
    expect(stderrSpy.mock.calls).toHaveLength(0);
  });

  it('filters below the minimum level', () => {
    setMinLevel('warn');
    logger.debug('nope');
    logger.info('nope');
    logger.warn('yes');
    expect(stdoutSpy.mock.calls).toHaveLength(0);
    expect(stderrSpy.mock.calls).toHaveLength(1);
  });

  it('filters below info when the level is info', () => {
    setMinLevel('info');
    logger.debug('nope');
    logger.info('yes');
    expect(stdoutSpy.mock.calls).toHaveLength(1);
    expect(stderrSpy.mock.calls).toHaveLength(0);
  });

  it('serializes Error instances into { name, message, stack }', () => {
    setMinLevel('debug');
    const err = new Error('something broke');
    logger.error('unexpected', { err });
    const parsed = JSON.parse(lastStderr());
    expect(parsed.context.err.name).toBe('Error');
    expect(parsed.context.err.message).toBe('something broke');
    expect(typeof parsed.context.err.stack).toBe('string');
  });

  it('handles nested contexts and buffers safely', () => {
    setMinLevel('debug');
    logger.info('nested', {
      outer: { inner: { deep: 1 } },
      buf: Buffer.from('abc'),
    });
    const parsed = JSON.parse(lastStdout());
    expect(parsed.context.outer.inner.deep).toBe(1);
    expect(parsed.context.buf).toBe('[Buffer 3 bytes]');
  });

  it('omits the context field entirely when none is given', () => {
    setMinLevel('debug');
    logger.info('bare');
    const parsed = JSON.parse(lastStdout());
    expect(parsed).not.toHaveProperty('context');
  });

  it('produces valid JSON for every level', () => {
    setMinLevel('debug');
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    const allCalls = [
      ...stdoutSpy.mock.calls.map((c:unknown[]) => String(c[0])),
      ...stderrSpy.mock.calls.map((c:unknown[]) => String(c[0])),
    ];
    for (const line of allCalls) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});
