import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockCreate = mock(async () => ({
  data: { id: 'test-key-id', token: 're_testtoken1234567890' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    apiKeys = { create: mockCreate };
  },
}));

describe('api-keys create command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    stderrSpy?.mockRestore();
  });

  test('creates API key with --name flag', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createApiKeyCommand } = await import('../../../src/commands/api-keys/create');
    await createApiKeyCommand.parseAsync(['--name', 'Production'], { from: 'user' });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.name).toBe('Production');
  });

  test('passes permission flag to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createApiKeyCommand } = await import('../../../src/commands/api-keys/create');
    await createApiKeyCommand.parseAsync(
      ['--name', 'CI Token', '--permission', 'sending_access'],
      { from: 'user' }
    );

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.permission).toBe('sending_access');
  });

  test('passes domain_id (snake_case) to SDK when --domain-id is provided', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createApiKeyCommand } = await import('../../../src/commands/api-keys/create');
    await createApiKeyCommand.parseAsync(
      ['--name', 'Domain Token', '--permission', 'sending_access', '--domain-id', 'domain-123'],
      { from: 'user' }
    );

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.domain_id).toBe('domain-123');
  });

  test('outputs JSON result when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createApiKeyCommand } = await import('../../../src/commands/api-keys/create');
    await createApiKeyCommand.parseAsync(['--name', 'Production'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('test-key-id');
    expect(parsed.token).toBe('re_testtoken1234567890');
  });

  test('errors with missing_name when --name absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createApiKeyCommand } = await import('../../../src/commands/api-keys/create');
    try {
      await createApiKeyCommand.parseAsync([], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  test('does not call SDK when missing_name error is raised', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createApiKeyCommand } = await import('../../../src/commands/api-keys/create');
    try {
      await createApiKeyCommand.parseAsync([], { from: 'user' });
    } catch {
      // expected exit
    }

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createApiKeyCommand } = await import('../../../src/commands/api-keys/create');
    try {
      await createApiKeyCommand.parseAsync(['--name', 'Production'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce({ data: null, error: { message: 'Name already taken', name: 'validation_error' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createApiKeyCommand } = await import('../../../src/commands/api-keys/create');
    try {
      await createApiKeyCommand.parseAsync(['--name', 'Production'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
