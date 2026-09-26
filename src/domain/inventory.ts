import type {
  Adjustment,
  AuthSession,
  CommandResult,
  Delivery,
  InventorySnapshot,
  LedgerEntry,
  Location,
  OperationItem,
  Product,
  Receipt,
  Transfer,
} from '../types';
import { DEMO_USERS } from '../data/users';
import { requirePermission as requireAction, type InventoryAction } from './permissions';
import { finiteQuantity, validateInventory } from './validation';
import { createId } from '../utils/id';

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'stock'> & {
  initialStock?: number;
};
export type ReceiptInput = Omit<Receipt, 'id' | 'status'> & { status?: Receipt['status'] };
export type DeliveryInput = Omit<Delivery, 'id' | 'status' | 'stage'> & {
  status?: Delivery['status'];
  stage?: Delivery['stage'];
};
export type TransferInput = Omit<Transfer, 'id' | 'status'> & { status?: Transfer['status'] };
export type AdjustmentInput = Omit<Adjustment, 'id' | 'difference' | 'status' | 'systemQuantity'> & {
  systemQuantity?: number;
};
export type InventoryCommand =
  | { type: 'addProduct'; input: ProductInput }
  | { type: 'updateProduct'; id: string; input: Partial<Product> }
  | { type: 'deleteProduct'; id: string }
  | { type: 'addLocation'; input: Omit<Location, 'id'> }
  | { type: 'updateLocation'; id: string; input: Partial<Location> }
  | { type: 'deleteLocation'; id: string }
  | { type: 'addReceipt'; input: ReceiptInput; requestId: string }
  | { type: 'validateReceipt'; id: string }
  | { type: 'setReceiptStatus'; id: string; status: 'Draft' | 'Waiting' | 'Ready' | 'Canceled' }
  | { type: 'addDelivery'; input: DeliveryInput; requestId: string }
  | { type: 'validateDelivery'; id: string }
  | { type: 'pickDelivery' | 'packDelivery' | 'cancelDelivery'; id: string }
  | { type: 'executeTransfer' | 'addTransfer'; input: TransferInput; requestId: string }
  | { type: 'validateTransfer'; id: string }
  | { type: 'cancelTransfer'; id: string }
  | { type: 'addAdjustment'; input: AdjustmentInput; requestId: string };

