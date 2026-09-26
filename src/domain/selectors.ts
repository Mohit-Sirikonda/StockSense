import type { LedgerEntry, Product } from '../types';

export const inWarehouse = (warehouseId: string, scope: string) => scope === 'all' || warehouseId === scope;
export const movementInWarehouse = (from: string | undefined, to: string | undefined, scope: string) =>
  scope === 'all' || from === scope || to === scope;
export const stockAt = (product: Product, scope: string) =>
  scope === 'all' ? product.stock : (product.locationStock[scope] ?? 0);
export const productInWarehouse = (product: Product, scope: string) =>
  scope === 'all' || product.primaryLocationId === scope || Object.hasOwn(product.locationStock, scope);
export const newestLedger = (entries: LedgerEntry[]) =>
  [...entries].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

export function ledgerMovement(
  entry: LedgerEntry,
  scope: string,
): { text: string; tone: 'neutral' | 'positive' | 'negative' } {
  if (entry.operationType === 'Transfer' && scope === 'all')
    return { text: `${entry.quantityChange.toLocaleString()} ${entry.unit} moved`, tone: 'neutral' };
  const quantity =
    entry.operationType === 'Transfer' && entry.fromLocationId === scope
      ? -entry.quantityChange
      : entry.quantityChange;
  return {
    text: `${quantity > 0 ? '+' : ''}${quantity.toLocaleString()} ${entry.unit}`,
    tone: quantity > 0 ? 'positive' : quantity < 0 ? 'negative' : 'neutral',
  };
}

export function quantitySummary(items: { quantity: number; unit: string }[]): string {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.unit, (totals.get(item.unit) ?? 0) + item.quantity);
  return [...totals].map(([unit, total]) => `${total.toLocaleString()} ${unit}`).join(' · ') || '—';
}
