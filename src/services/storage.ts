import {
  Location,
  Product,
  Receipt,
  Delivery,
  Transfer,
  Adjustment,
  LedgerEntry,
  AuthSession,
} from '../types';
import {
  INITIAL_LOCATIONS,
  INITIAL_PRODUCTS,
  INITIAL_RECEIPTS,
  INITIAL_DELIVERIES,
  INITIAL_TRANSFERS,
  INITIAL_ADJUSTMENTS,
  INITIAL_LEDGER,
} from '../data/seedData';

const KEYS = {
  LOCATIONS: 'stocksense_locations',
  PRODUCTS: 'stocksense_products',
  RECEIPTS: 'stocksense_receipts',
  DELIVERIES: 'stocksense_deliveries',
  TRANSFERS: 'stocksense_transfers',
  ADJUSTMENTS: 'stocksense_adjustments',
  LEDGER: 'stocksense_ledger',
  SESSION: 'stocksense_session',
  THEME: 'stocksense_theme',
  SELECTED_WAREHOUSE: 'stocksense_selected_warehouse',
};

function safeGet<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to localStorage:`, err);
  }
}

export const StorageService = {
  // Initialization of baseline inventory structures only
  initStorage(): void {
    if (!localStorage.getItem(KEYS.LOCATIONS)) {
      safeSet(KEYS.LOCATIONS, INITIAL_LOCATIONS);
    }
    if (!localStorage.getItem(KEYS.PRODUCTS)) {
      safeSet(KEYS.PRODUCTS, INITIAL_PRODUCTS);
    }
    if (!localStorage.getItem(KEYS.RECEIPTS)) {
      safeSet(KEYS.RECEIPTS, INITIAL_RECEIPTS);
    }
    if (!localStorage.getItem(KEYS.DELIVERIES)) {
      safeSet(KEYS.DELIVERIES, INITIAL_DELIVERIES);
    }
    if (!localStorage.getItem(KEYS.TRANSFERS)) {
      safeSet(KEYS.TRANSFERS, INITIAL_TRANSFERS);
    }
    if (!localStorage.getItem(KEYS.ADJUSTMENTS)) {
      safeSet(KEYS.ADJUSTMENTS, INITIAL_ADJUSTMENTS);
    }
    if (!localStorage.getItem(KEYS.LEDGER)) {
      safeSet(KEYS.LEDGER, INITIAL_LEDGER);
    }
    // Clean up any legacy single-flag auth keys if present
    localStorage.removeItem('stocksense_is_authenticated');
    localStorage.removeItem('stocksense_user');
  },

  // Reset demo inventory data without affecting active session
  resetAllData(): void {
    safeSet(KEYS.LOCATIONS, INITIAL_LOCATIONS);
    safeSet(KEYS.PRODUCTS, INITIAL_PRODUCTS);
    safeSet(KEYS.RECEIPTS, INITIAL_RECEIPTS);
    safeSet(KEYS.DELIVERIES, INITIAL_DELIVERIES);
    safeSet(KEYS.TRANSFERS, INITIAL_TRANSFERS);
    safeSet(KEYS.ADJUSTMENTS, INITIAL_ADJUSTMENTS);
    safeSet(KEYS.LEDGER, INITIAL_LEDGER);
    // Note: Do NOT recreate or destroy authentication session during demo reset
  },

  // Session & Authentication
  getSession(): AuthSession | null {
    return safeGet<AuthSession | null>(KEYS.SESSION, null);
  },
  setSession(session: AuthSession): void {
    safeSet(KEYS.SESSION, session);
  },
  clearSession(): void {
    try {
      localStorage.removeItem(KEYS.SESSION);
    } catch (err) {
      console.error('Error clearing session from localStorage:', err);
    }
  },

  // Locations
  getLocations(): Location[] {
    return safeGet<Location[]>(KEYS.LOCATIONS, INITIAL_LOCATIONS);
  },
  setLocations(locations: Location[]): void {
    safeSet(KEYS.LOCATIONS, locations);
  },

  // Products
  getProducts(): Product[] {
    return safeGet<Product[]>(KEYS.PRODUCTS, INITIAL_PRODUCTS);
  },
  setProducts(products: Product[]): void {
    safeSet(KEYS.PRODUCTS, products);
  },

  // Receipts
  getReceipts(): Receipt[] {
    return safeGet<Receipt[]>(KEYS.RECEIPTS, INITIAL_RECEIPTS);
  },
  setReceipts(receipts: Receipt[]): void {
    safeSet(KEYS.RECEIPTS, receipts);
  },

  // Deliveries
  getDeliveries(): Delivery[] {
    return safeGet<Delivery[]>(KEYS.DELIVERIES, INITIAL_DELIVERIES);
  },
  setDeliveries(deliveries: Delivery[]): void {
    safeSet(KEYS.DELIVERIES, deliveries);
  },

  // Transfers
  getTransfers(): Transfer[] {
    return safeGet<Transfer[]>(KEYS.TRANSFERS, INITIAL_TRANSFERS);
  },
  setTransfers(transfers: Transfer[]): void {
    safeSet(KEYS.TRANSFERS, transfers);
  },

  // Adjustments
  getAdjustments(): Adjustment[] {
    return safeGet<Adjustment[]>(KEYS.ADJUSTMENTS, INITIAL_ADJUSTMENTS);
  },
  setAdjustments(adjustments: Adjustment[]): void {
    safeSet(KEYS.ADJUSTMENTS, adjustments);
  },

  // Ledger
  getLedger(): LedgerEntry[] {
    return safeGet<LedgerEntry[]>(KEYS.LEDGER, INITIAL_LEDGER);
  },
  setLedger(ledger: LedgerEntry[]): void {
    safeSet(KEYS.LEDGER, ledger);
  },

  // Theme
  getTheme(): 'light' | 'dark' {
    return safeGet<'light' | 'dark'>(KEYS.THEME, 'light');
  },
  setTheme(theme: 'light' | 'dark'): void {
    safeSet(KEYS.THEME, theme);
  },

  // Warehouse selection
  getSelectedWarehouse(): string {
    return safeGet<string>(KEYS.SELECTED_WAREHOUSE, 'all');
  },
  setSelectedWarehouse(id: string): void {
    safeSet(KEYS.SELECTED_WAREHOUSE, id);
  },
};
