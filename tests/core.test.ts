import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryStore, deliveryAvailability } from '../src/domain/inventory';
import { canPerform } from '../src/domain/permissions';
import {
  inWarehouse,
  movementInWarehouse,
  productInWarehouse,
  stockAt,
  newestLedger,
  ledgerMovement,
  quantitySummary,
} from '../src/domain/selectors';
import { validateInventory } from '../src/domain/validation';
import { StorageService, seedInventory, INVENTORY_KEY, canonicalSession } from '../src/services/storage';
import { serializeCSV, csvCell } from '../src/utils/csv';
import { createId } from '../src/utils/id';
import {
  accountDirectory,
  createAccountStore,
  emptyAccounts,
  validateAccounts,
} from '../src/domain/accounts';
import { selectDashboard } from '../src/domain/dashboard';
import { DEMO_USERS } from '../src/data/users';
import type { AuthSession, InventorySnapshot, OperationItem } from '../src/types';

const manager = (({ password, ...user }) => user)(DEMO_USERS[0]) as AuthSession;
const staff = (({ password, ...user }) => user)(DEMO_USERS[1]) as AuthSession;
let memory: Map<string, string>;

test('IDs and ledger commands work without the secure-context-only randomUUID API', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues } });
  try {
    const ids = Array.from({ length: 1000 }, () => createId());
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids)
      assert.match(id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    const h = setup();
    const requestId = createId();
    assert.ok(h.dispatch(manager, { type: 'executeTransfer', input: transfer(), requestId }).success);
    assert.match(h.state().ledger[0].id, /^LED-[\da-f-]{36}$/);
    expectUnchanged(h, () => h.dispatch(manager, { type: 'executeTransfer', input: transfer(), requestId }));
    const reloaded = setup(StorageService.loadInventory());
    expectUnchanged(reloaded, () =>
      reloaded.dispatch(manager, { type: 'executeTransfer', input: transfer(), requestId }),
    );
    assert.ok(h.dispatch(manager, { type: 'addLocation', input: { name: 'LAN bay', code: 'LAN' } }).success);
    assert.ok(
      h.dispatch(manager, {
        type: 'addProduct',
        input: {
          name: 'LAN product',
          sku: 'LAN',
          category: 'Test',
          unit: 'pcs',
          reorderLevel: 0,
          primaryLocationId: 'loc-main',
          locationStock: {},
        },
      }).success,
    );
  } finally {
    Object.defineProperty(globalThis, 'crypto', descriptor);
  }
});
beforeEach(() => {
  memory = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    },
  });
});
function setup(snapshot = seedInventory(), persist = StorageService.saveInventory) {
  const store = createInventoryStore(snapshot, persist);
  return { store, state: () => store.getSnapshot()!, dispatch: store.dispatch.bind(store) };
}
const item = (productId = 'prod-stl-001', quantity = 5): OperationItem => {
  const p = seedInventory().products.find((p) => p.id === productId)!;
  return { productId, productName: p.name, sku: p.sku, unit: p.unit, quantity };
};
const receipt = (items = [item()], warehouseId = 'loc-main') => ({
  supplier: 'Audit supplier',
  warehouseId,
  items,
  date: '2026-09-26',
});
const transfer = (quantity = 20) => ({
  ...item(),
  quantity,
  fromLocationId: 'loc-main',
  toLocationId: 'loc-prod',
  date: '2026-09-26',
});
const product = (state: InventorySnapshot, id = 'prod-stl-001') => state.products.find((p) => p.id === id)!;
function expectUnchanged(h: ReturnType<typeof setup>, fn: () => { success: boolean }) {
  const before = JSON.stringify(h.state()),
    disk = memory.get(INVENTORY_KEY);
  assert.equal(fn().success, false);
  assert.equal(JSON.stringify(h.state()), before);
  assert.equal(memory.get(INVENTORY_KEY), disk);
}

