import type { StockItem } from './types';

/** A deleted row is absent from current stock; audit snapshots never reserve an account. */
export function duplicateComplete(items: StockItem[], item: Pick<StockItem, 'id' | 'businessId' | 'stockKind' | 'platform' | 'username'>) {
  const normalized = (value: string) => value.trim().toLowerCase();
  if (item.stockKind === 'profile' || !item.username.trim()) return undefined;
  return items.find(row => row.id !== item.id && row.businessId === item.businessId && row.stockKind !== 'profile'
    && normalized(row.platform) === normalized(item.platform) && normalized(row.username) === normalized(item.username));
}
