export type OperationStatus = 'Draft' | 'Waiting' | 'Ready' | 'Done' | 'Canceled';

export type OperationType = 'Receipt' | 'Delivery' | 'Transfer' | 'Adjustment';

export interface Location {
  id: string;
  name: string;
  code: string;
  description?: string;
  isDefault?: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  stock: number; // total across all locations
  reorderLevel: number;
  locationStock: Record<string, number>; // locationId -> quantity
  primaryLocationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperationItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
}

export interface Receipt {
  id: string;
  supplier: string;
  warehouseId: string;
  items: OperationItem[];
  status: OperationStatus;
  date: string;
  notes?: string;
  validatedAt?: string;
}

export interface Delivery {
  id: string;
  customer: string;
  warehouseId: string;
  items: OperationItem[];
  status: OperationStatus;
  stage: 'Draft' | 'Picked' | 'Packed' | 'Validated' | 'Canceled';
  date: string;
  notes?: string;
  validatedAt?: string;
}

export interface Transfer {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  fromLocationId: string;
  toLocationId: string;
  status: OperationStatus;
  date: string;
  notes?: string;
  validatedAt?: string;
}

export interface Adjustment {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  locationId: string;
  systemQuantity: number;
  physicalCount: number;
  difference: number;
  reason: string;
  status: 'Done' | 'Draft';
  date: string;
}

export interface LedgerEntry {
  id: string;
  timestamp: string;
  referenceId: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  operationType: OperationType;
  quantityChange: number; // e.g. +50, -10, or 20
  fromLocationId?: string;
  fromLocationName?: string;
  toLocationId?: string;
  toLocationName?: string;
  user: string;
  userId?: string; // Stable actor identity; legacy entries retain their name snapshot.
  reasonNotes?: string;
}

export interface InventorySnapshot {
  version: 1;
  products: Product[];
  locations: Location[];
  receipts: Receipt[];
  deliveries: Delivery[];
  transfers: Transfer[];
  adjustments: Adjustment[];
  ledger: LedgerEntry[];
  submittedRequests: Record<string, string>;
}

export type CommandResult<T = undefined> =
  { success: true; data: T; error?: never } | { success: false; error: string; data?: never };

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  phone?: string;
  department?: string;
  warehouse?: string;
}

export * from './auth';