test('seed stock totals and snapshots are valid; receipt commits balances, status, actor and ledger together', () => {
  const h = setup();
  validateInventory(h.state());
  const result = h.dispatch(manager, { type: 'addReceipt', input: receipt(), requestId: 'receipt-1' });
  assert.ok(result.success);
  const id = result.data.id,
    before = h.state().ledger.length;
  assert.ok(h.dispatch(manager, { type: 'validateReceipt', id }).success);
  assert.equal(product(h.state()).stock, 255);
  assert.equal(product(h.state()).locationStock['loc-main'], 205);
  assert.equal(h.state().receipts[0].status, 'Done');
  assert.equal(h.state().ledger.length, before + 1);
  assert.equal(h.state().ledger[0].userId, manager.id);
  assert.equal(h.state().ledger[0].quantityChange, 5);
  assert.deepEqual(StorageService.loadInventory(), h.state());
});
test('same-render repeated validations and persisted submission IDs do not duplicate work', () => {
  const h = setup();
  const r = h.dispatch(manager, { type: 'addReceipt', input: receipt(), requestId: 'once' });
  assert.ok(r.success);
  assert.ok(h.dispatch(manager, { type: 'validateReceipt', id: r.data.id }).success);
  expectUnchanged(h, () => h.dispatch(manager, { type: 'validateReceipt', id: r.data.id }));
  expectUnchanged(h, () => h.dispatch(manager, { type: 'addReceipt', input: receipt(), requestId: 'once' }));
  const reloaded = setup(StorageService.loadInventory());
  expectUnchanged(reloaded, () =>
    reloaded.dispatch(manager, { type: 'addReceipt', input: receipt(), requestId: 'once' }),
  );
});
test('delivery decreases stock and records the order snapshot, then rejects a repeated dispatch', () => {
  const h = setup();
  const d = h.dispatch(manager, {
    type: 'addDelivery',
    input: { ...receipt(), customer: 'Customer' },
    requestId: 'dispatch-1',
  });
  assert.ok(d.success);
  assert.ok(
    h.dispatch(manager, { type: 'updateProduct', id: 'prod-stl-001', input: { name: 'Renamed steel' } })
      .success,
  );
  assert.ok(h.dispatch(manager, { type: 'pickDelivery', id: d.data.id }).success);
  assert.ok(h.dispatch(manager, { type: 'packDelivery', id: d.data.id }).success);
  assert.ok(h.dispatch(manager, { type: 'validateDelivery', id: d.data.id }).success);
  assert.equal(product(h.state()).stock, 245);
  assert.equal(h.state().ledger[0].quantityChange, -5);
  assert.equal(h.state().ledger[0].productName, 'Steel Rods');
  expectUnchanged(h, () => h.dispatch(manager, { type: 'validateDelivery', id: d.data.id }));
});

