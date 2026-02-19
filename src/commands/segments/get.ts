import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const getSegmentCommand = new Command('get')
  .description('Retrieve a segment by ID')
  .argument('<id>', 'Segment UUID')
  .addHelpText(
    'after',
    `
Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"segment","id":"<uuid>","name":"<name>","created_at":"<iso-date>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | fetch_error

Examples:
  $ resend segments get 78261eea-8f8b-4381-83c6-79fa7120f1cf
  $ resend segments get 78261eea-8f8b-4381-83c6-79fa7120f1cf --json`
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching segment...');

    try {
      const { data, error } = await resend.segments.get(id);

      if (error) {
        spinner.fail('Failed to fetch segment');
        outputError({ message: error.message, code: 'fetch_error' }, { json: globalOpts.json });
      }

      spinner.stop('Segment fetched');

      if (!globalOpts.json && isInteractive()) {
        const d = data!;
        console.log(`\n${d.name}`);
        console.log(`ID: ${d.id}`);
        console.log(`Created: ${d.created_at}`);
      } else {
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to fetch segment');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'fetch_error' }, { json: globalOpts.json });
    }
  });
