import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { confirmDelete } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const deleteApiKeyCommand = new Command('delete')
  .description('Delete an API key — any services using it will immediately lose access')
  .argument('<id>', 'API key ID')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.

Warning: Deleting a key is immediate and irreversible. Any service using this key
will stop authenticating instantly. The current key (used to call this command)
can delete itself — the API does not prevent self-deletion.`,
      output: `  {"object":"api-key","id":"<id>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend api-keys delete dacf4072-aa82-4ff3-97de-514ae3000ee0 --yes',
        'resend api-keys delete dacf4072-aa82-4ff3-97de-514ae3000ee0 --yes --json',
      ],
    })
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = requireClient(globalOpts);

    if (!opts.yes) {
      await confirmDelete(id, `Delete API key ${id}? Any services using this key will stop working.`, globalOpts);
    }

    const spinner = createSpinner('Deleting API key...');

    try {
      const { error } = await resend.apiKeys.remove(id);

      if (error) {
        spinner.fail('Failed to delete API key');
        outputError({ message: error.message, code: 'delete_error' }, { json: globalOpts.json });
      }

      spinner.stop('API key deleted');

      if (!globalOpts.json && isInteractive()) {
        console.log('API key deleted.');
      } else {
        outputResult({ object: 'api-key', id, deleted: true }, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to delete API key');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'delete_error' },
        { json: globalOpts.json }
      );
    }
  });
