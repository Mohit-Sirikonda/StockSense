import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  ChevronRight,
  ArrowRight,
  Edit2,
  Trash2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SlideOverDrawer } from '../components/ui/SlideOverDrawer';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Product } from '../types';

export const Products: React.FC = () => {
  const {
    products,
    locations,
    ledger,
    selectedWarehouseId,
    addProduct,
    updateProduct,
    deleteProduct,
    getLocationName,
    isStaff,
    assignedWarehouse,
    assignedWarehouseId,
  } = useInventory();
  const { showToast } = useToast();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState<string>(
    isStaff ? assignedWarehouseId : selectedWarehouseId || 'all'
  );
  const [statusFilter, setStatusFilter] = useState('all');

  // Detail drawer state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Add / Edit drawer state
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formInitialStock, setFormInitialStock] = useState('0');
  const [formReorderLevel, setFormReorderLevel] = useState('10');
  const [formLocation, setFormLocation] = useState(
    isStaff ? assignedWarehouseId : locations[0]?.id || 'loc-main'
  );
  const [formError, setFormError] = useState('');

  // Delete dialog
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Sync with global warehouse selector or staff assignment
  React.useEffect(() => {
    if (isStaff) {
      setLocationFilter(assignedWarehouseId);
    } else if (selectedWarehouseId !== 'all') {
      setLocationFilter(selectedWarehouseId);
    }
  }, [isStaff, assignedWarehouseId, selectedWarehouseId]);

  // Categories list
  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category))).sort();
  }, [products]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormName('');
    setFormSku('');
    setFormCategory('');
    setFormUnit('pcs');
    setFormInitialStock('0');
    setFormReorderLevel('10');
    setFormLocation(
      isStaff
        ? assignedWarehouseId
        : selectedWarehouseId !== 'all'
        ? selectedWarehouseId
        : locations[0]?.id || 'loc-main'
    );
    setFormError('');
    setIsFormDrawerOpen(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormSku(prod.sku);
    setFormCategory(prod.category);
    setFormUnit(prod.unit);
    setFormInitialStock(prod.stock.toString());
    setFormReorderLevel(prod.reorderLevel.toString());
    setFormLocation(prod.primaryLocationId);
    setFormError('');
    setIsFormDrawerOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Product name is required.');
      return;
    }
    if (!formSku.trim()) {
      setFormError('SKU is required.');
      return;
    }
    if (!formCategory.trim()) {
      setFormError('Category is required.');
      return;
    }
    if (!formUnit.trim()) {
      setFormError('Unit of measure is required.');
      return;
    }

    const reorder = parseInt(formReorderLevel, 10);
    if (isNaN(reorder) || reorder < 0) {
      setFormError('Reorder level must be a non-negative number.');
      return;
    }

    if (editingProduct) {
      const res = updateProduct(editingProduct.id, {
        name: formName.trim(),
        sku: formSku.trim(),
        category: formCategory.trim(),
        unit: formUnit.trim(),
        reorderLevel: reorder,
        primaryLocationId: formLocation,
      });

      if (!res.success) {
        setFormError(res.error || 'Failed to update product');
        return;
      }

      showToast(`Product "${formName}" updated.`, 'success');
      setIsFormDrawerOpen(false);
      if (selectedProduct?.id === editingProduct.id) {
        setSelectedProduct({
          ...selectedProduct,
          name: formName.trim(),
          sku: formSku.trim(),
          category: formCategory.trim(),
          unit: formUnit.trim(),
          reorderLevel: reorder,
          primaryLocationId: formLocation,
        });
      }
    } else {
      const initStock = parseInt(formInitialStock, 10);
      if (isNaN(initStock) || initStock < 0) {
        setFormError('Initial stock cannot be negative.');
        return;
      }

      const res = addProduct({
        name: formName.trim(),
        sku: formSku.trim(),
        category: formCategory.trim(),
        unit: formUnit.trim(),
        initialStock: initStock,
        reorderLevel: reorder,
        primaryLocationId: formLocation,
        locationStock: {
          [formLocation]: initStock,
        },
      });

      if (!res.success) {
        setFormError(res.error || 'Failed to add product');
        return;
      }

      showToast(`Product "${formName}" registered.`, 'success');
      setIsFormDrawerOpen(false);
    }
  };

  const handleDeleteConfirm = () => {
    if (!productToDelete) return;
    if (isStaff) {
      showToast('Warehouse Staff are not authorized to delete products.', 'error');
      setProductToDelete(null);
      return;
    }
    const res = deleteProduct(productToDelete.id);
    if (!res.success) {
      showToast(res.error || 'Could not delete product.', 'error');
    } else {
      showToast(`Product "${productToDelete.name}" deleted.`, 'success');
      if (selectedProduct?.id === productToDelete.id) {
        setSelectedProduct(null);
      }
    }
    setProductToDelete(null);
  };

  // Filtered products: for staff, primarily represent assigned warehouse
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesSearch =
        searchTerm === '' ||
        prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prod.sku.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || prod.category === categoryFilter;

      let matchesLocation = true;
      if (isStaff) {
        // Staff view is scoped to products relevant to assigned warehouse
        const qtyAtLoc = prod.locationStock[assignedWarehouseId] || 0;
        matchesLocation = qtyAtLoc > 0 || prod.primaryLocationId === assignedWarehouseId;
      } else if (locationFilter !== 'all') {
        const qtyAtLoc = prod.locationStock[locationFilter] || 0;
        matchesLocation = qtyAtLoc > 0 || prod.primaryLocationId === locationFilter;
      }

      const stockToCheck = isStaff
        ? prod.locationStock[assignedWarehouseId] || 0
        : prod.stock;

      let matchesStatus = true;
      if (statusFilter === 'in-stock') {
        matchesStatus = stockToCheck > prod.reorderLevel;
      } else if (statusFilter === 'low-stock') {
        matchesStatus = stockToCheck > 0 && stockToCheck <= prod.reorderLevel;
      } else if (statusFilter === 'out-of-stock') {
        matchesStatus = stockToCheck === 0;
      }

      return matchesSearch && matchesCategory && matchesLocation && matchesStatus;
    });
  }, [products, searchTerm, categoryFilter, locationFilter, statusFilter, isStaff, assignedWarehouseId]);

  // Product ledger audit items for the detail drawer
  const productMovementHistory = useMemo(() => {
    if (!selectedProduct) return [];
    const list = ledger.filter((l) => l.productId === selectedProduct.id);
    if (isStaff) {
      return list
        .filter((l) =>
          Boolean(
            l.fromLocationId === assignedWarehouseId ||
            l.toLocationId === assignedWarehouseId ||
            (l.fromLocationName &&
              l.fromLocationName.toLowerCase().includes(assignedWarehouse.toLowerCase())) ||
            (l.toLocationName &&
              l.toLocationName.toLowerCase().includes(assignedWarehouse.toLowerCase()))
          )
        )
        .slice(0, 8);
    }
    return list.slice(0, 8);
  }, [selectedProduct, ledger, isStaff, assignedWarehouseId, assignedWarehouse]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Products</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {isStaff
              ? `${filteredProducts.length} items relevant to ${assignedWarehouse}`
              : `${products.length} registered products across ${locations.length} warehouse locations.`}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add product</span>
        </button>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search products or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          {isStaff ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-[var(--surface-secondary)] border border-[var(--border)] rounded text-[var(--text)]">
              <Lock className="w-3 h-3 text-[var(--text-secondary)] shrink-0" />
              <span className="truncate">{assignedWarehouse}</span>
            </div>
          ) : (
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All stock statuses</option>
            <option value="in-stock">In stock (&gt; reorder)</option>
            <option value="low-stock">Low stock (≤ reorder)</option>
            <option value="out-of-stock">Out of stock (0 units)</option>
          </select>
        </div>
      </div>

      {/* 3. Products Table */}
      <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
              <th className="py-2.5 px-3 font-medium">Product</th>
              <th className="py-2.5 px-3 font-medium">SKU</th>
              <th className="py-2.5 px-3 font-medium">Category</th>
              <th className="py-2.5 px-3 font-medium">Primary location</th>
              <th className="py-2.5 px-3 font-medium text-right">
                {isStaff ? 'Facility Stock' : 'Stock'}
              </th>
              <th className="py-2.5 px-3 font-medium text-right">Reorder level</th>
              <th className="py-2.5 px-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-xs text-[var(--text-secondary)]">
                  No matching products found.
                </td>
              </tr>
            ) : (
              filteredProducts.map((prod) => {
                const displayedStock = isStaff
                  ? prod.locationStock[assignedWarehouseId] || 0
                  : prod.stock;
                const isOut = displayedStock === 0;
                const isLow = displayedStock > 0 && displayedStock <= prod.reorderLevel;
                const statusLabel = isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock';
                const locName = getLocationName(prod.primaryLocationId);

                return (
                  <tr
                    key={prod.id}
                    onClick={() => setSelectedProduct(prod)}
                    className="hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-medium text-[var(--text)]">
                      {prod.name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[var(--text-secondary)] text-[11px]">
                      {prod.sku}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                      {prod.category}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                      {locName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-[var(--text)]">
                      {displayedStock.toLocaleString()}{' '}
                      <span className="text-[10px] text-[var(--text-secondary)] font-normal">
                        {prod.unit}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                      {prod.reorderLevel}{' '}
                      <span className="text-[10px]">{prod.unit}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={statusLabel} size="sm" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--surface-secondary)] text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
          <span>
            Showing {filteredProducts.length} of {products.length} products
            {isStaff ? ` (${assignedWarehouse})` : ''}
          </span>
          <span>Click row to view details</span>
        </div>
      </div>

      {/* 4. PRODUCT DETAIL RIGHT-SIDE SLIDE-OVER DRAWER */}
      {selectedProduct && (
        <SlideOverDrawer
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          title={selectedProduct.name}
          subtitle={`SKU: ${selectedProduct.sku} · ${selectedProduct.category}`}
          width="lg"
        >
          {/* Stock Section */}
          <div className="space-y-1">
            <div className="text-xs text-[var(--text-secondary)]">
              {isStaff ? `Stock at ${assignedWarehouse}` : 'Total stock on hand'}
            </div>
            <div className="text-2xl font-semibold text-[var(--text)]">
              {isStaff
                ? (selectedProduct.locationStock[assignedWarehouseId] || 0).toLocaleString()
                : selectedProduct.stock.toLocaleString()}{' '}
              <span className="text-sm font-normal text-[var(--text-secondary)]">
                {selectedProduct.unit}
              </span>
            </div>
            {isStaff && (
              <div className="text-[11px] text-[var(--text-secondary)]">
                Total company stock: {selectedProduct.stock} {selectedProduct.unit}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2">
            <div className="text-xs font-medium text-[var(--text)]">Reorder level</div>
            <div className="text-sm text-[var(--text)]">
              {selectedProduct.reorderLevel} {selectedProduct.unit}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {selectedProduct.stock <= selectedProduct.reorderLevel ? (
                <span className="text-[var(--warning)] font-medium">
                  Current stock is at or below the safety threshold.
                </span>
              ) : (
                <span>Stock is above the safety threshold.</span>
              )}
            </p>
          </div>

          {/* Locations Breakdown */}
          <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2">
            <div className="text-xs font-medium text-[var(--text)]">Locations</div>
            <div className="divide-y divide-[var(--border-subtle)] text-xs">
              {locations.map((loc) => {
                const qty = selectedProduct.locationStock[loc.id] || 0;
                const isPrimary = loc.id === selectedProduct.primaryLocationId;
                const isUserWarehouse = loc.id === assignedWarehouseId;
                return (
                  <div
                    key={loc.id}
                    className={`py-2 flex items-center justify-between ${
                      isStaff && isUserWarehouse ? 'font-medium text-[var(--text)]' : ''
                    }`}
                  >
                    <div>
                      <span className="text-[var(--text)]">{loc.name}</span>
                      {isPrimary && (
                        <span className="text-[10px] text-[var(--text-secondary)] ml-1.5">
                          (primary)
                        </span>
                      )}
                      {isStaff && isUserWarehouse && (
                        <span className="text-[10px] text-[var(--accent)] ml-1.5">
                          (your assigned location)
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-[var(--text)] font-mono">
                      {qty} {selectedProduct.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Movement History */}
          <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2">
            <div className="text-xs font-medium text-[var(--text)]">Recent movement</div>
            {productMovementHistory.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] py-2">
                No recent activity recorded for this product.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] text-xs font-mono">
                {productMovementHistory.map((m) => {
                  const isPositive = m.quantityChange > 0;
                  const time = m.timestamp.includes('T') ? m.timestamp.split('T')[0] : m.timestamp;
                  return (
                    <div key={m.id} className="py-1.5 flex items-center justify-between">
                      <div className="space-x-2">
                        <span
                          className={`font-medium ${
                            isPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                          }`}
                        >
                          {isPositive ? `+${m.quantityChange}` : m.quantityChange} {m.unit}
                        </span>
                        <span className="text-[var(--text-secondary)] font-sans">
                          {m.operationType}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--text-secondary)]">{time}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-[var(--border)] pt-5 space-y-2">
            <div className="text-xs font-medium text-[var(--text)]">Actions</div>
            <div className={`grid ${isStaff ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
              <button
                onClick={() => {
                  handleOpenEdit(selectedProduct);
                }}
                className="w-full py-1.5 px-3 text-xs font-medium border border-[var(--border)] rounded text-[var(--text)] hover:bg-[var(--surface-secondary)] text-center transition-colors"
              >
                Edit product
              </button>

              {/* Delete product button is restricted from Warehouse Staff */}
              {!isStaff && (
                <button
                  onClick={() => {
                    setProductToDelete(selectedProduct);
                  }}
                  className="w-full py-1.5 px-3 text-xs font-medium border border-[var(--danger)]/30 rounded text-[var(--danger)] hover:bg-[var(--danger-subtle)] text-center transition-colors"
                >
                  Delete product
                </button>
              )}
            </div>
          </div>
        </SlideOverDrawer>
      )}

      {/* 5. ADD / EDIT PRODUCT SLIDE-OVER DRAWER */}
      <SlideOverDrawer
        isOpen={isFormDrawerOpen}
        onClose={() => setIsFormDrawerOpen(false)}
        title={editingProduct ? 'Edit product' : 'Add product'}
        subtitle="Manage product specifications, SKU and safety threshold"
        width="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
          {formError && (
            <div className="p-2.5 bg-[var(--danger-subtle)] text-[var(--danger)] rounded border border-[var(--danger)]/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[var(--text-secondary)] font-medium">Product name *</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Steel Rods 12mm"
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">SKU code *</label>
              <input
                type="text"
                required
                value={formSku}
                onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                placeholder="e.g. STL-001"
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] font-mono focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Category *</label>
              <input
                type="text"
                required
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="e.g. Raw Material"
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Unit of measure *</label>
              <select
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="m">Meters (m)</option>
                <option value="box">Boxes (box)</option>
                <option value="bags">Bags (bags)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Reorder level *</label>
              <input
                type="number"
                min="0"
                required
                value={formReorderLevel}
                onChange={(e) => setFormReorderLevel(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[var(--text-secondary)] font-medium">Primary location *</label>
            <select
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              disabled={isStaff}
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)] disabled:bg-[var(--surface-secondary)]"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
            {isStaff && (
              <p className="text-[11px] text-[var(--text-secondary)]">
                Assigned to your operational location ({assignedWarehouse}).
              </p>
            )}
          </div>

          {!editingProduct && (
            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Initial stock quantity</label>
              <input
                type="number"
                min="0"
                value={formInitialStock}
                onChange={(e) => setFormInitialStock(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
              <p className="text-[11px] text-[var(--text-secondary)]">
                Allocates directly to {getLocationName(formLocation)} upon creation.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormDrawerOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded text-[var(--text)] hover:bg-[var(--surface-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded"
            >
              {editingProduct ? 'Save changes' : 'Add product'}
            </button>
          </div>
        </form>
      </SlideOverDrawer>

      {/* 6. CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete product"
        message={`Are you sure you want to delete "${productToDelete?.name}" (${productToDelete?.sku})? This product currently has ${productToDelete?.stock} units in inventory.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
};
