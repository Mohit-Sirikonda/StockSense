import type { InventorySnapshot } from '../types';

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function object(value: unknown): asserts value is Record<string, any> {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected a data object.');
}
function text(value: unknown): asserts value is string {
  ensure(typeof value === 'string' && value.trim().length > 0, 'Required text is missing.');
}
function strings(row: Record<string, any>, fields: string[]) {
  for (const key of fields) text(row[key]);
}
function optionalStrings(row: Record<string, any>, fields: string[]) {
  for (const key of fields) ensure(row[key] === undefined || typeof row[key] === 'string', `Invalid ${key}.`);
}
export function finiteQuantity(value: unknown, allowZero = true): asserts value is number {
  ensure(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value <= Number.MAX_SAFE_INTEGER &&
      (allowZero ? value >= 0 : value > 0),
    'Quantity must be finite and non-negative (greater than zero for movements).',
  );
}
function timestamp(value: unknown) {
  text(value);
  ensure(Number.isFinite(Date.parse(value)), 'Invalid timestamp.');
}
function date(value: unknown) {
  text(value);
  ensure(
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    'Invalid operation date.',
  );
}
function unique(rows: any[], field: string, normalize = false) {
  const values = rows.map((row) => (normalize ? row[field].trim().toUpperCase() : row[field]));
  ensure(new Set(values).size === values.length, `Duplicate ${field}.`);
}
const statuses = ['Draft', 'Waiting', 'Ready', 'Done', 'Canceled'];
const itemFields = ['productId', 'productName', 'sku', 'unit'];

