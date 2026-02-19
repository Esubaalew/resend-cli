import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { parseLimitOpt, buildPaginationOpts } from '../../lib/pagination';
import { isInteractive } from '../../lib/tty';
import { renderSegmentsTable } from './utils';

export const listSegmentsCommand = new Command('list')
  .description('List all segments')
  .option('--limit <n>', 'Maximum number of segments to return (1-100)', '10')
  .option('--after <cursor>', 'Return segments after this cursor (next page)')
  .option('--before <cursor>', 'Return segments before this cursor (previous page)')
  .addHelpText(
    'after',
    `
Pagination: use --after or --before with a segment ID as the cursor.
  Only one of --after or --before may be used at a time.
  The response includes has_more: true when additional pages exist.

Use "resend segments list" to discover segment IDs for use with broadcasts
or "resend contacts add-segment".

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"list","data":[{"id":"<uuid>","name":"<name>","created_at":"<iso-date>"}],"has_more":false}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | invalid_limit | list_error

Examples:
  $ resend segments list
  $ resend segments list --limit 25 --json
  $ resend segments list --after 78261eea-8f8b-4381-83c6-79fa7120f1cf --json`
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(limit, opts.after, opts.before);

    const spinner = createSpinner('Fetching segments...');

    try {
      const { data, error } = await resend.segments.list(paginationOpts);

      if (error) {
        spinner.fail('Failed to list segments');
        outputError({ message: error.message, code: 'list_error' }, { json: globalOpts.json });
      }

      spinner.stop('Segments fetched');

      const list = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(renderSegmentsTable(list.data));
        if (list.has_more && list.data.length > 0) {
          const last = list.data[list.data.length - 1];
          console.log(`\nMore results available. Use --after ${last.id} to fetch the next page.`);
        }
      } else {
        outputResult(list, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list segments');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'list_error' }, { json: globalOpts.json });
    }
  });
