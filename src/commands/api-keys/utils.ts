import { renderTable } from '../../lib/table';

export function renderApiKeysTable(
  keys: Array<{ id: string; name: string; created_at: string }>
): string {
  if (keys.length === 0) return '(no API keys)';
  const rows = keys.map((k) => [k.name, k.id, k.created_at]);
  return renderTable(['Name', 'ID', 'Created'], rows);
}
