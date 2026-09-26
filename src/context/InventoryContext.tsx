import React, { createContext, useContext, useRef, useState, useMemo, useEffect } from 'react';
import type {
  Adjustment,
  CommandResult,
  Delivery,
  InventorySnapshot,
  Location,
  Product,
  Receipt,
  Transfer,
} from '../types';
import { StorageService, errorMessage, seedInventory } from '../services/storage';
import {
  createInventoryStore,
  type ProductInput,
  type ReceiptInput,
  type DeliveryInput,
  type TransferInput,
  type AdjustmentInput,
  type InventoryCommand,
} from '../domain/inventory';
import { canPerform, type InventoryAction } from '../domain/permissions';
import { newestLedger } from '../domain/selectors';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

function initialize() {
  let snapshot: InventorySnapshot | null = null,
    loadError = '',
    selectionError = '',
    selection = 'all';
  try {
    snapshot = StorageService.loadInventory();
  } catch (error) {
    loadError = errorMessage(error);
  }
  try {
    selection = StorageService.getSelectedWarehouse();
  } catch (error) {
    selectionError = errorMessage(error);
  }
  return { snapshot, loadError, selectionError, selection };
}

function useInventoryValue() {
  const auth = useAuth();
  const { showToast } = useToast();
  const [initial] = useState(initialize);
  const [snapshot, setSnapshot] = useState(initial.snapshot);
  const [loadError, setLoadError] = useState(initial.loadError);
  const [selectionError, setSelectionError] = useState(initial.selectionError);
  const [rawSelection, setRawSelection] = useState(initial.selection);
  const directory = useRef(auth.accounts);
  directory.current = auth.accounts;
  const store = useRef<ReturnType<typeof createInventoryStore> | null>(null);
  if (!store.current)
    store.current = createInventoryStore(
      initial.snapshot,
      StorageService.saveInventory,
      () => directory.current,
    );
  const actor = useRef(auth.session);
  actor.current = auth.session;
  const locations = snapshot?.locations ?? [];
  const assignedWarehouse =
    locations.find((l) => l.id === auth.assignedWarehouseId)?.name ?? auth.assignedWarehouse;
  const selectedWarehouseId = auth.isStaff
    ? auth.assignedWarehouseId
    : locations.some((l) => l.id === rawSelection)
      ? rawSelection
      : 'all';
  const previousUser = useRef(auth.session?.id);
  useEffect(() => {
    if (previousUser.current !== auth.session?.id) {
      setRawSelection('all');
      previousUser.current = auth.session?.id;
    }
  }, [auth.session?.id]);

  function run<T extends { id: string }>(command: InventoryCommand): CommandResult<T> {
    const result = store.current!.dispatch<T>(actor.current, command);
    if (result.success) {
      setSnapshot(store.current!.getSnapshot());
      setLoadError('');
    }
    return result;
  }
  const can = (action: InventoryAction, ids: string[] = []) =>
    canPerform(auth.session, action, ids, auth.accounts);
  function setSelectedWarehouseId(id: string) {
    const next = auth.isStaff ? auth.assignedWarehouseId : id;
    if (next !== 'all' && !locations.some((l) => l.id === next)) {
      showToast('That warehouse no longer exists.', 'error');
      return;
    }
    try {
      StorageService.setSelectedWarehouse(next);
      setRawSelection(next);
      setSelectionError('');
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  }
  function resetDemoData(): CommandResult {
    const result = store.current!.reset(actor.current, seedInventory());
    if (result.success) {
      setSnapshot(store.current!.getSnapshot());
      setLoadError('');
      setRawSelection('all');
    }
    return result;
  }
  function retryLoad() {
    try {
      const next = StorageService.loadInventory();
      store.current = createInventoryStore(next, StorageService.saveInventory, () => directory.current);
      setSnapshot(next);
      setLoadError('');
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }

  return {
    products: snapshot?.products ?? [],
    locations,
    receipts: snapshot?.receipts ?? [],
    deliveries: snapshot?.deliveries ?? [],
    transfers: snapshot?.transfers ?? [],
    adjustments: snapshot?.adjustments ?? [],
    ledger: useMemo(() => newestLedger(snapshot?.ledger ?? []), [snapshot?.ledger]),
    currentUser: auth.session,
    isAuthenticated: auth.isAuthenticated,
    login: auth.login,
    logout: auth.logout,
    updateUserProfile: auth.updateSessionProfile,
    isManager: auth.isManager,
    isStaff: auth.isStaff,
    isAdmin: auth.isAdmin,
    assignedWarehouse,
    assignedWarehouseId: auth.assignedWarehouseId,
    selectedWarehouseId,
    setSelectedWarehouseId,
    can,
    loadError,
    selectionError,
    retryLoad,
    addProduct: (input: ProductInput) => run<Product>({ type: 'addProduct', input }),
    updateProduct: (id: string, input: Partial<Product>) =>
      run<Product>({ type: 'updateProduct', id, input }),
    deleteProduct: (id: string) => run<Product>({ type: 'deleteProduct', id }),
    getProductStockAtLocation: (id: string, locationId: string) =>
      snapshot?.products.find((p) => p.id === id)?.locationStock[locationId] ?? 0,
    addLocation: (input: Omit<Location, 'id'>) => run<Location>({ type: 'addLocation', input }),
    updateLocation: (id: string, input: Partial<Location>) =>
      run<Location>({ type: 'updateLocation', id, input }),
    deleteLocation: (id: string) => run<Location>({ type: 'deleteLocation', id }),
    getLocationName: (id?: string) =>
      !id || id === 'all' ? 'All warehouses' : (locations.find((l) => l.id === id)?.name ?? id),
    addReceipt: (input: ReceiptInput, requestId: string) =>
      run<Receipt>({ type: 'addReceipt', input, requestId }),
    validateReceipt: (id: string) => run<Receipt>({ type: 'validateReceipt', id }),
    setReceiptStatus: (id: string, status: 'Draft' | 'Waiting' | 'Ready' | 'Canceled') =>
      run<Receipt>({ type: 'setReceiptStatus', id, status }),
    addDelivery: (input: DeliveryInput, requestId: string) =>
      run<Delivery>({ type: 'addDelivery', input, requestId }),
    validateDelivery: (id: string) => run<Delivery>({ type: 'validateDelivery', id }),
    pickDelivery: (id: string) => run<Delivery>({ type: 'pickDelivery', id }),
    packDelivery: (id: string) => run<Delivery>({ type: 'packDelivery', id }),
    cancelDelivery: (id: string) => run<Delivery>({ type: 'cancelDelivery', id }),
    addTransfer: (input: TransferInput, requestId: string) =>
      run<Transfer>({ type: 'addTransfer', input, requestId }),
    executeTransfer: (input: TransferInput, requestId: string) =>
      run<Transfer>({ type: 'executeTransfer', input, requestId }),
    validateTransfer: (id: string) => run<Transfer>({ type: 'validateTransfer', id }),
    cancelTransfer: (id: string) => run<Transfer>({ type: 'cancelTransfer', id }),
    addAdjustment: (input: AdjustmentInput, requestId: string) =>
      run<Adjustment>({ type: 'addAdjustment', input, requestId }),
    resetDemoData,
  };
}
const InventoryContext = createContext<ReturnType<typeof useInventoryValue> | undefined>(undefined);
export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <InventoryContext.Provider value={useInventoryValue()}>{children}</InventoryContext.Provider>
);
export const useInventory = () => {
  const value = useContext(InventoryContext);
  if (!value) throw new Error('useInventory must be used within an InventoryProvider');
  return value;
};
