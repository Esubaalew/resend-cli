import { Command } from '@commander-js/extra-typings';
import * as p from '@clack/prompts';
import { requireClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const deleteDomainCommand = new Command('delete')
  .description('Delete a domain')
  .argument('<id>', 'Domain ID')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    `
Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"domain","id":"<id>","deleted":true}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | confirmation_required | delete_error

Examples:
  $ resend domains delete 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --yes
  $ resend domains delete 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --yes --json`
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as { apiKey?: string; json?: boolean };

    const resend = requireClient(globalOpts);

    if (!opts.yes && !isInteractive()) {
      outputError(
        { message: 'Use --yes to confirm deletion in non-interactive mode.', code: 'confirmation_required' },
        { json: globalOpts.json }
      );
    }

    if (!opts.yes && isInteractive()) {
      const confirmed = await p.confirm({ message: `Delete domain ${id}? This cannot be undone.` });
      if (p.isCancel(confirmed) || !confirmed) cancelAndExit('Deletion cancelled.');
    }

    const spinner = createSpinner('Deleting domain...', 'braille');

    try {
      const { data, error } = await resend.domains.remove(id);

      if (error) {
        spinner.fail('Failed to delete domain');
        outputError({ message: error.message, code: 'delete_error' }, { json: globalOpts.json });
      }

      spinner.stop('Domain deleted');
      outputResult(data, { json: globalOpts.json });
    } catch (err) {
      spinner.fail('Failed to delete domain');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'delete_error' },
        { json: globalOpts.json }
      );
    }
  });