test('submission identifiers cannot collide with object prototype keys', () => {
  for (const requestId of ['__proto__', 'constructor', 'toString']) {
    const h = setup();
    const command = { type: 'executeTransfer' as const, input: transfer(), requestId };
    assert.ok(h.dispatch(manager, command).success);
    assert.ok(Object.hasOwn(h.state().submittedRequests, requestId));
    expectUnchanged(h, () => h.dispatch(manager, command));
    const reloaded = setup(StorageService.loadInventory());
    expectUnchanged(reloaded, () => reloaded.dispatch(manager, command));
  }
});
test('duplicate delivery lines are aggregated at creation and dispatch, never clamped to hide a deficit', () => {
  const h = setup(),
    items = [item('prod-chr-204', 12), item('prod-chr-204', 12)];
  assert.match(deliveryAvailability(h.state().products, 'loc-fg', items)!, /Insufficient/);
  expectUnchanged(h, () =>
    h.dispatch(manager, {
      type: 'addDelivery',
      input: { customer: 'Customer', warehouseId: 'loc-fg', items, date: '2026-09-26' },
      requestId: 'duplicate',
    }),
  );
  const legacy = seedInventory();
  legacy.deliveries.push({
    id: 'DEL-LEGACY',
    customer: 'Customer',
    warehouseId: 'loc-fg',
    items,
    date: '2026-09-26',
    status: 'Ready',
    stage: 'Packed',
  });
  const old = setup(legacy);
  expectUnchanged(old, () => old.dispatch(manager, { type: 'validateDelivery', id: 'DEL-LEGACY' }));
  assert.equal(product(old.state(), 'prod-chr-204').stock, 18);
});
test('invalid receipt items, quantities and missing locations cannot partially commit', () => {
  for (const quantity of [-1, 0, NaN, Infinity]) {
    const h = setup();
    expectUnchanged(h, () =>
      h.dispatch(manager, {
        type: 'addReceipt',
        input: receipt([item(), item('prod-cem-101', quantity)]),
        requestId: 'bad',
      }),
    );
  }
  const h = setup();
  expectUnchanged(h, () =>
    h.dispatch(manager, {
      type: 'addReceipt',
      input: receipt([item(), { ...item(), productId: 'missing' }]),
      requestId: 'missing',
    }),
  );
  expectUnchanged(h, () =>
    h.dispatch(manager, { type: 'addReceipt', input: receipt([item()], 'missing'), requestId: 'location' }),
  );
});
test('transfer executes directly against latest state, preserves total and rejects duplicate submission', () => {
  const h = setup(),
    before = h.state().ledger.length;
  assert.ok(
    h.dispatch(manager, { type: 'executeTransfer', input: transfer(), requestId: 'move-once' }).success,
  );
  assert.equal(product(h.state()).locationStock['loc-main'], 180);
  assert.equal(product(h.state()).locationStock['loc-prod'], 70);
  assert.equal(product(h.state()).stock, 250);
  assert.equal(h.state().transfers[0].status, 'Done');
  assert.equal(h.state().ledger.length, before + 1);
  expectUnchanged(h, () =>
    h.dispatch(manager, { type: 'executeTransfer', input: transfer(), requestId: 'move-once' }),
  );
  assert.ok(
    h.dispatch(manager, { type: 'executeTransfer', input: transfer(180), requestId: 'move-rest' }).success,
  );
  expectUnchanged(h, () =>
    h.dispatch(manager, { type: 'executeTransfer', input: transfer(1), requestId: 'overdraw' }),
  );
});
test('invalid transfers leave no staged operation, stock change or ledger entry', () => {
  for (const quantity of [-10, 0, NaN, Infinity, 201]) {
    const h = setup();
    expectUnchanged(h, () =>
      h.dispatch(manager, { type: 'executeTransfer', input: transfer(quantity), requestId: 'bad-move' }),
    );
  }
  const h = setup();
  expectUnchanged(h, () =>
    h.dispatch(manager, {
      type: 'executeTransfer',
      input: { ...transfer(), toLocationId: 'loc-main' },
      requestId: 'same',
    }),
  );
  expectUnchanged(h, () =>
    h.dispatch(manager, {
      type: 'executeTransfer',
      input: { ...transfer(), toLocationId: 'unknown' },
      requestId: 'unknown',
    }),
  );
});
test('physical count uses the current balance and has a stable idempotency key', () => {
  const h = setup(),
    input = {
      ...item(),
      locationId: 'loc-prod',
      physicalCount: 45,
      systemQuantity: 999,
      reason: 'Counted',
      date: '2026-09-26',
    };
  assert.ok(h.dispatch(staff, { type: 'addAdjustment', input, requestId: 'count-1' }).success);
  assert.equal(h.state().adjustments[0].systemQuantity, 50);
  assert.equal(h.state().adjustments[0].difference, -5);
  assert.equal(h.state().ledger[0].quantityChange, -5);
  expectUnchanged(h, () => h.dispatch(staff, { type: 'addAdjustment', input, requestId: 'count-1' }));
  expectUnchanged(h, () =>
    h.dispatch(staff, { type: 'addAdjustment', input: { ...input, physicalCount: NaN }, requestId: 'nan' }),
  );
});
test('write failures leave the entire visible state unchanged and can be retried', () => {
  let fail = true;
  const h = setup(seedInventory(), (snapshot) => {
    if (fail) throw new Error('Quota exceeded');
    StorageService.saveInventory(snapshot);
  });
  const command = { type: 'executeTransfer' as const, input: transfer(), requestId: 'quota' };
  expectUnchanged(h, () => h.dispatch(manager, command));
  fail = false;
  assert.ok(h.dispatch(manager, command).success);
  assert.equal(h.state().ledger[0].referenceId, h.state().transfers[0].id);
});
test('products and locations with any references, stock or staff assignment cannot be deleted', () => {
  const h = setup();
  expectUnchanged(h, () => h.dispatch(manager, { type: 'deleteProduct', id: 'prod-stl-001' }));
  expectUnchanged(h, () => h.dispatch(manager, { type: 'deleteProduct', id: 'prod-plm-620' }));
  for (const id of ['loc-main', 'loc-prod', 'loc-fg'])
    expectUnchanged(h, () => h.dispatch(manager, { type: 'deleteLocation', id }));
  assert.ok(
    h.dispatch(manager, { type: 'addLocation', input: { name: 'Unused location', code: 'EMPTY' } }).success,
  );
  const id = h.state().locations.at(-1)!.id;
  assert.ok(h.dispatch(manager, { type: 'deleteLocation', id }).success);
});
test('pending receipt protects an otherwise empty product and location; duplicate codes are rejected on edit', () => {
  const h = setup();
  const p = h.dispatch(manager, {
    type: 'addProduct',
    input: {
      name: 'Empty product',
      sku: 'EMPTY',
      unit: 'pcs',
      category: 'Test',
      reorderLevel: 0,
      primaryLocationId: 'loc-main',
      locationStock: {},
    },
  });
  assert.ok(p.success);
  const loc = h.dispatch(manager, { type: 'addLocation', input: { name: 'Receiving bay', code: 'BAY' } });
  assert.ok(loc.success);
  assert.ok(
    h.dispatch(manager, {
      type: 'addReceipt',
      input: receipt([{ ...item(), productId: p.data.id }], loc.data.id),
      requestId: 'pending',
    }).success,
  );
  expectUnchanged(h, () => h.dispatch(manager, { type: 'deleteProduct', id: p.data.id }));
  expectUnchanged(h, () => h.dispatch(manager, { type: 'deleteLocation', id: loc.data.id }));
  expectUnchanged(h, () =>
    h.dispatch(manager, { type: 'updateLocation', id: 'loc-fg', input: { code: 'mw-01' } }),
  );
});
test('product edits cannot bypass stock commands, alter IDs or silently convert units', () => {
  const h = setup();
  for (const input of [
    { stock: 999 },
    { id: 'different' },
    { locationStock: { 'loc-main': 999 } },
    { unit: 'meters' },
  ])
    expectUnchanged(h, () => h.dispatch(manager, { type: 'updateProduct', id: 'prod-stl-001', input }));
  assert.ok(
    h.dispatch(manager, {
      type: 'updateProduct',
      id: 'prod-stl-001',
      input: { name: 'Steel rods revised', sku: 'STL-NEW' },
    }).success,
  );
  assert.equal(h.state().receipts[0].items[0].sku, 'STL-001');
});
test('permission policy matches declared manager and staff capabilities and warehouse boundaries', () => {
  assert.ok(canPerform(manager, 'createProduct'));
  assert.equal(canPerform(staff, 'createProduct'), false);
  assert.equal(canPerform(staff, 'createDelivery'), false);
  assert.ok(canPerform(staff, 'dispatch', ['loc-prod']));
  const h = setup();
  expectUnchanged(h, () =>
    h.dispatch(staff, { type: 'updateProduct', id: 'prod-stl-001', input: { name: 'Forbidden' } }),
  );
  expectUnchanged(h, () =>
    h.dispatch(staff, { type: 'addLocation', input: { name: 'Forbidden', code: 'NO' } }),
  );
  expectUnchanged(h, () =>
    h.dispatch(staff, { type: 'addReceipt', input: receipt(), requestId: 'wrong-site' }),
  );
  assert.ok(
    h.dispatch(staff, {
      type: 'addReceipt',
      input: receipt([item()], 'loc-prod'),
      requestId: 'staff-receipt',
    }).success,
  );
  assert.ok(
    h.dispatch(staff, { type: 'executeTransfer', input: transfer(), requestId: 'staff-move' }).success,
  );
  expectUnchanged(h, () =>
    h.dispatch(staff, {
      type: 'executeTransfer',
      input: { ...transfer(), toLocationId: 'loc-fg' },
      requestId: 'other-sites',
    }),
  );
  expectUnchanged(h, () => h.dispatch(null, { type: 'validateReceipt', id: 'REC-2026-003' }));
  expectUnchanged(h, () =>
    h.dispatch({ ...staff, role: 'Administrator' }, { type: 'deleteProduct', id: 'prod-plm-620' }),
  );
});
test('staff can dispatch existing assigned orders but cannot create them or reset inventory', () => {
  const h = setup(),
    created = h.dispatch(manager, {
      type: 'addDelivery',
      input: { customer: 'Assigned customer', warehouseId: 'loc-prod', items: [item()], date: '2026-09-26' },
      requestId: 'manager-order',
    });
  assert.ok(created.success);
  assert.ok(h.dispatch(staff, { type: 'pickDelivery', id: created.data.id }).success);
  assert.ok(h.dispatch(staff, { type: 'packDelivery', id: created.data.id }).success);
  assert.ok(h.dispatch(staff, { type: 'validateDelivery', id: created.data.id }).success);
  expectUnchanged(h, () =>
    h.dispatch(staff, {
      type: 'addDelivery',
      input: { customer: 'No', warehouseId: 'loc-prod', items: [item()], date: '2026-09-26' },
      requestId: 'staff-order',
    }),
  );
  expectUnchanged(h, () => h.store.reset(staff, seedInventory()));
});
test('storage rejects malformed shapes, invalid balances and incomplete legacy data without overwriting', () => {
  for (const bad of ['{}', 'null', 'not JSON']) {
    memory.set(INVENTORY_KEY, bad);
    assert.throws(() => StorageService.loadInventory());
    assert.equal(memory.get(INVENTORY_KEY), bad);
  }
  const bad = seedInventory();
  product(bad).stock = 999;
  memory.set(INVENTORY_KEY, JSON.stringify(bad));
  assert.throws(() => StorageService.loadInventory(), /balances/);
  memory.clear();
  memory.set('stocksense_products', '[]');
  assert.throws(() => StorageService.loadInventory(), /incomplete/);
  assert.equal(memory.get('stocksense_products'), '[]');
});
test('legacy migration preserves history and old keys; reload reads the complete snapshot', () => {
  const original = seedInventory();
  for (const key of [
    'products',
    'locations',
    'receipts',
    'deliveries',
    'transfers',
    'adjustments',
    'ledger',
  ] as const)
    memory.set('stocksense_' + key, JSON.stringify(original[key]));
  const loaded = StorageService.loadInventory();
  assert.deepEqual(loaded, original);
  assert.equal(memory.has(INVENTORY_KEY), false);
  StorageService.saveInventory(loaded);
  assert.deepEqual(StorageService.loadInventory(), original);
  assert.equal(memory.get('stocksense_ledger'), JSON.stringify(original.ledger));
});
test('blocked storage and quota errors are propagated', () => {
  const before = memory.size;
  globalThis.localStorage.setItem = () => {
    throw new Error('quota');
  };
  assert.throws(() => StorageService.saveInventory(seedInventory()), /Could not save/);
  assert.equal(memory.size, before);
  globalThis.localStorage.getItem = () => {
    throw new Error('denied');
  };
  assert.throws(() => StorageService.loadInventory(), /denied/);
});
test('scope selectors use IDs, include zero balances and preserve all-warehouse semantics', () => {
  const state = seedInventory(),
    p = product(state);
  assert.equal(stockAt(p, 'loc-prod'), 50);
  assert.equal(stockAt(p, 'all'), 250);
  assert.ok(productInWarehouse(product(state, 'prod-plm-620'), 'loc-main'));
  assert.ok(inWarehouse('loc-main', 'all'));
  assert.equal(inWarehouse('loc-main', 'loc-prod'), false);
  assert.ok(movementInWarehouse('loc-main', 'loc-prod', 'loc-prod'));
  assert.equal(movementInWarehouse('loc-main', 'loc-rack-a', 'loc-prod'), false);
});
test('ledger sorts newest-first and transfer display is neutral globally, negative at source, positive at destination', () => {
  const state = seedInventory(),
    ledger = newestLedger(state.ledger),
    t = state.ledger.find((e) => e.operationType === 'Transfer')!;
  assert.equal(ledger[0].id, 'LED-006');
  assert.equal(state.ledger[0].id, 'LED-001');
  assert.equal(ledgerMovement(t, 'all').tone, 'neutral');
  assert.equal(ledgerMovement(t, 'loc-main').text, '-50 kg');
  assert.equal(ledgerMovement(t, 'loc-prod').text, '+50 kg');
  assert.equal(
    quantitySummary([
      { quantity: 10, unit: 'kg' },
      { quantity: 5, unit: 'kg' },
      { quantity: 4, unit: 'pcs' },
    ]),
    '15 kg · 4 pcs',
  );
});
test('profile persistence uses stable IDs, excludes credentials and rejects forged sessions', () => {
  const session = { ...manager, name: 'Updated Manager' };
  StorageService.saveAccounts({
    version: 1,
    session,
    profiles: { [manager.id]: { name: session.name, phone: '123', department: 'Ops' } },
  });
  assert.equal(StorageService.loadAccounts().profiles[manager.id].name, 'Updated Manager');
  assert.equal((StorageService.loadAccounts().session as any).password, undefined);
  assert.throws(() => canonicalSession({ ...staff, role: 'Administrator' }));
  assert.throws(() => canonicalSession({ ...staff, email: 'changed@example.com' }));
  const h = setup();
  assert.ok(h.dispatch(session, { type: 'executeTransfer', input: transfer(), requestId: 'actor' }).success);
  assert.equal(h.state().ledger[0].userId, manager.id);
  assert.equal(h.state().ledger[0].user, 'Updated Manager');
});
test('CSV escapes all cells, preserves newlines, and neutralizes formula-like text while retaining numeric negatives', () => {
  assert.equal(csvCell('A, B'), '"A, B"');
  assert.equal(csvCell('A "quoted" name'), '"A ""quoted"" name"');
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"');
  for (const value of ['=1+1', ' +SUM(A1:A2)', '-formula', '@name', '\tvalue', '\n=1+1'])
    assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell(-5), '"-5"');
  assert.equal(csvCell(NaN), '""');
  assert.equal(csvCell(null), '""');
  assert.equal(
    serializeCSV([
      ['SKU', 'Name'],
      ['=formula', 'Copper, "special"\nwire'],
    ]),
    '\uFEFF"SKU","Name"\r\n"\'=formula","Copper, ""special""\nwire"',
  );
});

