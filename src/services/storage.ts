import type { AuthSession, InventorySnapshot } from '../types';
import {
  INITIAL_LOCATIONS,
  INITIAL_PRODUCTS,
  INITIAL_RECEIPTS,
  INITIAL_DELIVERIES,
  INITIAL_TRANSFERS,
  INITIAL_ADJUSTMENTS,
  INITIAL_LEDGER,
} from '../data/seedData';
import { canonicalSession, editableProfile, validateAccounts } from '../domain/accounts';
import type { AccountData } from '../types';
export { canonicalSession } from '../domain/accounts';
export type { AccountData, EditableProfile } from '../types';
import { validateInventory } from '../domain/validation';

export const INVENTORY_KEY = 'stocksense_inventory_v1';
export const ACCOUNT_KEY = 'stocksense_account_v1';
const legacyKeys = [
  'locations',
  'products',
  'receipts',
  'deliveries',
  'transfers',
  'adjustments',
  'ledger',
] as const;
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unexpected error occurred.';

export function seedInventory(): InventorySnapshot {
  return structuredClone({
    version: 1,
    locations: INITIAL_LOCATIONS,
    products: INITIAL_PRODUCTS,
    receipts: INITIAL_RECEIPTS,
    deliveries: INITIAL_DELIVERIES,
    transfers: INITIAL_TRANSFERS,
    adjustments: INITIAL_ADJUSTMENTS,
    ledger: INITIAL_LEDGER,
    submittedRequests: {},
  });
}

function read(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Saved data (${key}) is not valid JSON. The original data has been preserved.`);
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error(
      'Could not save changes in this browser. Check available storage and browser permissions, then retry. No changes were applied.',
    );
  }
}

export const StorageService = {
  loadInventory(): InventorySnapshot {
    const saved = read(INVENTORY_KEY);
    if (saved !== undefined) {
      validateInventory(saved);
      return saved;
    }
    const legacy = legacyKeys.map((key) => read(`stocksense_${key}`));
    if (legacy.every((value) => value === undefined)) return seedInventory();
    if (legacy.some((value) => value === undefined))
      throw new Error(
        'The saved inventory is incomplete. Existing data has been preserved; restore the missing data or explicitly reset the demo.',
      );
    const migrated = {
      version: 1,
      ...Object.fromEntries(legacyKeys.map((key, i) => [key, legacy[i]])),
      submittedRequests: {},
    };
    validateInventory(migrated);
    return migrated; // Read-only migration. Old keys remain untouched until a successful command writes v1.
  },
  saveInventory(snapshot: InventorySnapshot): void {
    validateInventory(snapshot);
    write(INVENTORY_KEY, snapshot);
  },
  loadAccounts(): AccountData {
    const saved = read(ACCOUNT_KEY);
    if (saved !== undefined) return validateAccounts(saved);
    const session = canonicalSession(read('stocksense_session'));
    return validateAccounts({
      version: 1,
      session,
      profiles: session ? { [session.id]: editableProfile(session) } : {},
    });
  },
  saveAccounts(data: AccountData) {
    write(ACCOUNT_KEY, validateAccounts(data));
  },
  getTheme(): 'light' | 'dark' {
    const theme = read('stocksense_theme');
    if (theme !== undefined && theme !== 'light' && theme !== 'dark')
      throw new Error('Saved theme is invalid.');
    return (theme as 'light' | 'dark' | undefined) ?? 'light';
  },
  setTheme(theme: 'light' | 'dark') {
    write('stocksense_theme', theme);
  },
  getSelectedWarehouse(): string {
    const value = read('stocksense_selected_warehouse');
    if (value !== undefined && (typeof value !== 'string' || !value))
      throw new Error('Saved warehouse selection is invalid.');
    return (value as string | undefined) ?? 'all';
  },
  setSelectedWarehouse(id: string) {
    write('stocksense_selected_warehouse', id);
  },
};
