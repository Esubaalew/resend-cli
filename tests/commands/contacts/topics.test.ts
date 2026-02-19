import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockListTopics = mock(async () => ({
  data: {
    object: 'list' as const,
    data: [
      { id: 'topic_abc', name: 'Product Updates', description: 'Updates about the product', subscription: 'opt_in' as const },
    ],
    has_more: false,
  },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = {
      topics: { list: mockListTopics },
    };
  },
}));

describe('contacts topics command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockListTopics.mockClear();
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

  test('lists topics by contact ID', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listContactTopicsCommand } = await import('../../../src/commands/contacts/topics');
    await listContactTopicsCommand.parseAsync(['contact_abc123'], { from: 'user' });

    expect(mockListTopics).toHaveBeenCalledTimes(1);
    const args = mockListTopics.mock.calls[0][0] as any;
    expect(args.id).toBe('contact_abc123');
  });

  test('lists topics by contact email', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listContactTopicsCommand } = await import('../../../src/commands/contacts/topics');
    await listContactTopicsCommand.parseAsync(['jane@example.com'], { from: 'user' });

    const args = mockListTopics.mock.calls[0][0] as any;
    expect(args.email).toBe('jane@example.com');
  });

  test('outputs JSON list when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listContactTopicsCommand } = await import('../../../src/commands/contacts/topics');
    await listContactTopicsCommand.parseAsync(['contact_abc123'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data[0].name).toBe('Product Updates');
    expect(parsed.data[0].subscription).toBe('opt_in');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listContactTopicsCommand } = await import('../../../src/commands/contacts/topics');
    try {
      await listContactTopicsCommand.parseAsync(['contact_abc123'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockListTopics.mockResolvedValueOnce({ data: null, error: { message: 'Not found', name: 'not_found' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listContactTopicsCommand } = await import('../../../src/commands/contacts/topics');
    try {
      await listContactTopicsCommand.parseAsync(['contact_abc123'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