test('delivery workflow cannot skip stages; picking and packing never move stock', () => {
  const h = setup();
  const created = h.dispatch(manager, {
    type: 'addDelivery',
    input: { ...receipt(), customer: 'Stages' },
    requestId: 'stages',
  });
  assert.ok(created.success);
  const id = created.data.id,
    before = product(h.state()).stock,
    ledgerCount = h.state().ledger.length;
  assert.equal(h.state().deliveries[0].stage, 'Draft');
  expectUnchanged(h, () => h.dispatch(manager, { type: 'packDelivery', id }));
  expectUnchanged(h, () => h.dispatch(manager, { type: 'validateDelivery', id }));
  assert.ok(h.dispatch(manager, { type: 'pickDelivery', id }).success);
  expectUnchanged(h, () => h.dispatch(manager, { type: 'pickDelivery', id }));
  assert.equal(h.state().deliveries[0].status, 'Waiting');
  assert.ok(h.dispatch(manager, { type: 'packDelivery', id }).success);
  assert.equal(product(h.state()).stock, before);
  assert.equal(h.state().ledger.length, ledgerCount);
  assert.equal(h.state().deliveries[0].status, 'Ready');
  assert.ok(h.dispatch(manager, { type: 'validateDelivery', id }).success);
  assert.equal(product(h.state()).stock, before - 5);
  expectUnchanged(h, () => h.dispatch(manager, { type: 'cancelDelivery', id }));
});

