import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockUpdate = mock(async () => ({
  data: { object: 'contact' as const, id: 'contact_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = { update: mockUpdate };
  },
}));

describe('contacts update command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
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

  test('updates contact by ID with --unsubscribed', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactCommand } = await import('../../../src/commands/contacts/update');
    await updateContactCommand.parseAsync(['contact_abc123', '--unsubscribed'], { from: 'user' });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0][0] as any;
    expect(args.id).toBe('contact_abc123');
    expect(args.unsubscribed).toBe(true);
  });

  test('updates contact by email with --no-unsubscribed', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactCommand } = await import('../../../src/commands/contacts/update');
    await updateContactCommand.parseAsync(['jane@example.com', '--no-unsubscribed'], { from: 'user' });

    const args = mockUpdate.mock.calls[0][0] as any;
    expect(args.email).toBe('jane@example.com');
    expect(args.unsubscribed).toBe(false);
  });

  test('parses --properties JSON and passes to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactCommand } = await import('../../../src/commands/contacts/update');
    await updateContactCommand.parseAsync(
      ['contact_abc123', '--properties', '{"plan":"pro"}'],
      { from: 'user' }
    );

    const args = mockUpdate.mock.calls[0][0] as any;
    expect(args.properties).toEqual({ plan: 'pro' });
  });

  test('does not include unsubscribed when neither flag is passed', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactCommand } = await import('../../../src/commands/contacts/update');
    await updateContactCommand.parseAsync(['contact_abc123'], { from: 'user' });

    const args = mockUpdate.mock.calls[0][0] as any;
    expect(args.unsubscribed).toBeUndefined();
  });

  test('outputs JSON result when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactCommand } = await import('../../../src/commands/contacts/update');
    await updateContactCommand.parseAsync(['contact_abc123', '--unsubscribed'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('contact_abc123');
    expect(parsed.object).toBe('contact');
  });

  test('errors with invalid_properties when --properties is not valid JSON', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactCommand } = await import('../../../src/commands/contacts/update');
    try {
      await updateContactCommand.parseAsync(['contact_abc123', '--properties', 'bad-json'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_properties');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactCommand } = await import('../../../src/commands/contacts/update');
    try {
      await updateContactCommand.parseAsync(['contact_abc123', '--unsubscribed'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce({ data: null, error: { message: 'Contact not found', name: 'not_found' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateContactCommand } = await import('../../../src/commands/contacts/update');
    try {
      await updateContactCommand.parseAsync(['nonexistent_id', '--unsubscribed'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