function required(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function getProduct(state: InventorySnapshot, id: string) {
  const product = state.products.find((p) => p.id === id);
  if (!product) throw new Error('Product no longer exists.');
  return product;
}
function getLocation(state: InventorySnapshot, id: string) {
  const location = state.locations.find((l) => l.id === id);
  if (!location) throw new Error('Location no longer exists.');
  return location;
}
function assertOpen(status: string) {
  if (status === 'Done')
    throw new Error('This operation is already completed. No additional stock movement was recorded.');
  if (status === 'Canceled') throw new Error('A canceled operation cannot be completed.');
}
function rejectFields(input: object, allowed: string[]) {
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new Error(
      'These fields cannot be changed through this action. Use a stock operation to change balances.',
    );
}
function nextReference(prefix: string, rows: { id: string }[]) {
  const base = `${prefix}-${new Date().getFullYear()}-`;
  const numbers = rows
    .filter((r) => r.id.startsWith(base))
    .map((r) => Number(r.id.slice(base.length)))
    .filter(Number.isFinite);
  return base + String(Math.max(0, ...numbers) + 1).padStart(3, '0');
}
function setBalance(product: Product, location: string, quantity: number) {
  finiteQuantity(quantity);
  product.locationStock[location] = quantity;
  product.stock = Object.values(product.locationStock).reduce((a, b) => a + b, 0);
  finiteQuantity(product.stock);
  product.updatedAt = new Date().toISOString();
}
function productSnapshot(product: Product) {
  return { productId: product.id, productName: product.name, sku: product.sku, unit: product.unit };
}
function addLedger(
  state: InventorySnapshot,
  actor: AuthSession,
  entry: Omit<LedgerEntry, 'id' | 'timestamp' | 'user' | 'userId'>,
) {
  state.ledger.unshift({
    ...entry,
    id: 'LED-' + createId(),
    timestamp: new Date().toISOString(),
    user: actor.name,
    userId: actor.id,
  });
}
function itemsFromInput(state: InventorySnapshot, items: OperationItem[]) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Add at least one line item.');
  return items.map((item) => {
    finiteQuantity(item.quantity, false);
    return { ...productSnapshot(getProduct(state, item.productId)), quantity: item.quantity };
  });
}
export function deliveryAvailability(
  products: Product[],
  warehouseId: string,
  items: OperationItem[],
): string | null {
  const demand = new Map<string, number>();
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0)
      return 'Each quantity must be a positive finite number.';
    demand.set(item.productId, (demand.get(item.productId) ?? 0) + item.quantity);
  }
  if (!items.length) return 'Add at least one line item.';
  for (const [id, quantity] of demand) {
    const product = products.find((p) => p.id === id);
    if (!product) return 'A product no longer exists.';
    const available = product.locationStock[warehouseId] ?? 0;
    if (!Number.isFinite(quantity) || quantity > available)
      return `Insufficient stock for ${product.name}. Requested: ${quantity} ${product.unit}; available: ${available} ${product.unit}.`;
  }
  return null;
}
function validateItems(state: InventorySnapshot, items: OperationItem[], warehouseId: string) {
  getLocation(state, warehouseId);
  if (!items.length) throw new Error('Add at least one line item.');
  for (const item of items) {
    const product = getProduct(state, item.productId);
    finiteQuantity(item.quantity, false);
    if (item.unit !== product.unit)
      throw new Error(
        'The product unit changed after this operation was created. Review the operation before proceeding.',
      );
  }
}
function completeTransfer(
  state: InventorySnapshot,
  actor: AuthSession,
  transfer: Transfer,
  directory: readonly AuthSession[],
) {
  requireAction(actor, 'transfer', [transfer.fromLocationId, transfer.toLocationId], directory);
  assertOpen(transfer.status);
  finiteQuantity(transfer.quantity, false);
  if (transfer.fromLocationId === transfer.toLocationId)
    throw new Error('Source and destination locations must differ.');
  const from = getLocation(state, transfer.fromLocationId),
    to = getLocation(state, transfer.toLocationId);
  const product = getProduct(state, transfer.productId);
  if (product.unit !== transfer.unit) throw new Error('The product unit has changed. Review this transfer.');
  const available = product.locationStock[from.id] ?? 0;
  if (available < transfer.quantity)
    throw new Error(`Insufficient stock at ${from.name}. Available: ${available} ${product.unit}.`);
  setBalance(product, from.id, available - transfer.quantity);
  setBalance(product, to.id, (product.locationStock[to.id] ?? 0) + transfer.quantity);
  transfer.status = 'Done';
  transfer.validatedAt = new Date().toISOString();
  addLedger(state, actor, {
    referenceId: transfer.id,
    productId: transfer.productId,
    productName: transfer.productName,
    sku: transfer.sku,
    unit: transfer.unit,
    operationType: 'Transfer',
    quantityChange: transfer.quantity,
    fromLocationId: from.id,
    fromLocationName: from.name,
    toLocationId: to.id,
    toLocationName: to.name,
    reasonNotes: transfer.notes || 'Internal stock transfer',
  });
}