test('shortages are checked again after packing; canceling open work moves no stock', () => {
  const h = setup();
  const d = h.dispatch(manager, {
    type: 'addDelivery',
    input: { ...receipt(), customer: 'Shortage' },
    requestId: 'late-shortage',
  });
  assert.ok(d.success);
  assert.ok(h.dispatch(manager, { type: 'pickDelivery', id: d.data.id }).success);
  assert.ok(h.dispatch(manager, { type: 'packDelivery', id: d.data.id }).success);
  assert.ok(
    h.dispatch(manager, { type: 'executeTransfer', input: transfer(200), requestId: 'drain' }).success,
  );
  expectUnchanged(h, () => h.dispatch(manager, { type: 'validateDelivery', id: d.data.id }));
  const stockBefore = structuredClone(h.state().products),
    ledgerBefore = structuredClone(h.state().ledger);
  assert.ok(h.dispatch(manager, { type: 'cancelDelivery', id: d.data.id }).success);
  assert.deepEqual(h.state().products, stockBefore);
  assert.deepEqual(h.state().ledger, ledgerBefore);
});

test('scheduled transfers and receipt status changes persist without stock movements', () => {
  const h = setup(),
    products = structuredClone(h.state().products),
    ledger = structuredClone(h.state().ledger);
  const t = h.dispatch(manager, {
    type: 'addTransfer',
    input: { ...transfer(999), status: 'Waiting' },
    requestId: 'scheduled',
  });
  assert.ok(t.success);
  assert.deepEqual(h.state().products, products);
  assert.deepEqual(h.state().ledger, ledger);
  expectUnchanged(h, () => h.dispatch(manager, { type: 'validateTransfer', id: t.data.id }));
  assert.ok(h.dispatch(manager, { type: 'cancelTransfer', id: t.data.id }).success);
  expectUnchanged(h, () => h.dispatch(manager, { type: 'validateTransfer', id: t.data.id }));
  const r = h.dispatch(manager, {
    type: 'addReceipt',
    input: { ...receipt(), status: 'Draft' },
    requestId: 'draft-receipt',
  });
  assert.ok(r.success);
  for (const status of ['Waiting', 'Ready', 'Canceled'] as const)
    assert.ok(h.dispatch(manager, { type: 'setReceiptStatus', id: r.data.id, status }).success);
  expectUnchanged(h, () => h.dispatch(manager, { type: 'validateReceipt', id: r.data.id }));
  assert.deepEqual(h.state().products, products);
  assert.deepEqual(h.state().ledger, ledger);
});

