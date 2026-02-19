import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { confirmDelete } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const deleteSegmentCommand = new Command('delete')
  .description('Delete a segment')
  .argument('<id>', 'Segment UUID')
  .option('--yes', 'Skip the confirmation prompt (required in non-interactive mode)')
  .addHelpText(
    'after',
    `
⚠ Deleting a segment removes it as a target for future broadcasts,
  but does NOT delete the contacts within it.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"segment","id":"<uuid>","deleted":true}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | confirmation_required | delete_error

Examples:
  $ resend segments delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes
  $ resend segments delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes --json`
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (!opts.yes) {
      await confirmDelete(
        id,
        `Delete segment ${id}? Contacts will not be deleted, but broadcasts targeting this segment will no longer work.`,
        globalOpts
      );
    }

    const spinner = createSpinner('Deleting segment...');

    try {
      const { error } = await resend.segments.remove(id);

      if (error) {
        spinner.fail('Failed to delete segment');
        outputError({ message: error.message, code: 'delete_error' }, { json: globalOpts.json });
      }

      spinner.stop('Segment deleted');

      if (!globalOpts.json && isInteractive()) {
        console.log('Segment deleted.');
      } else {
        outputResult({ object: 'segment', id, deleted: true }, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to delete segment');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'delete_error' }, { json: globalOpts.json });
    }
  });