function applyCommand(
  state: InventorySnapshot,
  actor: AuthSession,
  command: InventoryCommand,
  directory: readonly AuthSession[],
): { id: string } {
  const requirePermission = (actor: AuthSession, action: InventoryAction, ids: string[] = []) =>
    requireAction(actor, action, ids, directory);
  switch (command.type) {
    case 'addProduct': {
      requirePermission(actor, 'createProduct');
      const input = command.input,
        primary = getLocation(state, input.primaryLocationId);
      const name = required(input.name, 'Name'),
        sku = required(input.sku, 'SKU').toUpperCase(),
        unit = required(input.unit, 'Unit');
      if (state.products.some((p) => p.sku.toUpperCase() === sku)) throw new Error('SKU is already in use.');
      finiteQuantity(input.reorderLevel);
      finiteQuantity(input.initialStock ?? 0);
      const balances = { ...input.locationStock };
      if (Object.keys(balances).length === 0) balances[primary.id] = input.initialStock ?? 0;
      for (const [id, quantity] of Object.entries(balances)) {
        getLocation(state, id);
        finiteQuantity(quantity);
      }
      if (input.initialStock !== undefined && (balances[primary.id] ?? 0) !== input.initialStock)
        throw new Error('Initial stock must match the primary location balance.');
      const now = new Date().toISOString();
      const product: Product = {
        id: 'prod-' + createId(),
        name,
        sku,
        category: required(input.category, 'Category'),
        unit,
        reorderLevel: input.reorderLevel,
        primaryLocationId: primary.id,
        locationStock: balances,
        stock: Object.values(balances).reduce((a, b) => a + b, 0),
        createdAt: now,
        updatedAt: now,
      };
      state.products.unshift(product);
      for (const [id, quantity] of Object.entries(balances))
        if (quantity > 0)
          addLedger(state, actor, {
            ...productSnapshot(product),
            referenceId: 'INIT-' + product.id,
            operationType: 'Receipt',
            quantityChange: quantity,
            toLocationId: id,
            toLocationName: getLocation(state, id).name,
            reasonNotes: 'Opening stock recorded on product creation',
          });
      return product;
    }
    case 'updateProduct': {
      requirePermission(actor, 'editProduct');
      rejectFields(command.input, ['name', 'sku', 'category', 'unit', 'reorderLevel', 'primaryLocationId']);
      const product = getProduct(state, command.id),
        input = command.input;
      if (
        input.unit !== undefined &&
        input.unit.trim() !== product.unit &&
        (product.stock > 0 ||
          state.ledger.some((e) => e.productId === product.id) ||
          state.receipts.some((r) => r.items.some((i) => i.productId === product.id)) ||
          state.deliveries.some((d) => d.items.some((i) => i.productId === product.id)) ||
          state.transfers.some((t) => t.productId === product.id) ||
          state.adjustments.some((a) => a.productId === product.id))
      )
        throw new Error(
          'The unit cannot change after stock or operations exist. Create a separate product; no unit conversion is assumed.',
        );
      for (const field of ['name', 'sku', 'category', 'unit'] as const)
        if (input[field] !== undefined) product[field] = required(input[field], field);
      product.sku = product.sku.toUpperCase();
      if (state.products.some((p) => p.id !== product.id && p.sku.toUpperCase() === product.sku))
        throw new Error('SKU is already in use.');
      if (input.primaryLocationId !== undefined)
        product.primaryLocationId = getLocation(state, input.primaryLocationId).id;
      if (input.reorderLevel !== undefined) {
        finiteQuantity(input.reorderLevel);
        product.reorderLevel = input.reorderLevel;
      }
      product.updatedAt = new Date().toISOString();
      return product;
    }
    case 'deleteProduct': {
      requirePermission(actor, 'deleteProduct');
      const product = getProduct(state, command.id);
      if (product.stock > 0)
        throw new Error(
          'Cannot delete a product with stock. Use an inventory operation to clear its balances first.',
        );
      if (
        state.receipts.some((r) => r.items.some((i) => i.productId === product.id)) ||
        state.deliveries.some((d) => d.items.some((i) => i.productId === product.id)) ||
        state.transfers.some((t) => t.productId === product.id) ||
        state.adjustments.some((a) => a.productId === product.id) ||
        state.ledger.some((e) => e.productId === product.id)
      )
        throw new Error(
          'Cannot delete this product: an operation or ledger entry references it. Historical records must remain intact.',
        );
      state.products = state.products.filter((p) => p.id !== product.id);
      return product;
    }
    case 'addLocation':
    case 'updateLocation': {
      requirePermission(actor, 'manageLocations');
      rejectFields(command.input, ['name', 'code', 'description']);
      const existing = command.type === 'updateLocation' ? getLocation(state, command.id) : undefined;
      const input = { ...existing, ...command.input };
      const name = required(input.name, 'Location name'),
        code = required(input.code, 'Location code').toUpperCase();
      if (state.locations.some((l) => l.id !== existing?.id && l.code.toUpperCase() === code))
        throw new Error('Location code is already in use.');
      if (input.description !== undefined && typeof input.description !== 'string')
        throw new Error('Invalid location description.');
      if (existing) {
        Object.assign(existing, { name, code, description: input.description?.trim() });
        return existing;
      }
      const location: Location = {
        id: 'loc-' + createId(),
        name,
        code,
        description: input.description?.trim(),
        isDefault: false,
      };
      state.locations.push(location);
      return location;
    }
    case 'deleteLocation': {
      requirePermission(actor, 'manageLocations');
      const location = getLocation(state, command.id),
        id = location.id;
      if (location.isDefault) throw new Error('The default warehouse cannot be deleted.');
      if (directory.some((user) => user.warehouseId === id))
        throw new Error('This location is assigned to a warehouse staff account.');
      if (
        state.products.some((p) => p.primaryLocationId === id || Object.hasOwn(p.locationStock, id)) ||
        state.receipts.some((r) => r.warehouseId === id) ||
        state.deliveries.some((d) => d.warehouseId === id) ||
        state.transfers.some((t) => t.fromLocationId === id || t.toLocationId === id) ||
        state.adjustments.some((a) => a.locationId === id) ||
        state.ledger.some((e) => e.fromLocationId === id || e.toLocationId === id)
      )
        throw new Error(
          'Cannot delete this location: product balances, operations, or history reference it.',
        );
      state.locations = state.locations.filter((l) => l.id !== id);
      return location;
    }
    case 'addReceipt': {
      const input = command.input;
      requirePermission(actor, 'receive', [input.warehouseId]);
      getLocation(state, input.warehouseId);
      if (input.status && !['Draft', 'Waiting', 'Ready'].includes(input.status))
        throw new Error('New receipts must be open; receive stock through validation.');
      const receipt: Receipt = {
        ...input,
        id: nextReference('REC', state.receipts),
        supplier: required(input.supplier, 'Supplier'),
        items: itemsFromInput(state, input.items),
        status: input.status ?? 'Ready',
        validatedAt: undefined,
      };
      state.receipts.unshift(receipt);
      return receipt;
    }
    case 'setReceiptStatus': {
      const receipt = state.receipts.find((row) => row.id === command.id);
      if (!receipt) throw new Error('Receipt not found.');
      requirePermission(actor, 'receive', [receipt.warehouseId]);
      assertOpen(receipt.status);
      if (!['Draft', 'Waiting', 'Ready', 'Canceled'].includes(command.status))
        throw new Error('Invalid receipt status.');
      receipt.status = command.status;
      return receipt;
    }
    case 'validateReceipt': {
      const receipt = state.receipts.find((r) => r.id === command.id);
      if (!receipt) throw new Error('Receipt not found.');
      requirePermission(actor, 'receive', [receipt.warehouseId]);
      assertOpen(receipt.status);
      validateItems(state, receipt.items, receipt.warehouseId);
      for (const item of receipt.items) {
        const product = getProduct(state, item.productId);
        setBalance(
          product,
          receipt.warehouseId,
          (product.locationStock[receipt.warehouseId] ?? 0) + item.quantity,
        );
        addLedger(state, actor, {
          ...item,
          referenceId: receipt.id,
          operationType: 'Receipt',
          quantityChange: item.quantity,
          toLocationId: receipt.warehouseId,
          toLocationName: getLocation(state, receipt.warehouseId).name,
          reasonNotes: `Received from ${receipt.supplier}. ${receipt.notes ?? ''}`.trim(),
        });
      }
      receipt.status = 'Done';
      receipt.validatedAt = new Date().toISOString();
      return receipt;
    }
    case 'addDelivery': {
      const input = command.input;
      requirePermission(actor, 'createDelivery', [input.warehouseId]);
      getLocation(state, input.warehouseId);
      if ((input.status && input.status !== 'Draft') || (input.stage && input.stage !== 'Draft'))
        throw new Error('New deliveries start as Draft. Pick and pack items before dispatch.');
      const items = itemsFromInput(state, input.items);
      const error = deliveryAvailability(state.products, input.warehouseId, items);
      if (error) throw new Error(error);
      const delivery: Delivery = {
        ...input,
        items,
        customer: required(input.customer, 'Customer'),
        id: nextReference('DEL', state.deliveries),
        status: 'Draft',
        stage: 'Draft',
        validatedAt: undefined,
      };
      state.deliveries.unshift(delivery);
      return delivery;
    }
    case 'pickDelivery':
    case 'packDelivery':
    case 'cancelDelivery': {
      const delivery = state.deliveries.find((row) => row.id === command.id);
      if (!delivery) throw new Error('Delivery not found.');
      requirePermission(actor, 'dispatch', [delivery.warehouseId]);
      assertOpen(delivery.status);
      if (command.type === 'cancelDelivery') {
        delivery.status = 'Canceled';
        delivery.stage = 'Canceled';
        return delivery;
      }
      const expected = command.type === 'pickDelivery' ? 'Draft' : 'Picked';
      if (delivery.stage !== expected)
        throw new Error(
          command.type === 'pickDelivery'
            ? 'Only a draft order can be picked.'
            : 'Pick the items before packing.',
        );
      validateItems(state, delivery.items, delivery.warehouseId);
      const error = deliveryAvailability(state.products, delivery.warehouseId, delivery.items);
      if (error) throw new Error(error);
      delivery.stage = command.type === 'pickDelivery' ? 'Picked' : 'Packed';
      delivery.status = command.type === 'pickDelivery' ? 'Waiting' : 'Ready';
      return delivery;
    }
    case 'validateDelivery': {
      const delivery = state.deliveries.find((d) => d.id === command.id);
      if (!delivery) throw new Error('Delivery not found.');
      requirePermission(actor, 'dispatch', [delivery.warehouseId]);
      assertOpen(delivery.status);
      if (delivery.stage !== 'Packed') throw new Error('Pick and pack this delivery before dispatching it.');
      validateItems(state, delivery.items, delivery.warehouseId);
      const error = deliveryAvailability(state.products, delivery.warehouseId, delivery.items);
      if (error) throw new Error(error);
      for (const item of delivery.items) {
        const product = getProduct(state, item.productId);
        setBalance(
          product,
          delivery.warehouseId,
          (product.locationStock[delivery.warehouseId] ?? 0) - item.quantity,
        );
        addLedger(state, actor, {
          ...item,
          referenceId: delivery.id,
          operationType: 'Delivery',
          quantityChange: -item.quantity,
          fromLocationId: delivery.warehouseId,
          fromLocationName: getLocation(state, delivery.warehouseId).name,
          reasonNotes: `Dispatched to ${delivery.customer}. ${delivery.notes ?? ''}`.trim(),
        });
      }
      delivery.status = 'Done';
      delivery.stage = 'Validated';
      delivery.validatedAt = new Date().toISOString();
      return delivery;
    }
    case 'addTransfer':
    case 'executeTransfer': {
      const input = command.input;
      requirePermission(actor, 'transfer', [input.fromLocationId, input.toLocationId]);
      if (input.status && !['Draft', 'Waiting', 'Ready'].includes(input.status))
        throw new Error('New transfers must be open.');
      const transfer: Transfer = {
        ...input,
        ...productSnapshot(getProduct(state, input.productId)),
        id: nextReference('TRF', state.transfers),
        status: input.status ?? 'Ready',
        validatedAt: undefined,
      };
      state.transfers.unshift(transfer);
      if (command.type === 'executeTransfer') completeTransfer(state, actor, transfer, directory);
      return transfer;
    }
    case 'cancelTransfer': {
      const transfer = state.transfers.find((row) => row.id === command.id);
      if (!transfer) throw new Error('Transfer not found.');
      requirePermission(actor, 'transfer', [transfer.fromLocationId, transfer.toLocationId]);
      assertOpen(transfer.status);
      transfer.status = 'Canceled';
      return transfer;
    }
    case 'validateTransfer': {
      const transfer = state.transfers.find((t) => t.id === command.id);
      if (!transfer) throw new Error('Transfer not found.');
      completeTransfer(state, actor, transfer, directory);
      return transfer;
    }
    case 'addAdjustment': {
      const input = command.input;
      requirePermission(actor, 'adjust', [input.locationId]);
      const location = getLocation(state, input.locationId);
      const product = getProduct(state, input.productId);
      finiteQuantity(input.physicalCount);
      const systemQuantity = product.locationStock[location.id] ?? 0,
        difference = input.physicalCount - systemQuantity;
      if (difference === 0)
        throw new Error('Physical count matches the current balance. No adjustment is needed.');
      const adjustment: Adjustment = {
        ...input,
        ...productSnapshot(product),
        id: nextReference('ADJ', state.adjustments),
        systemQuantity,
        difference,
        status: 'Done',
        reason: required(input.reason, 'Reason'),
      };
      setBalance(product, location.id, input.physicalCount);
      state.adjustments.unshift(adjustment);
      addLedger(state, actor, {
        ...productSnapshot(product),
        referenceId: adjustment.id,
        operationType: 'Adjustment',
        quantityChange: difference,
        fromLocationId: difference < 0 ? location.id : undefined,
        fromLocationName: difference < 0 ? location.name : undefined,
        toLocationId: difference > 0 ? location.id : undefined,
        toLocationName: difference > 0 ? location.name : undefined,
        reasonNotes: adjustment.reason,
      });
      return adjustment;
    }
  }
}