test('dashboard KPIs count SKUs and all four filters intersect', () => {
  const state = seedInventory();
  const all = { warehouse: 'all', category: 'all', document: 'all', status: 'all' } as const;
  const view = selectDashboard(state, all);
  assert.equal(view.inStock, 9);
  assert.equal(view.attention.length, 3);
  assert.equal(view.pendingReceipts, 2);
  assert.equal(view.pendingDeliveries, 2);
  assert.equal(view.scheduledTransfers, 1);
  const category = state.products.find((p) => p.id === 'prod-cop-310')!.category;
  const filtered = selectDashboard(state, {
    warehouse: 'loc-prod',
    category,
    document: 'Receipt',
    status: 'Waiting',
  });
  assert.deepEqual(
    filtered.documents.map((row) => row.id),
    ['REC-2026-004'],
  );
  assert.equal(filtered.pendingReceipts, 1);
  assert.equal(filtered.pendingDeliveries, 0);
  assert.equal(filtered.scheduledTransfers, 0);
  assert.equal(filtered.activity.length, 0);
  assert.equal(
    selectDashboard(state, { warehouse: 'loc-prod', category, document: 'Receipt', status: 'Done' }).documents
      .length,
    0,
  );
});

test('signup persists verifiers, authenticates after reload and grants only the declared role', async () => {
  const store = createAccountStore(
    emptyAccounts(),
    StorageService.saveAccounts,
    () => seedInventory().locations,
  );
  const input = {
    name: 'Local Staff',
    email: 'local@example.com',
    password: 'DemoOnly123',
    role: 'Warehouse Staff',
    warehouseId: 'loc-prod',
  };
  assert.ok((await store.signup(input)).success);
  const account = store.getSnapshot().session!;
  assert.equal(account.role, 'Warehouse Staff');
  assert.equal(account.warehouseId, 'loc-prod');
  assert.equal(JSON.stringify(StorageService.loadAccounts()).includes(input.password), false);
  assert.equal((await store.signup({ ...input, email: 'LOCAL@example.com' })).success, false);
  const reloaded = createAccountStore(
    StorageService.loadAccounts(),
    StorageService.saveAccounts,
    () => seedInventory().locations,
  );
  assert.ok(reloaded.logout().success);
  assert.equal((await reloaded.login(input.email, 'wrong')).success, false);
  assert.ok((await reloaded.login(input.email, input.password)).success);
  const inventory = createInventoryStore(seedInventory(), StorageService.saveInventory, () =>
    accountDirectory(reloaded.getSnapshot()),
  );
  assert.equal(
    inventory.dispatch(account, { type: 'addLocation', input: { name: 'Forbidden', code: 'BAD' } }).success,
    false,
  );
  assert.ok(
    inventory.dispatch(account, { type: 'executeTransfer', input: transfer(), requestId: 'local-staff' })
      .success,
  );
  assert.equal(
    inventory.dispatch(
      { ...account, role: 'Inventory Manager' },
      { type: 'addLocation', input: { name: 'Forbidden', code: 'BAD' } },
    ).success,
    false,
  );
  assert.equal(
    (await store.signup({ ...input, email: 'admin@example.com', role: 'Administrator' })).success,
    false,
  );
});

