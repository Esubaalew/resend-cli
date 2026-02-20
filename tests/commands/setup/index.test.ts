import { describe, test, expect, mock, spyOn, afterEach } from 'bun:test';
import { captureTestEnv, setNonInteractive, mockExitThrow, expectExit1 } from '../../helpers';

// Mock all subcommand modules so index.ts can be imported without touching node:fs
const mockSetupCursor = mock(async () => {});
const mockSetupClaudeDesktop = mock(async () => {});
const mockSetupClaudeCode = mock(async () => {});
const mockSetupVscode = mock(async () => {});
const mockSetupOpenclaw = mock(async () => {});

mock.module('../../../src/commands/setup/cursor', () => ({
  setupCursor: mockSetupCursor,
  cursorCommand: new (require('@commander-js/extra-typings').Command)('cursor'),
}));
mock.module('../../../src/commands/setup/claude-desktop', () => ({
  setupClaudeDesktop: mockSetupClaudeDesktop,
  claudeDesktopCommand: new (require('@commander-js/extra-typings').Command)('claude-desktop'),
}));
mock.module('../../../src/commands/setup/claude-code', () => ({
  setupClaudeCode: mockSetupClaudeCode,
  claudeCodeCommand: new (require('@commander-js/extra-typings').Command)('claude-code'),
}));
mock.module('../../../src/commands/setup/vscode', () => ({
  setupVscode: mockSetupVscode,
  vscodeCommand: new (require('@commander-js/extra-typings').Command)('vscode'),
}));
mock.module('../../../src/commands/setup/openclaw', () => ({
  setupOpenclaw: mockSetupOpenclaw,
  openclawCommand: new (require('@commander-js/extra-typings').Command)('openclaw'),
}));

describe('setup index — non-interactive guard', () => {
  const restoreEnv = captureTestEnv();
  afterEach(() => restoreEnv());

  test('errors with missing_target when run non-interactively without a subcommand', async () => {
    setNonInteractive();
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    try {
      const { setupCommand } = await import('../../../src/commands/setup/index');
      await expectExit1(() => setupCommand.parseAsync([], { from: 'user' }));

      const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('missing_target');
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });

  test('all five subcommands are registered on setupCommand', async () => {
    const { setupCommand } = await import('../../../src/commands/setup/index');
    const names = setupCommand.commands.map((c) => c.name());
    expect(names).toContain('cursor');
    expect(names).toContain('claude-desktop');
    expect(names).toContain('claude-code');
    expect(names).toContain('vscode');
    expect(names).toContain('openclaw');
  });
});
