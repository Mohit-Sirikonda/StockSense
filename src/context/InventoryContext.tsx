import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Product,
  Location,
  Receipt,
  Delivery,
  Transfer,
  Adjustment,
  LedgerEntry,
  AuthSession,
  OperationStatus,
} from '../types';
import { StorageService } from '../services/storage';
import { useAuth } from './AuthContext';

interface InventoryContextType {
  // Data
  products: Product[];
  locations: Location[];
  receipts: Receipt[];
  deliveries: Delivery[];
  transfers: Transfer[];
  adjustments: Adjustment[];
  ledger: LedgerEntry[];
  currentUser: AuthSession | null;
  isAuthenticated: boolean;
  selectedWarehouseId: string;
  setSelectedWarehouseId: (id: string) => void;

  // Auth delegates
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  updateUserProfile: (profile: Partial<AuthSession>) => void;

  // Role booleans
  isManager: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  assignedWarehouse: string;
  assignedWarehouseId: string;

  // Products
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'stock'> & { initialStock?: number }) => { success: boolean; error?: string };
  updateProduct: (id: string, updates: Partial<Product>) => { success: boolean; error?: string };
  deleteProduct: (id: string) => { success: boolean; error?: string };
  getProductStockAtLocation: (productId: string, locationId: string) => number;

  // Locations
  addLocation: (loc: Omit<Location, 'id'>) => { success: boolean; error?: string };
  updateLocation: (id: string, loc: Partial<Location>) => { success: boolean; error?: string };
  deleteLocation: (id: string) => { success: boolean; error?: string };
  getLocationName: (id?: string) => string;

  // Receipts
  addReceipt: (receipt: Omit<Receipt, 'id' | 'status'> & { status?: OperationStatus }) => Receipt;
  updateReceipt: (id: string, receipt: Partial<Receipt>) => void;
  validateReceipt: (id: string) => { success: boolean; error?: string };

  // Deliveries
  addDelivery: (delivery: Omit<Delivery, 'id' | 'status' | 'stage'> & { status?: OperationStatus; stage?: Delivery['stage'] }) => Delivery;
  updateDelivery: (id: string, delivery: Partial<Delivery>) => void;
  updateDeliveryStage: (id: string, stage: Delivery['stage']) => { success: boolean; error?: string };
  validateDelivery: (id: string) => { success: boolean; error?: string };

  // Transfers
  addTransfer: (transfer: Omit<Transfer, 'id' | 'status'> & { status?: OperationStatus }) => Transfer;
  updateTransfer: (id: string, transfer: Partial<Transfer>) => void;
  validateTransfer: (id: string) => { success: boolean; error?: string };

  // Adjustments
  addAdjustment: (adjustment: Omit<Adjustment, 'id' | 'difference' | 'status' | 'systemQuantity'> & { systemQuantity?: number }) => { success: boolean; error?: string };

  // System
  resetDemoData: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    session,
    isAuthenticated,
    login,
    logout,
    updateSessionProfile,
    isManager,
    isStaff,
    isAdmin,
    assignedWarehouse,
    assignedWarehouseId,
  } = useAuth();

  // Initialize storage once
  useEffect(() => {
    StorageService.initStorage();
  }, []);

  const [products, setProductsState] = useState<Product[]>(() => StorageService.getProducts());
  const [locations, setLocationsState] = useState<Location[]>(() => StorageService.getLocations());
  const [receipts, setReceiptsState] = useState<Receipt[]>(() => StorageService.getReceipts());
  const [deliveries, setDeliveriesState] = useState<Delivery[]>(() => StorageService.getDeliveries());
  const [transfers, setTransfersState] = useState<Transfer[]>(() => StorageService.getTransfers());
  const [adjustments, setAdjustmentsState] = useState<Adjustment[]>(() => StorageService.getAdjustments());
  const [ledger, setLedgerState] = useState<LedgerEntry[]>(() => StorageService.getLedger());

  const [rawSelectedWarehouseId, setRawSelectedWarehouseId] = useState<string>(() =>
    StorageService.getSelectedWarehouse()
  );

  // Sync warehouse selection with active session role
  useEffect(() => {
    if (session) {
      if (session.role === 'Warehouse Staff') {
        setRawSelectedWarehouseId(session.warehouseId);
        StorageService.setSelectedWarehouse(session.warehouseId);
      } else {
        const stored = StorageService.getSelectedWarehouse();
        setRawSelectedWarehouseId(stored || 'all');
      }
    }
  }, [session]);

  const selectedWarehouseId = useMemo(() => {
    if (session?.role === 'Warehouse Staff') {
      return session.warehouseId;
    }
    return rawSelectedWarehouseId;
  }, [session, rawSelectedWarehouseId]);

  const setSelectedWarehouseId = useCallback(
    (id: string) => {
      // Warehouse staff is bound to their assigned warehouse
      if (session?.role === 'Warehouse Staff') {
        setRawSelectedWarehouseId(session.warehouseId);
        StorageService.setSelectedWarehouse(session.warehouseId);
        return;
      }
      setRawSelectedWarehouseId(id);
      StorageService.setSelectedWarehouse(id);
    },
    [session]
  );

  // Helper syncers
  const updateProducts = useCallback((newProducts: Product[]) => {
    setProductsState(newProducts);
    StorageService.setProducts(newProducts);
  }, []);

  const updateLocations = useCallback((newLocations: Location[]) => {
    setLocationsState(newLocations);
    StorageService.setLocations(newLocations);
  }, []);

  const updateReceipts = useCallback((newReceipts: Receipt[]) => {
    setReceiptsState(newReceipts);
    StorageService.setReceipts(newReceipts);
  }, []);

  const updateDeliveries = useCallback((newDeliveries: Delivery[]) => {
    setDeliveriesState(newDeliveries);
    StorageService.setDeliveries(newDeliveries);
  }, []);

  const updateTransfers = useCallback((newTransfers: Transfer[]) => {
    setTransfersState(newTransfers);
    StorageService.setTransfers(newTransfers);
  }, []);

  const updateAdjustments = useCallback((newAdjustments: Adjustment[]) => {
    setAdjustmentsState(newAdjustments);
    StorageService.setAdjustments(newAdjustments);
  }, []);

  const addLedgerEntry = useCallback(
    (entry: Omit<LedgerEntry, 'id' | 'timestamp'>) => {
      const newEntry: LedgerEntry = {
        ...entry,
        id: `LED-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
      };
      setLedgerState((prev) => {
        const next = [newEntry, ...prev];
        StorageService.setLedger(next);
        return next;
      });
      return newEntry;
    },
    []
  );

  // Locations
  const getLocationName = useCallback(
    (id?: string) => {
      if (!id || id === 'all') return 'All Warehouses';
      const loc = locations.find((l) => l.id === id);
      return loc ? loc.name : id;
    },
    [locations]
  );

  const addLocation = (locData: Omit<Location, 'id'>) => {
    if (!locData.name.trim() || !locData.code.trim()) {
      return { success: false, error: 'Name and Code are required' };
    }
    const exists = locations.some((l) => l.code.toLowerCase() === locData.code.toLowerCase().trim());
    if (exists) {
      return { success: false, error: `Location code "${locData.code}" already exists.` };
    }
    const newLoc: Location = {
      id: `loc-${Date.now().toString(36)}`,
      name: locData.name.trim(),
      code: locData.code.trim().toUpperCase(),
      description: locData.description?.trim(),
      isDefault: false,
    };
    const next = [...locations, newLoc];
    updateLocations(next);
    return { success: true };
  };

  const updateLocation = (id: string, locUpdates: Partial<Location>) => {
    const next = locations.map((l) => (l.id === id ? { ...l, ...locUpdates } : l));
    updateLocations(next);
    return { success: true };
  };

  const deleteLocation = (id: string) => {
    const inUseByProduct = products.some((p) => (p.locationStock[id] || 0) > 0);
    if (inUseByProduct) {
      return { success: false, error: 'Cannot delete location with active product stock.' };
    }
    const loc = locations.find((l) => l.id === id);
    if (loc?.isDefault) {
      return { success: false, error: 'Cannot delete the default warehouse location.' };
    }
    const next = locations.filter((l) => l.id !== id);
    updateLocations(next);
    return { success: true };
  };

  // Products
  const getProductStockAtLocation = useCallback(
    (productId: string, locationId: string): number => {
      const prod = products.find((p) => p.id === productId);
      if (!prod) return 0;
      return prod.locationStock[locationId] || 0;
    },
    [products]
  );

  const addProduct = (
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'stock'> & { initialStock?: number }
  ) => {
    const sku = productData.sku.trim().toUpperCase();
    if (!productData.name.trim()) {
      return { success: false, error: 'Product name is required' };
    }
    if (!sku) {
      return { success: false, error: 'SKU is required' };
    }
    const skuExists = products.some((p) => p.sku.toLowerCase() === sku.toLowerCase());
    if (skuExists) {
      return { success: false, error: `SKU "${sku}" is already in use by another product.` };
    }

    const initStock = Math.max(0, Number(productData.initialStock || 0));
    const primaryLoc = productData.primaryLocationId || locations[0]?.id || 'loc-main';

    const locationStockMap: Record<string, number> = {
      ...(productData.locationStock || {}),
    };
    if (initStock > 0 && !locationStockMap[primaryLoc]) {
      locationStockMap[primaryLoc] = initStock;
    }

    const totalStock = Object.values(locationStockMap).reduce((acc, curr) => acc + (curr || 0), 0);

    const now = new Date().toISOString();
    const newProduct: Product = {
      id: `prod-${Date.now().toString(36)}`,
      name: productData.name.trim(),
      sku,
      category: productData.category.trim(),
      unit: productData.unit.trim(),
      stock: totalStock,
      reorderLevel: Math.max(0, Number(productData.reorderLevel || 0)),
      primaryLocationId: primaryLoc,
      locationStock: locationStockMap,
      createdAt: now,
      updatedAt: now,
    };

    const next = [newProduct, ...products];
    updateProducts(next);

    // If initial stock was given, record ledger entry
    if (totalStock > 0) {
      addLedgerEntry({
        referenceId: 'INIT-STOCK',
        productId: newProduct.id,
        productName: newProduct.name,
        sku: newProduct.sku,
        unit: newProduct.unit,
        operationType: 'Receipt',
        quantityChange: totalStock,
        toLocationId: primaryLoc,
        toLocationName: getLocationName(primaryLoc),
        user: session?.name || 'System',
        reasonNotes: 'Initial product stock recorded upon creation',
      });
    }

    return { success: true };
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    const target = products.find((p) => p.id === id);
    if (!target) return { success: false, error: 'Product not found' };

    if (updates.sku) {
      const newSku = updates.sku.trim().toUpperCase();
      const skuConflict = products.some((p) => p.id !== id && p.sku.toLowerCase() === newSku.toLowerCase());
      if (skuConflict) {
        return { success: false, error: `SKU "${newSku}" is already taken.` };
      }
      updates.sku = newSku;
    }

    const now = new Date().toISOString();
    const next = products.map((p) => {
      if (p.id !== id) return p;
      const merged = { ...p, ...updates, updatedAt: now };
      if (updates.locationStock) {
        merged.stock = Object.values(updates.locationStock).reduce((acc, curr) => acc + (curr || 0), 0);
      }
      return merged;
    });

    updateProducts(next);
    return { success: true };
  };

  const deleteProduct = (id: string) => {
    if (session?.role === 'Warehouse Staff') {
      return { success: false, error: 'Warehouse Staff are not authorized to delete products.' };
    }
    const target = products.find((p) => p.id === id);
    if (!target) return { success: false, error: 'Product not found' };

    if (target.stock > 0) {
      return {
        success: false,
        error: `Cannot delete product "${target.name}" while it has active stock (${target.stock} ${target.unit}). Adjust stock to 0 first.`,
      };
    }

    const next = products.filter((p) => p.id !== id);
    updateProducts(next);
    return { success: true };
  };

  // Receipts
  const addReceipt = (
    receiptData: Omit<Receipt, 'id' | 'status'> & { status?: OperationStatus }
  ): Receipt => {
    const newId = `REC-${new Date().getFullYear()}-${String(receipts.length + 1).padStart(3, '0')}`;
    const newReceipt: Receipt = {
      ...receiptData,
      id: newId,
      status: receiptData.status || 'Ready',
    };
    const next = [newReceipt, ...receipts];
    updateReceipts(next);
    return newReceipt;
  };

  const updateReceipt = (id: string, updates: Partial<Receipt>) => {
    const next = receipts.map((r) => (r.id === id ? { ...r, ...updates } : r));
    updateReceipts(next);
  };

  const validateReceipt = (id: string) => {
    const receipt = receipts.find((r) => r.id === id);
    if (!receipt) return { success: false, error: 'Receipt not found' };
    if (receipt.status === 'Done') return { success: false, error: 'Receipt already validated' };
    if (receipt.status === 'Canceled') return { success: false, error: 'Cannot validate a canceled receipt' };

    const warehouseId = receipt.warehouseId;
    const warehouseName = getLocationName(warehouseId);

    // Update product stock for each item
    const updatedProducts = [...products];

    for (const item of receipt.items) {
      const pIndex = updatedProducts.findIndex((p) => p.id === item.productId);
      if (pIndex === -1) {
        return { success: false, error: `Product "${item.productName}" no longer exists in inventory.` };
      }
      const prod = { ...updatedProducts[pIndex] };
      const currentLocStock = prod.locationStock[warehouseId] || 0;
      const newLocStock = currentLocStock + item.quantity;
      const newLocationStock = {
        ...prod.locationStock,
        [warehouseId]: newLocStock,
      };

      const newTotalStock = Object.values(newLocationStock).reduce((a, b) => a + b, 0);

      prod.locationStock = newLocationStock;
      prod.stock = newTotalStock;
      prod.updatedAt = new Date().toISOString();
      updatedProducts[pIndex] = prod;

      // Add Stock Ledger Entry
      addLedgerEntry({
        referenceId: receipt.id,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        unit: prod.unit,
        operationType: 'Receipt',
        quantityChange: item.quantity,
        toLocationId: warehouseId,
        toLocationName: warehouseName,
        user: session?.name || 'System',
        reasonNotes: receipt.supplier
          ? `Received from ${receipt.supplier}. ${receipt.notes || ''}`.trim()
          : (receipt.notes || 'Goods receipt verified'),
      });
    }

    updateProducts(updatedProducts);

    // Update receipt status
    const now = new Date().toISOString();
    const nextReceipts = receipts.map((r) =>
      r.id === id ? { ...r, status: 'Done' as OperationStatus, validatedAt: now } : r
    );
    updateReceipts(nextReceipts);

    return { success: true };
  };

  // Deliveries
  const addDelivery = (
    deliveryData: Omit<Delivery, 'id' | 'status' | 'stage'> & { status?: OperationStatus; stage?: Delivery['stage'] }
  ): Delivery => {
    const newId = `DEL-${new Date().getFullYear()}-${String(deliveries.length + 1).padStart(3, '0')}`;
    const newDelivery: Delivery = {
      ...deliveryData,
      id: newId,
      status: deliveryData.status || 'Ready',
      stage: deliveryData.stage || 'Draft',
    };
    const next = [newDelivery, ...deliveries];
    updateDeliveries(next);
    return newDelivery;
  };

  const updateDelivery = (id: string, updates: Partial<Delivery>) => {
    const next = deliveries.map((d) => (d.id === id ? { ...d, ...updates } : d));
    updateDeliveries(next);
  };

  const updateDeliveryStage = (id: string, stage: Delivery['stage']) => {
    const delivery = deliveries.find((d) => d.id === id);
    if (!delivery) return { success: false, error: 'Delivery order not found' };
    if (delivery.status === 'Done') return { success: false, error: 'Completed delivery stage cannot be changed' };

    let newStatus: OperationStatus = delivery.status;
    if (stage === 'Picked' || stage === 'Packed') {
      newStatus = 'Ready';
    } else if (stage === 'Draft') {
      newStatus = 'Draft';
    }

    const next = deliveries.map((d) => (d.id === id ? { ...d, stage, status: newStatus } : d));
    updateDeliveries(next);
    return { success: true };
  };

  const validateDelivery = (id: string) => {
    const delivery = deliveries.find((d) => d.id === id);
    if (!delivery) return { success: false, error: 'Delivery not found' };
    if (delivery.status === 'Done') return { success: false, error: 'Delivery already validated and dispatched' };
    if (delivery.status === 'Canceled') return { success: false, error: 'Cannot validate a canceled delivery' };

    const warehouseId = delivery.warehouseId;
    const warehouseName = getLocationName(warehouseId);

    // Validation: Check stock for each item before deducting anything
    for (const item of delivery.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) {
        return { success: false, error: `Product "${item.productName}" not found.` };
      }
      const availableAtLocation = prod.locationStock[warehouseId] || 0;
      if (availableAtLocation < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for ${prod.name} at ${warehouseName}. Requested: ${item.quantity} ${item.unit}, Available: ${availableAtLocation} ${item.unit}. Delivery blocked to prevent negative stock.`,
        };
      }
    }

    // Deduct stock
    const updatedProducts = [...products];
    for (const item of delivery.items) {
      const pIndex = updatedProducts.findIndex((p) => p.id === item.productId);
      const prod = { ...updatedProducts[pIndex] };
      const currentLocStock = prod.locationStock[warehouseId] || 0;
      const newLocStock = currentLocStock - item.quantity;

      const newLocationStock = {
        ...prod.locationStock,
        [warehouseId]: newLocStock,
      };

      const newTotalStock = Object.values(newLocationStock).reduce((a, b) => a + b, 0);

      prod.locationStock = newLocationStock;
      prod.stock = Math.max(0, newTotalStock);
      prod.updatedAt = new Date().toISOString();
      updatedProducts[pIndex] = prod;

      // Add Stock Ledger Entry
      addLedgerEntry({
        referenceId: delivery.id,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        unit: prod.unit,
        operationType: 'Delivery',
        quantityChange: -item.quantity,
        fromLocationId: warehouseId,
        fromLocationName: warehouseName,
        user: session?.name || 'System',
        reasonNotes: delivery.customer
          ? `Dispatched to customer: ${delivery.customer}. ${delivery.notes || ''}`.trim()
          : (delivery.notes || 'Customer delivery dispatched'),
      });
    }

    updateProducts(updatedProducts);

    // Update delivery order status
    const now = new Date().toISOString();
    const nextDeliveries = deliveries.map((d) =>
      d.id === id ? { ...d, status: 'Done' as OperationStatus, stage: 'Validated' as Delivery['stage'], validatedAt: now } : d
    );
    updateDeliveries(nextDeliveries);

    return { success: true };
  };

  // Transfers
  const addTransfer = (
    transferData: Omit<Transfer, 'id' | 'status'> & { status?: OperationStatus }
  ): Transfer => {
    const newId = `TRF-${new Date().getFullYear()}-${String(transfers.length + 1).padStart(3, '0')}`;
    const newTransfer: Transfer = {
      ...transferData,
      id: newId,
      status: transferData.status || 'Ready',
    };
    const next = [newTransfer, ...transfers];
    updateTransfers(next);
    return newTransfer;
  };

  const updateTransfer = (id: string, updates: Partial<Transfer>) => {
    const next = transfers.map((t) => (t.id === id ? { ...t, ...updates } : t));
    updateTransfers(next);
  };

  const validateTransfer = (id: string) => {
    const transfer = transfers.find((t) => t.id === id);
    if (!transfer) return { success: false, error: 'Transfer not found' };
    if (transfer.status === 'Done') return { success: false, error: 'Transfer already completed' };
    if (transfer.status === 'Canceled') return { success: false, error: 'Cannot complete a canceled transfer' };

    if (transfer.fromLocationId === transfer.toLocationId) {
      return { success: false, error: 'Source and destination locations cannot be the same.' };
    }

    const prod = products.find((p) => p.id === transfer.productId);
    if (!prod) return { success: false, error: 'Product not found.' };

    const sourceStock = prod.locationStock[transfer.fromLocationId] || 0;
    const fromLocationName = getLocationName(transfer.fromLocationId);
    const toLocationName = getLocationName(transfer.toLocationId);

    if (sourceStock < transfer.quantity) {
      return {
        success: false,
        error: `Insufficient stock of ${prod.name} at ${fromLocationName}. Available: ${sourceStock} ${prod.unit}, Transfer Requested: ${transfer.quantity} ${prod.unit}.`,
      };
    }

    // Move stock: fromLocation decreases, toLocation increases. Total stock remains identical!
    const destStock = prod.locationStock[transfer.toLocationId] || 0;
    const newLocationStock = {
      ...prod.locationStock,
      [transfer.fromLocationId]: sourceStock - transfer.quantity,
      [transfer.toLocationId]: destStock + transfer.quantity,
    };

    const nextProducts = products.map((p) => {
      if (p.id !== prod.id) return p;
      return {
        ...p,
        locationStock: newLocationStock,
        updatedAt: new Date().toISOString(),
      };
    });
    updateProducts(nextProducts);

    // Ledger Entry
    addLedgerEntry({
      referenceId: transfer.id,
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      unit: prod.unit,
      operationType: 'Transfer',
      quantityChange: transfer.quantity,
      fromLocationId: transfer.fromLocationId,
      fromLocationName,
      toLocationId: transfer.toLocationId,
      toLocationName,
      user: session?.name || 'System',
      reasonNotes: transfer.notes || `Internal relocation from ${fromLocationName} to ${toLocationName}`,
    });

    const now = new Date().toISOString();
    const nextTransfers = transfers.map((t) =>
      t.id === id ? { ...t, status: 'Done' as OperationStatus, validatedAt: now } : t
    );
    updateTransfers(nextTransfers);

    return { success: true };
  };

  // Adjustments
  const addAdjustment = (
    adjData: Omit<Adjustment, 'id' | 'difference' | 'status' | 'systemQuantity'> & { systemQuantity?: number }
  ) => {
    const prod = products.find((p) => p.id === adjData.productId);
    if (!prod) return { success: false, error: 'Product not found' };

    const currentLocStock = prod.locationStock[adjData.locationId] || 0;
    const difference = adjData.physicalCount - currentLocStock;
    const locationName = getLocationName(adjData.locationId);

    if (adjData.physicalCount < 0) {
      return { success: false, error: 'Physical count cannot be negative.' };
    }

    const newId = `ADJ-${new Date().getFullYear()}-${String(adjustments.length + 1).padStart(3, '0')}`;
    const newAdjustment: Adjustment = {
      ...adjData,
      id: newId,
      systemQuantity: currentLocStock,
      difference,
      status: 'Done',
    };

    // Update product stock at that location
    const newLocationStock = {
      ...prod.locationStock,
      [adjData.locationId]: adjData.physicalCount,
    };
    const newTotalStock = Object.values(newLocationStock).reduce((a, b) => a + b, 0);

    const nextProducts = products.map((p) => {
      if (p.id !== prod.id) return p;
      return {
        ...p,
        stock: newTotalStock,
        locationStock: newLocationStock,
        updatedAt: new Date().toISOString(),
      };
    });
    updateProducts(nextProducts);

    // Save adjustment record
    const nextAdjustments = [newAdjustment, ...adjustments];
    updateAdjustments(nextAdjustments);

    // Create Ledger Entry
    addLedgerEntry({
      referenceId: newAdjustment.id,
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      unit: prod.unit,
      operationType: 'Adjustment',
      quantityChange: difference,
      fromLocationId: difference < 0 ? adjData.locationId : undefined,
      fromLocationName: difference < 0 ? locationName : undefined,
      toLocationId: difference > 0 ? adjData.locationId : undefined,
      toLocationName: difference > 0 ? locationName : undefined,
      user: session?.name || 'System',
      reasonNotes: `Physical count adjustment (${difference >= 0 ? '+' : ''}${difference} ${prod.unit} at ${locationName}): ${adjData.reason}`,
    });

    return { success: true };
  };

  // Reset Demo Data (resets inventory only, does NOT touch active user session)
  const resetDemoData = () => {
    StorageService.resetAllData();
    setProductsState(StorageService.getProducts());
    setLocationsState(StorageService.getLocations());
    setReceiptsState(StorageService.getReceipts());
    setDeliveriesState(StorageService.getDeliveries());
    setTransfersState(StorageService.getTransfers());
    setAdjustmentsState(StorageService.getAdjustments());
    setLedgerState(StorageService.getLedger());
  };

  return (
    <InventoryContext.Provider
      value={{
        products,
        locations,
        receipts,
        deliveries,
        transfers,
        adjustments,
        ledger,
        currentUser: session,
        isAuthenticated,
        selectedWarehouseId,
        setSelectedWarehouseId,
        login,
        logout,
        updateUserProfile: updateSessionProfile,
        isManager,
        isStaff,
        isAdmin,
        assignedWarehouse,
        assignedWarehouseId,
        addProduct,
        updateProduct,
        deleteProduct,
        getProductStockAtLocation,
        addLocation,
        updateLocation,
        deleteLocation,
        getLocationName,
        addReceipt,
        updateReceipt,
        validateReceipt,
        addDelivery,
        updateDelivery,
        updateDeliveryStage,
        validateDelivery,
        addTransfer,
        updateTransfer,
        validateTransfer,
        addAdjustment,
        resetDemoData,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
