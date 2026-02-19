import { Command } from '@commander-js/extra-typings';
import * as p from '@clack/prompts';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const createSegmentCommand = new Command('create')
  .description('Create a new segment')
  .option('--name <name>', 'Segment name (required)')
  .addHelpText(
    'after',
    `
Segments are named groups of contacts. Broadcasts target segments via segment_id.
Contacts can belong to multiple segments. Audiences are deprecated — use segments instead.

Non-interactive: --name is required.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"segment","id":"<uuid>","name":"<name>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | missing_name | create_error

Examples:
  $ resend segments create --name "Newsletter Subscribers"
  $ resend segments create --name "Beta Users" --json`
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    let name = opts.name;

    if (!name) {
      if (!isInteractive()) {
        outputError({ message: 'Missing --name flag.', code: 'missing_name' }, { json: globalOpts.json });
      }
      const result = await p.text({
        message: 'Segment name',
        placeholder: 'Newsletter Subscribers',
        validate: (v) => (!v ? 'Name is required' : undefined),
      });
      if (p.isCancel(result)) cancelAndExit('Cancelled.');
      name = result;
    }

    const spinner = createSpinner('Creating segment...');

    try {
      const { data, error } = await resend.segments.create({ name: name! });

      if (error) {
        spinner.fail('Failed to create segment');
        outputError({ message: error.message, code: 'create_error' }, { json: globalOpts.json });
      }

      spinner.stop('Segment created');

      if (!globalOpts.json && isInteractive()) {
        const d = data!;
        console.log(`\nSegment created: ${d.id}`);
        console.log(`Name: ${d.name}`);
      } else {
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to create segment');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'create_error' }, { json: globalOpts.json });
    }
  });
