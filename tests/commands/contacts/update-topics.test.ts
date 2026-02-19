import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockUpdateTopics = mock(async () => ({
  data: { id: 'contact_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = {
      topics: { update: mockUpdateTopics },
    };
  },
}));

describe('contacts update-topics command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdateTopics.mockClear();
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

  test('updates topics by contact ID', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactTopicsCommand } = await import('../../../src/commands/contacts/update-topics');
    await updateContactTopicsCommand.parseAsync(
      ['contact_abc123', '--topics', '[{"id":"topic_abc","subscription":"opt_in"}]'],
      { from: 'user' }
    );

    expect(mockUpdateTopics).toHaveBeenCalledTimes(1);
    const args = mockUpdateTopics.mock.calls[0][0] as any;
    expect(args.id).toBe('contact_abc123');
    expect(args.topics).toEqual([{ id: 'topic_abc', subscription: 'opt_in' }]);
  });

  test('updates topics by contact email', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactTopicsCommand } = await import('../../../src/commands/contacts/update-topics');
    await updateContactTopicsCommand.parseAsync(
      ['jane@example.com', '--topics', '[{"id":"topic_abc","subscription":"opt_out"}]'],
      { from: 'user' }
    );

    const args = mockUpdateTopics.mock.calls[0][0] as any;
    expect(args.email).toBe('jane@example.com');
    expect(args.topics[0].subscription).toBe('opt_out');
  });

  test('passes multiple topics in array', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactTopicsCommand } = await import('../../../src/commands/contacts/update-topics');
    await updateContactTopicsCommand.parseAsync(
      ['contact_abc123', '--topics', '[{"id":"t1","subscription":"opt_in"},{"id":"t2","subscription":"opt_out"}]'],
      { from: 'user' }
    );

    const args = mockUpdateTopics.mock.calls[0][0] as any;
    expect(args.topics).toHaveLength(2);
  });

  test('outputs JSON result when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactTopicsCommand } = await import('../../../src/commands/contacts/update-topics');
    await updateContactTopicsCommand.parseAsync(
      ['contact_abc123', '--topics', '[{"id":"topic_abc","subscription":"opt_in"}]'],
      { from: 'user' }
    );

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('contact_abc123');
  });

  test('errors with missing_topics when --topics absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import('../../../src/commands/contacts/update-topics');
    try {
      await updateContactTopicsCommand.parseAsync(['contact_abc123'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_topics');
  });

  test('errors with invalid_topics when --topics is not valid JSON', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import('../../../src/commands/contacts/update-topics');
    try {
      await updateContactTopicsCommand.parseAsync(['contact_abc123', '--topics', 'not-json'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_topics');
  });

  test('errors with invalid_topics when --topics is not an array', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import('../../../src/commands/contacts/update-topics');
    try {
      await updateContactTopicsCommand.parseAsync(['contact_abc123', '--topics', '{"id":"t1"}'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_topics');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import('../../../src/commands/contacts/update-topics');
    try {
      await updateContactTopicsCommand.parseAsync(
        ['contact_abc123', '--topics', '[{"id":"t1","subscription":"opt_in"}]'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_topics_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdateTopics.mockResolvedValueOnce({ data: null, error: { message: 'Topic not found', name: 'not_found' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import('../../../src/commands/contacts/update-topics');
    try {
      await updateContactTopicsCommand.parseAsync(
        ['contact_abc123', '--topics', '[{"id":"bad_topic","subscription":"opt_in"}]'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_topics_error');
  });
});
