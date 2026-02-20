import { Command } from '@commander-js/extra-typings';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { GlobalOpts } from '../../lib/client';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { mergeJsonConfig } from './utils';

const RESEND_MCP_ENTRY = { command: 'resend', args: ['mcp', 'serve'] };

export async function setupClaudeCode(globalOpts: GlobalOpts): Promise<void> {
  try {
    execFileSync('claude', ['mcp', 'add', 'resend', '--', 'resend', 'mcp', 'serve'], {
      stdio: 'inherit',
    });
  } catch (err: unknown) {
    const isNotFound =
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';

    if (!isNotFound) {
      outputError(
        {
          message: `claude mcp add failed: ${errorMessage(err, 'unknown error')}`,
          code: 'claude_mcp_add_failed',
        },
        { json: globalOpts.json },
      );
    }

    // Fallback: `claude` binary not found — write ~/.claude.json directly
    const configPath = join(homedir(), '.claude.json');
    try {
      mergeJsonConfig(configPath, (existing) => ({
        ...existing,
        mcpServers: {
          ...(existing.mcpServers as Record<string, unknown> | undefined),
          resend: RESEND_MCP_ENTRY,
        },
      }));
    } catch (writeErr) {
      outputError(
        {
          message: `Failed to write Claude Code config: ${errorMessage(writeErr, 'unknown error')}`,
          code: 'config_write_error',
        },
        { json: globalOpts.json },
      );
    }

    if (!globalOpts.json && isInteractive()) {
      console.log(`  ✔ Claude Code configured via ~/.claude.json (install \`claude\` CLI for full integration)`);
      console.log('  Install Claude Code: https://claude.ai/download');
    } else {
      outputResult(
        { configured: true, tool: 'claude-code', method: 'direct_write', config_path: configPath },
        { json: globalOpts.json },
      );
    }
    return;
  }

  if (!globalOpts.json && isInteractive()) {
    console.log('  ✔ Claude Code configured via `claude mcp add`');
    console.log('  Run `claude mcp list` to verify.');
  } else {
    outputResult({ configured: true, tool: 'claude-code', method: 'mcp_add' }, { json: globalOpts.json });
  }
}

export const claudeCodeCommand = new Command('claude-code')
  .description('Register Resend as an MCP server in Claude Code')
  .addHelpText('after', `
What it does:
  Runs \`claude mcp add resend -- resend mcp serve\` using the official Claude Code CLI.
  If the \`claude\` binary is not installed, falls back to writing ~/.claude.json directly.

Primary method (requires claude CLI):
  claude mcp add resend -- resend mcp serve
  Verify with: claude mcp list

Fallback method (no claude CLI):
  Writes ~/.claude.json
  {
    "mcpServers": {
      "resend": { "command": "resend", "args": ["mcp", "serve"] }
    }
  }

Install Claude Code CLI: https://claude.ai/download

JSON output:
  Primary:  { "configured": true, "tool": "claude-code", "method": "mcp_add" }
  Fallback: { "configured": true, "tool": "claude-code", "method": "direct_write", "config_path": "~/.claude.json" }

Error codes:
  claude_mcp_add_failed  \`claude\` found but \`claude mcp add\` exited non-zero
  config_write_error     ~/.claude.json write failed (fallback path)

Examples:
  $ resend setup claude-code
  $ resend setup claude-code --json`)
  .action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    return setupClaudeCode(globalOpts);
  });