test('OTP reset changes the demo credential, rejects wrong/expired/reused codes and throttles attempts', async () => {
  let clock = 1000000;
  const store = createAccountStore(
    emptyAccounts(),
    StorageService.saveAccounts,
    () => seedInventory().locations,
    () => clock,
  );
  const email = manager.email,
    password = 'ChangedDemo123';
  const otp = await store.requestReset(email);
  assert.ok(otp.success);
  assert.equal((await store.requestReset(email)).success, false);
  const wrongCode = otp.data.code === '000000' ? '111111' : '000000';
  assert.equal((await store.completeReset(email, wrongCode, password)).success, false);
  assert.equal(store.getSnapshot().resets![manager.id].attempts, 1);
  assert.ok((await store.completeReset(email, otp.data.code, password)).success);
  assert.equal((await store.completeReset(email, otp.data.code, 'AgainDemo123')).success, false);
  assert.equal((await store.login(email, DEMO_USERS[0].password)).success, false);
  assert.ok((await store.login(email, password)).success);
  const reloaded = createAccountStore(
    StorageService.loadAccounts(),
    StorageService.saveAccounts,
    () => seedInventory().locations,
    () => clock,
  );
  assert.ok((await reloaded.login(email, password)).success);
  const expired = await reloaded.requestReset(email);
  assert.ok(expired.success);
  clock += 5 * 60000;
  assert.equal((await reloaded.completeReset(email, expired.data.code, 'ExpiredDemo123')).success, false);
  const limited = await reloaded.requestReset(email);
  assert.ok(limited.success);
  const wrong = limited.data.code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++)
    assert.equal((await reloaded.completeReset(email, wrong, password)).success, false);
  assert.equal((await reloaded.completeReset(email, limited.data.code, password)).success, false);
});