// Synchronous current-state owner. No persistence or mutation inside React render/updater callbacks.
// A failed command or write never publishes its isolated draft.
export function createInventoryStore(
  initial: InventorySnapshot | null,
  persist: (snapshot: InventorySnapshot) => void,
  getDirectory: () => readonly AuthSession[] = () => DEMO_USERS,
) {
  if (initial) validateInventory(initial);
  let current = initial;
  return {
    getSnapshot: () => current,
    dispatch<T extends { id: string } = { id: string }>(
      actor: AuthSession | null,
      command: InventoryCommand,
    ): CommandResult<T> {
      try {
        if (!actor) throw new Error('Sign in before changing inventory.');
        if (!current)
          throw new Error(
            'Inventory could not be loaded. Resolve the saved-data error before changing stock.',
          );
        if ('requestId' in command) {
          required(command.requestId, 'Submission identifier');
          if (Object.hasOwn(current.submittedRequests, command.requestId))
            throw new Error('This submission was already saved. No duplicate operation was recorded.');
        }
        const next = structuredClone(current);
        const data = applyCommand(next, actor, command, getDirectory());
        if ('requestId' in command)
          next.submittedRequests = { ...next.submittedRequests, [command.requestId]: data.id };
        validateInventory(next);
        persist(next);
        current = next;
        return { success: true, data: structuredClone(data) as T };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unable to complete this operation.',
        };
      }
    },
    reset(actor: AuthSession | null, snapshot: InventorySnapshot): CommandResult {
      try {
        requireAction(actor, 'reset', [], getDirectory());
        if (
          getDirectory().some(
            (user) =>
              user.role === 'Warehouse Staff' &&
              !snapshot.locations.some((location) => location.id === user.warehouseId),
          )
        )
          throw new Error(
            "Reset would remove a registered staff account's assigned location. Preserve that location before resetting.",
          );
        validateInventory(snapshot);
        persist(snapshot);
        current = structuredClone(snapshot);
        return { success: true, data: undefined };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Reset failed.' };
      }
    },
  };
}
