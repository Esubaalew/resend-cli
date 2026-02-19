import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockCreate = mock(async () => ({
  data: { object: 'contact' as const, id: 'contact_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = { create: mockCreate };
  },
}));

describe('contacts create command', () => {
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

  test('creates contact with --email flag', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactCommand } = await import('../../../src/commands/contacts/create');
    await createContactCommand.parseAsync(['--email', 'jane@example.com'], { from: 'user' });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.email).toBe('jane@example.com');
  });

  test('outputs JSON id when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactCommand } = await import('../../../src/commands/contacts/create');
    await createContactCommand.parseAsync(['--email', 'jane@example.com'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('contact_abc123');
    expect(parsed.object).toBe('contact');
  });

  test('passes --first-name and --last-name to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactCommand } = await import('../../../src/commands/contacts/create');
    await createContactCommand.parseAsync(
      ['--email', 'jane@example.com', '--first-name', 'Jane', '--last-name', 'Smith'],
      { from: 'user' }
    );

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.firstName).toBe('Jane');
    expect(args.lastName).toBe('Smith');
  });

  test('passes --unsubscribed flag to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactCommand } = await import('../../../src/commands/contacts/create');
    await createContactCommand.parseAsync(['--email', 'jane@example.com', '--unsubscribed'], { from: 'user' });

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.unsubscribed).toBe(true);
  });

  test('parses --properties JSON and passes to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactCommand } = await import('../../../src/commands/contacts/create');
    await createContactCommand.parseAsync(
      ['--email', 'jane@example.com', '--properties', '{"company":"Acme","plan":"pro"}'],
      { from: 'user' }
    );

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.properties).toEqual({ company: 'Acme', plan: 'pro' });
  });

  test('passes --segment-id (single) to SDK as segments array', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactCommand } = await import('../../../src/commands/contacts/create');
    await createContactCommand.parseAsync(['--email', 'jane@example.com', '--segment-id', 'seg_123'], { from: 'user' });

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.segments).toEqual([{ id: 'seg_123' }]);
  });

  test('passes multiple --segment-id values to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactCommand } = await import('../../../src/commands/contacts/create');
    await createContactCommand.parseAsync(
      ['--email', 'jane@example.com', '--segment-id', 'seg_abc', '--segment-id', 'seg_def'],
      { from: 'user' }
    );

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.segments).toEqual([{ id: 'seg_abc' }, { id: 'seg_def' }]);
  });

  test('errors with missing_email in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactCommand } = await import('../../../src/commands/contacts/create');
    try {
      await createContactCommand.parseAsync([], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_email');
  });

  test('errors with invalid_properties when --properties is not valid JSON', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactCommand } = await import('../../../src/commands/contacts/create');
    try {
      await createContactCommand.parseAsync(['--email', 'jane@example.com', '--properties', 'not-json'], { from: 'user' });
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

    const { createContactCommand } = await import('../../../src/commands/contacts/create');
    try {
      await createContactCommand.parseAsync(['--email', 'jane@example.com'], { from: 'user' });
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
    mockCreate.mockResolvedValueOnce({ data: null, error: { message: 'Contact already exists', name: 'validation_error' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createContactCommand } = await import('../../../src/commands/contacts/create');
    try {
      await createContactCommand.parseAsync(['--email', 'jane@example.com'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
