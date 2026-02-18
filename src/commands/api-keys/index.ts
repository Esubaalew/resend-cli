import { Command } from '@commander-js/extra-typings';
import { createApiKeyCommand } from './create';
import { listApiKeysCommand } from './list';
import { deleteApiKeyCommand } from './delete';

export const apiKeysCommand = new Command('api-keys')
  .description('Manage API keys for authentication')
  .addHelpText(
    'after',
    `
Security notes:
  - Tokens are only shown at creation time and cannot be retrieved again.
  - Use sending_access keys with --domain-id for per-domain CI tokens.
  - Deleting a key is immediate — any service using it loses access instantly.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Examples:
  $ resend api-keys list
  $ resend api-keys create --name "Production"
  $ resend api-keys create --name "CI Token" --permission sending_access --domain-id <domain-id>
  $ resend api-keys delete <id> --yes`
  )
  .addCommand(createApiKeyCommand)
  .addCommand(listApiKeysCommand)
  .addCommand(deleteApiKeyCommand);