test('account write failures do not claim signup or password reset success', async () => {
  let fail = true;
  const store = createAccountStore(
    emptyAccounts(),
    (data) => {
      if (fail) throw new Error('Save failed');
      StorageService.saveAccounts(data);
    },
    () => seedInventory().locations,
  );
  assert.equal(
    (
      await store.signup({
        name: 'Failure',
        email: 'failure@example.com',
        password: 'FailureDemo123',
        role: 'Inventory Manager',
        warehouseId: 'all',
      })
    ).success,
    false,
  );
  assert.equal(store.getSnapshot().users!.length, 0);
  fail = false;
  const otp = await store.requestReset(manager.email);
  assert.ok(otp.success);
  fail = true;
  assert.equal((await store.completeReset(manager.email, otp.data.code, 'ChangedDemo123')).success, false);
  assert.ok(store.getSnapshot().resets![manager.id]);
  assert.equal(store.getSnapshot().credentials![manager.id], undefined);
  fail = false;
  assert.ok((await store.completeReset(manager.email, otp.data.code, 'ChangedDemo123')).success);
});

test('saved accounts reject invalid credential material and preserve legacy profiles', () => {
  const legacy = validateAccounts({
    version: 1,
    session: manager,
    profiles: { [manager.id]: { name: 'Preserved' } },
  });
  assert.equal(legacy.profiles[manager.id].name, 'Preserved');
  assert.throws(() =>
    validateAccounts({ ...legacy, credentials: { [manager.id]: { algorithm: 'plain', hash: 'secret' } } }),
  );
});

test('a registered staff assignment protects its location and prevents an orphaning inventory reset', async () => {
  const snapshot = seedInventory();
  snapshot.locations.push({ id: 'loc-new', name: 'New warehouse', code: 'NEW' });
  const accounts = createAccountStore(emptyAccounts(), StorageService.saveAccounts, () => snapshot.locations);
  assert.ok(
    (
      await accounts.signup({
        name: 'Assigned',
        email: 'assigned@example.com',
        password: 'Assigned123',
        role: 'Warehouse Staff',
        warehouseId: 'loc-new',
      })
    ).success,
  );
  const store = createInventoryStore(snapshot, StorageService.saveInventory, () =>
    accountDirectory(accounts.getSnapshot()),
  );
  assert.equal(store.dispatch(manager, { type: 'deleteLocation', id: 'loc-new' }).success, false);
  assert.equal(store.reset(manager, seedInventory()).success, false);
});

test('an insecure origin keeps original demo login working and reports unavailable credential protection', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues } });
  try {
    const store = createAccountStore(
      emptyAccounts(),
      StorageService.saveAccounts,
      () => seedInventory().locations,
    );
    assert.ok((await store.login(manager.email, DEMO_USERS[0].password)).success);
    assert.ok(store.logout().success);
    const before = store.getSnapshot();
    const signup = await store.signup({
      name: 'Insecure origin',
      email: 'http@example.com',
      password: 'DemoOnly123',
      role: 'Inventory Manager',
      warehouseId: 'all',
    });
    assert.equal(signup.success, false);
    if (!signup.success) assert.match(signup.error, /HTTPS or localhost/);
    const reset = await store.requestReset(manager.email);
    assert.equal(reset.success, false);
    if (!reset.success) assert.match(reset.error, /HTTPS or localhost/);
    assert.equal(store.getSnapshot(), before);
  } finally {
    Object.defineProperty(globalThis, 'crypto', descriptor);
  }
});
