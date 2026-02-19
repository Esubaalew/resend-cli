import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockRemove = mock(async () => ({
  data: { object: 'contact' as const, deleted: true, contact: 'contact_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = { remove: mockRemove };
  },
}));

describe('contacts delete command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemove.mockClear();
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

  test('deletes contact by ID with --yes', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { deleteContactCommand } = await import('../../../src/commands/contacts/delete');
    await deleteContactCommand.parseAsync(['contact_abc123', '--yes'], { from: 'user' });

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove.mock.calls[0][0]).toBe('contact_abc123');
  });

  test('deletes contact by email with --yes', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { deleteContactCommand } = await import('../../../src/commands/contacts/delete');
    await deleteContactCommand.parseAsync(['jane@example.com', '--yes'], { from: 'user' });

    expect(mockRemove.mock.calls[0][0]).toBe('jane@example.com');
  });

  test('outputs synthesized JSON result when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { deleteContactCommand } = await import('../../../src/commands/contacts/delete');
    await deleteContactCommand.parseAsync(['contact_abc123', '--yes'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('contact');
    expect(parsed.id).toBe('contact_abc123');
    expect(parsed.deleted).toBe(true);
  });

  test('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteContactCommand } = await import('../../../src/commands/contacts/delete');
    try {
      await deleteContactCommand.parseAsync(['contact_abc123'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
  });

  test('does not call SDK when confirmation_required error is raised', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteContactCommand } = await import('../../../src/commands/contacts/delete');
    try {
      await deleteContactCommand.parseAsync(['contact_abc123'], { from: 'user' });
    } catch {
      // expected exit
    }

    expect(mockRemove).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteContactCommand } = await import('../../../src/commands/contacts/delete');
    try {
      await deleteContactCommand.parseAsync(['contact_abc123', '--yes'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with delete_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemove.mockResolvedValueOnce({ data: null, error: { message: 'Contact not found', name: 'not_found' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { deleteContactCommand } = await import('../../../src/commands/contacts/delete');
    try {
      await deleteContactCommand.parseAsync(['nonexistent_id', '--yes'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('delete_error');
  });
});
