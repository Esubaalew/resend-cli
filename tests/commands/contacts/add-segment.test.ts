import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockAddSegment = mock(async () => ({
  data: { id: 'seg_123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = {
      segments: { add: mockAddSegment },
    };
  },
}));

describe('contacts add-segment command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockAddSegment.mockClear();
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

  test('adds contact to segment by contact ID', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { addContactSegmentCommand } = await import('../../../src/commands/contacts/add-segment');
    await addContactSegmentCommand.parseAsync(['contact_abc123', '--segment-id', 'seg_123'], { from: 'user' });

    expect(mockAddSegment).toHaveBeenCalledTimes(1);
    const args = mockAddSegment.mock.calls[0][0] as any;
    expect(args.contactId).toBe('contact_abc123');
    expect(args.segmentId).toBe('seg_123');
  });

  test('adds contact to segment by email', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { addContactSegmentCommand } = await import('../../../src/commands/contacts/add-segment');
    await addContactSegmentCommand.parseAsync(['jane@example.com', '--segment-id', 'seg_123'], { from: 'user' });

    const args = mockAddSegment.mock.calls[0][0] as any;
    expect(args.email).toBe('jane@example.com');
    expect(args.segmentId).toBe('seg_123');
  });

  test('outputs JSON result when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { addContactSegmentCommand } = await import('../../../src/commands/contacts/add-segment');
    await addContactSegmentCommand.parseAsync(['contact_abc123', '--segment-id', 'seg_123'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('seg_123');
  });

  test('errors with missing_segment_id when --segment-id absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { addContactSegmentCommand } = await import('../../../src/commands/contacts/add-segment');
    try {
      await addContactSegmentCommand.parseAsync(['contact_abc123'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_segment_id');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { addContactSegmentCommand } = await import('../../../src/commands/contacts/add-segment');
    try {
      await addContactSegmentCommand.parseAsync(['contact_abc123', '--segment-id', 'seg_123'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with add_segment_error when SDK returns an error', async () => {
    setNonInteractive();
    mockAddSegment.mockResolvedValueOnce({ data: null, error: { message: 'Segment not found', name: 'not_found' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { addContactSegmentCommand } = await import('../../../src/commands/contacts/add-segment');
    try {
      await addContactSegmentCommand.parseAsync(['contact_abc123', '--segment-id', 'bad_seg'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('add_segment_error');
  });
});
