import { describe, test, expect, mock, spyOn, afterEach, beforeEach } from 'bun:test';
import { captureTestEnv, setupOutputSpies, mockExitThrow, expectExit1 } from '../../helpers';

const mockExecFileSync = mock(() => {});
mock.module('node:child_process', () => ({ execFileSync: mockExecFileSync }));

const mockWriteFileSync = mock(() => {});
const mockMkdirSync = mock(() => {});
const mockReadFileSync = mock(() => '{}');
const mockExistsSync = mock(() => false);
const mockReaddirSync = mock(() => []);
const mockLstatSync = mock(() => ({ isDirectory: () => false }));
mock.module('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
  readdirSync: mockReaddirSync,
  lstatSync: mockLstatSync,
  unlinkSync: mock(() => {}),
  chmodSync: mock(() => {}),
}));

describe('setupClaudeCode', () => {
  const restoreEnv = captureTestEnv();

  beforeEach(() => {
    mockExecFileSync.mockClear();
    mockWriteFileSync.mockClear();
    mockReadFileSync.mockClear();
    mockExistsSync.mockClear();
    mockMkdirSync.mockClear();
    // Remove env key so resolveApiKey returns null → no -e flag in args
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => restoreEnv());

  test('calls claude mcp add with correct args on success', async () => {
    const { restore } = setupOutputSpies();
    try {
      const { setupClaudeCode } = await import('../../../src/commands/setup/claude-code');
      await setupClaudeCode({ json: true });

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'claude',
        ['mcp', 'add', 'resend', '--', 'npx', '-y', 'resend-mcp'],
        { stdio: 'inherit' },
      );
    } finally {
      restore();
    }
  });

  test('outputs JSON method:mcp_add on success', async () => {
    const { logSpy, restore } = setupOutputSpies();
    try {
      const { setupClaudeCode } = await import('../../../src/commands/setup/claude-code');
      await setupClaudeCode({ json: true });

      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.configured).toBe(true);
      expect(output.tool).toBe('claude-code');
      expect(output.method).toBe('mcp_add');
    } finally {
      restore();
    }
  });

  test('falls back to writing ~/.claude.json when claude binary not found (ENOENT)', async () => {
    const notFoundErr = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockExecFileSync.mockImplementationOnce(() => { throw notFoundErr; });
    const { logSpy, restore } = setupOutputSpies();
    try {
      const { setupClaudeCode } = await import('../../../src/commands/setup/claude-code');
      await setupClaudeCode({ json: true });

      expect(mockWriteFileSync).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.method).toBe('direct_write');
      expect(output.config_path).toContain('.claude.json');
    } finally {
      restore();
    }
  });

  test('calls outputError when claude binary exists but exits non-zero', async () => {
    const spawnErr = Object.assign(new Error('Command failed'), { code: 1, status: 1 });
    mockExecFileSync.mockImplementationOnce(() => { throw spawnErr; });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    try {
      const { setupClaudeCode } = await import('../../../src/commands/setup/claude-code');
      await expectExit1(() => setupClaudeCode({ json: true }));
      const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('claude_mcp_add_failed');
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
