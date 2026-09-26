import type { InventorySnapshot, OperationStatus, OperationType } from '../types';
import { movementInWarehouse, productInWarehouse, stockAt, newestLedger } from './selectors';

export interface DashboardFilters {
  warehouse: string;
  category: string;
  document: OperationType | 'all';
  status: OperationStatus | 'all';
}
type DashboardState = Pick<
  InventorySnapshot,
  'products' | 'receipts' | 'deliveries' | 'transfers' | 'adjustments' | 'ledger'
>;
export interface DashboardDocument {
  id: string;
  type: OperationType;
  status: OperationStatus;
  date: string;
  partner: string;
  productIds: string[];
  from?: string;
  to?: string;
  page: 'receipts' | 'deliveries' | 'transfers' | 'adjustments';
}
export function selectDashboard(state: DashboardState, filters: DashboardFilters) {
  const categoryIds = new Set(
    state.products
      .filter((product) => filters.category === 'all' || product.category === filters.category)
      .map((product) => product.id),
  );
  const documents: DashboardDocument[] = [
    ...state.receipts.map((row) => ({
      id: row.id,
      type: 'Receipt' as const,
      status: row.status,
      date: row.date,
      partner: row.supplier,
      productIds: row.items.map((item) => item.productId),
      to: row.warehouseId,
      page: 'receipts' as const,
    })),
    ...state.deliveries.map((row) => ({
      id: row.id,
      type: 'Delivery' as const,
      status: row.status,
      date: row.date,
      partner: row.customer,
      productIds: row.items.map((item) => item.productId),
      from: row.warehouseId,
      page: 'deliveries' as const,
    })),
    ...state.transfers.map((row) => ({
      id: row.id,
      type: 'Transfer' as const,
      status: row.status,
      date: row.date,
      partner: row.productName,
      productIds: [row.productId],
      from: row.fromLocationId,
      to: row.toLocationId,
      page: 'transfers' as const,
    })),
    ...state.adjustments.map((row) => ({
      id: row.id,
      type: 'Adjustment' as const,
      status: row.status,
      date: row.date,
      partner: row.productName,
      productIds: [row.productId],
      from: row.locationId,
      page: 'adjustments' as const,
    })),
  ];
  const matches = documents
    .filter(
      (row) =>
        movementInWarehouse(row.from, row.to, filters.warehouse) &&
        (filters.document === 'all' || row.type === filters.document) &&
        (filters.status === 'all' || row.status === filters.status) &&
        (filters.category === 'all' || row.productIds.some((id) => categoryIds.has(id))),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const matchedProducts = new Set(matches.flatMap((row) => row.productIds));
  const hasDocumentFilter = filters.document !== 'all' || filters.status !== 'all';
  const products = state.products.filter(
    (product) =>
      categoryIds.has(product.id) &&
      productInWarehouse(product, filters.warehouse) &&
      (!hasDocumentFilter || matchedProducts.has(product.id)),
  );
  const pending = matches.filter((row) => !['Done', 'Canceled'].includes(row.status));
  const attention = products
    .filter((product) => stockAt(product, filters.warehouse) <= product.reorderLevel)
    .sort(
      (a, b) =>
        Number(stockAt(b, filters.warehouse) === 0) - Number(stockAt(a, filters.warehouse) === 0) ||
        a.sku.localeCompare(b.sku),
    );
  const activity = newestLedger(state.ledger).filter(
    (entry) =>
      movementInWarehouse(entry.fromLocationId, entry.toLocationId, filters.warehouse) &&
      (filters.category === 'all' || categoryIds.has(entry.productId)) &&
      (filters.document === 'all' || entry.operationType === filters.document) &&
      (filters.status === 'all' || filters.status === 'Done'),
  );
  return {
    products,
    attention,
    documents: matches,
    activity,
    inStock: products.filter((product) => stockAt(product, filters.warehouse) > 0).length,
    pendingReceipts: pending.filter((row) => row.type === 'Receipt').length,
    pendingDeliveries: pending.filter((row) => row.type === 'Delivery').length,
    scheduledTransfers: pending.filter((row) => row.type === 'Transfer').length,
  };
}