export function validateInventory(value: unknown): asserts value is InventorySnapshot {
  object(value);
  ensure(value.version === 1, 'Unsupported inventory version.');
  for (const key of [
    'products',
    'locations',
    'receipts',
    'deliveries',
    'transfers',
    'adjustments',
    'ledger',
  ]) {
    ensure(Array.isArray(value[key]), `Invalid ${key} collection.`);
    for (const row of value[key]) {
      object(row);
      text(row.id);
    }
    unique(value[key], 'id');
  }
  object(value.submittedRequests);
  for (const [key, id] of Object.entries(value.submittedRequests)) {
    text(key);
    text(id);
  }
  const locationIds = new Set(value.locations.map((row: any) => row.id));
  const productIds = new Set(value.products.map((row: any) => row.id));
  for (const location of value.locations) {
    strings(location, ['id', 'name', 'code']);
    optionalStrings(location, ['description']);
    ensure(
      location.isDefault === undefined || typeof location.isDefault === 'boolean',
      'Invalid default location.',
    );
  }
  unique(value.locations, 'code', true);
  for (const product of value.products) {
    strings(product, ['name', 'sku', 'category', 'unit', 'primaryLocationId']);
    finiteQuantity(product.stock);
    finiteQuantity(product.reorderLevel);
    ensure(locationIds.has(product.primaryLocationId), 'A product references a missing primary location.');
    object(product.locationStock);
    let total = 0;
    for (const [id, quantity] of Object.entries(product.locationStock)) {
      ensure(locationIds.has(id), 'Stock references a missing location.');
      finiteQuantity(quantity);
      total += quantity;
    }
    finiteQuantity(total);
    ensure(
      Math.abs(total - product.stock) <= 1e-9 * Math.max(1, total),
      'Product total does not match location balances.',
    );
    timestamp(product.createdAt);
    timestamp(product.updatedAt);
  }
  unique(value.products, 'sku', true);
  for (const [key, partner] of [
    ['receipts', 'supplier'],
    ['deliveries', 'customer'],
  ]) {
    for (const operation of value[key]) {
      strings(operation, [partner, 'warehouseId']);
      date(operation.date);
      optionalStrings(operation, ['notes', 'validatedAt']);
      if (operation.validatedAt !== undefined) timestamp(operation.validatedAt);
      ensure(statuses.includes(operation.status), 'Invalid operation status.');
      ensure(
        Array.isArray(operation.items) && operation.items.length > 0,
        'An operation must contain line items.',
      );
      const active = !['Done', 'Canceled'].includes(operation.status);
      if (active)
        ensure(locationIds.has(operation.warehouseId), 'An open operation references a missing location.');
      for (const item of operation.items) {
        object(item);
        strings(item, itemFields);
        finiteQuantity(item.quantity, false);
        if (active) ensure(productIds.has(item.productId), 'An open operation references a missing product.');
      }
      if (key === 'deliveries') {
        ensure(
          ['Draft', 'Picked', 'Packed', 'Validated', 'Canceled'].includes(operation.stage),
          'Invalid delivery stage.',
        );
        ensure(
          (operation.status === 'Done') === (operation.stage === 'Validated'),
          'Delivery status and stage disagree.',
        );
        ensure(
          (operation.status === 'Canceled') === (operation.stage === 'Canceled'),
          'Canceled delivery status and stage disagree.',
        );
      }
    }
  }
  for (const transfer of value.transfers) {
    strings(transfer, [...itemFields, 'fromLocationId', 'toLocationId']);
    finiteQuantity(transfer.quantity, false);
    date(transfer.date);
    optionalStrings(transfer, ['notes', 'validatedAt']);
    if (transfer.validatedAt !== undefined) timestamp(transfer.validatedAt);
    ensure(statuses.includes(transfer.status), 'Invalid transfer status.');
    ensure(transfer.fromLocationId !== transfer.toLocationId, 'Transfer locations must differ.');
    if (!['Done', 'Canceled'].includes(transfer.status)) {
      ensure(
        productIds.has(transfer.productId) &&
          locationIds.has(transfer.fromLocationId) &&
          locationIds.has(transfer.toLocationId),
        'An open transfer has a missing reference.',
      );
    }
  }
  for (const adjustment of value.adjustments) {
    strings(adjustment, [...itemFields, 'locationId', 'reason']);
    date(adjustment.date);
    finiteQuantity(adjustment.systemQuantity);
    finiteQuantity(adjustment.physicalCount);
    ensure(
      Number.isFinite(adjustment.difference) &&
        Math.abs(adjustment.difference - (adjustment.physicalCount - adjustment.systemQuantity)) < 1e-8,
      'Invalid adjustment difference.',
    );
    ensure(['Done', 'Draft'].includes(adjustment.status), 'Invalid adjustment status.');
    if (adjustment.status === 'Draft')
      ensure(
        productIds.has(adjustment.productId) && locationIds.has(adjustment.locationId),
        'A draft adjustment has a missing reference.',
      );
  }
  for (const entry of value.ledger) {
    strings(entry, [...itemFields, 'referenceId', 'user']);
    timestamp(entry.timestamp);
    optionalStrings(entry, [
      'userId',
      'fromLocationId',
      'fromLocationName',
      'toLocationId',
      'toLocationName',
      'reasonNotes',
    ]);
    ensure(
      ['Receipt', 'Delivery', 'Transfer', 'Adjustment'].includes(entry.operationType),
      'Invalid ledger operation.',
    );
    ensure(
      typeof entry.quantityChange === 'number' && Number.isFinite(entry.quantityChange),
      'Invalid ledger quantity.',
    );
    if (entry.operationType === 'Receipt')
      ensure(entry.quantityChange > 0 && entry.toLocationId, 'Invalid receipt ledger entry.');
    if (entry.operationType === 'Delivery')
      ensure(entry.quantityChange < 0 && entry.fromLocationId, 'Invalid delivery ledger entry.');
    if (entry.operationType === 'Transfer')
      ensure(
        entry.quantityChange > 0 &&
          entry.fromLocationId &&
          entry.toLocationId &&
          entry.fromLocationId !== entry.toLocationId,
        'Invalid transfer ledger entry.',
      );
  }
}
