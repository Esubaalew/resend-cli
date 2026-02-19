import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockRemoveSegment = mock(async () => ({
  data: { id: 'seg_123', deleted: true },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = {
      segments: { remove: mockRemoveSegment },
    };
  },
}));

describe('contacts remove-segment command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemoveSegment.mockClear();
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

  test('removes contact from segment by contact ID', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { removeContactSegmentCommand } = await import('../../../src/commands/contacts/remove-segment');
    await removeContactSegmentCommand.parseAsync(['contact_abc123', 'seg_123'], { from: 'user' });

    expect(mockRemoveSegment).toHaveBeenCalledTimes(1);
    const args = mockRemoveSegment.mock.calls[0][0] as any;
    expect(args.contactId).toBe('contact_abc123');
    expect(args.segmentId).toBe('seg_123');
  });

  test('removes contact from segment by email', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { removeContactSegmentCommand } = await import('../../../src/commands/contacts/remove-segment');
    await removeContactSegmentCommand.parseAsync(['jane@example.com', 'seg_123'], { from: 'user' });

    const args = mockRemoveSegment.mock.calls[0][0] as any;
    expect(args.email).toBe('jane@example.com');
    expect(args.segmentId).toBe('seg_123');
  });

  test('outputs JSON result when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { removeContactSegmentCommand } = await import('../../../src/commands/contacts/remove-segment');
    await removeContactSegmentCommand.parseAsync(['contact_abc123', 'seg_123'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('seg_123');
    expect(parsed.deleted).toBe(true);
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { removeContactSegmentCommand } = await import('../../../src/commands/contacts/remove-segment');
    try {
      await removeContactSegmentCommand.parseAsync(['contact_abc123', 'seg_123'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with remove_segment_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemoveSegment.mockResolvedValueOnce({ data: null, error: { message: 'Not found', name: 'not_found' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { removeContactSegmentCommand } = await import('../../../src/commands/contacts/remove-segment');
    try {
      await removeContactSegmentCommand.parseAsync(['contact_abc123', 'bad_seg'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('remove_segment_error');
  });
});
