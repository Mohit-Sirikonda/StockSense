import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SlideOverDrawer } from '../components/ui/SlideOverDrawer';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Delivery, OperationStatus, OperationItem } from '../types';

export const Deliveries: React.FC = () => {
  const {
    deliveries,
    products,
    locations,
    selectedWarehouseId,
    addDelivery,
    validateDelivery,
    getLocationName,
    isStaff,
    assignedWarehouse,
    assignedWarehouseId,
  } = useInventory();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>(
    isStaff ? assignedWarehouseId : selectedWarehouseId || 'all'
  );

  // Slide-over drawer states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  // Form states
  const [formCustomer, setFormCustomer] = useState('');
  const [formWarehouse, setFormWarehouse] = useState(
    isStaff ? assignedWarehouseId : locations[0]?.id || 'loc-main'
  );
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<OperationStatus>('Ready');

  const [formItems, setFormItems] = useState<
    Array<{ productId: string; quantity: number }>
  >([
    {
      productId: products[0]?.id || '',
      quantity: 10,
    },
  ]);
  const [formError, setFormError] = useState('');

  // Validate dialog
  const [deliveryToValidate, setDeliveryToValidate] = useState<Delivery | null>(null);

  useEffect(() => {
    if (isStaff) {
      setWarehouseFilter(assignedWarehouseId);
    } else if (selectedWarehouseId !== 'all') {
      setWarehouseFilter(selectedWarehouseId);
    }
  }, [isStaff, assignedWarehouseId, selectedWarehouseId]);

  const handleOpenCreate = () => {
    setFormCustomer('');
    setFormWarehouse(
      isStaff
        ? assignedWarehouseId
        : selectedWarehouseId !== 'all'
        ? selectedWarehouseId
        : locations[0]?.id || 'loc-main'
    );
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormStatus('Ready');
    setFormItems([
      {
        productId: products[0]?.id || '',
        quantity: 10,
      },
    ]);
    setFormError('');
    setIsCreateOpen(true);
  };

  const handleAddItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      {
        productId: products[0]?.id || '',
        quantity: 5,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: 'productId' | 'quantity',
    value: string | number
  ) => {
    setFormItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          [field]: field === 'quantity' ? Math.max(1, Number(value) || 0) : value,
        };
      })
    );
  };

  const handleCreateDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCustomer.trim()) {
      setFormError('Customer name is required.');
      return;
    }

    if (isStaff && formWarehouse !== assignedWarehouseId) {
      setFormError(`Warehouse Staff may only create dispatches from ${assignedWarehouse}.`);
      return;
    }

    for (const it of formItems) {
      if (it.quantity <= 0) {
        setFormError('All quantities must be greater than zero.');
        return;
      }

      const prod = products.find((p) => p.id === it.productId);
      if (!prod) continue;
      const currentLocStock = prod.locationStock[formWarehouse] || 0;
      if (it.quantity > currentLocStock) {
        setFormError(
          `Insufficient stock for "${prod.name}" at ${getLocationName(formWarehouse)}. Required: ${it.quantity}, Available: ${currentLocStock}`
        );
        return;
      }
    }

    const processedItems: OperationItem[] = formItems.map((it) => {
      const prod = products.find((p) => p.id === it.productId);
      return {
        productId: it.productId,
        productName: prod ? prod.name : 'Item',
        sku: prod ? prod.sku : 'SKU',
        unit: prod ? prod.unit : 'pcs',
        quantity: it.quantity,
      };
    });

    const newDelivery = addDelivery({
      customer: formCustomer.trim(),
      date: formDate,
      warehouseId: formWarehouse,
      notes: formNotes.trim(),
      items: processedItems,
      status: formStatus,
      stage: 'Packed',
    });

    showToast(`Delivery ${newDelivery.id} created.`, 'success');
    setIsCreateOpen(false);
  };

  const handleConfirmValidate = () => {
    if (!deliveryToValidate) return;

    if (isStaff && deliveryToValidate.warehouseId !== assignedWarehouseId) {
      showToast(`Access restricted: You may only dispatch orders from ${assignedWarehouse}.`, 'error');
      setDeliveryToValidate(null);
      return;
    }

    const res = validateDelivery(deliveryToValidate.id);
    if (!res.success) {
      showToast(res.error || 'Dispatch failed', 'error');
    } else {
      showToast(
        `Delivery ${deliveryToValidate.id} dispatched. Stock deducted from ${getLocationName(
          deliveryToValidate.warehouseId
        )}.`,
        'success'
      );
      if (selectedDelivery?.id === deliveryToValidate.id) {
        setSelectedDelivery({ ...selectedDelivery, status: 'Done', stage: 'Validated' });
      }
    }
    setDeliveryToValidate(null);
  };

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (isStaff && d.warehouseId !== assignedWarehouseId) {
        return false;
      }

      const matchesSearch =
        searchTerm === '' ||
        d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.customer.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
      const matchesWarehouse =
        isStaff || warehouseFilter === 'all' || d.warehouseId === warehouseFilter;

      return matchesSearch && matchesStatus && matchesWarehouse;
    });
  }, [deliveries, searchTerm, statusFilter, warehouseFilter, isStaff, assignedWarehouseId]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Deliveries</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {isStaff
              ? `Manage customer dispatch orders originating from ${assignedWarehouse}.`
              : 'Manage outgoing shipments, customer orders, and dispatch verification across all facilities.'}
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New delivery</span>
        </button>
      </div>

      {/* 2. Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by reference or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All statuses</option>
            <option value="Ready">Ready</option>
            <option value="Waiting">Waiting</option>
            <option value="Draft">Draft</option>
            <option value="Done">Dispatched (Done)</option>
          </select>
        </div>

        <div>
          {isStaff ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-[var(--surface-secondary)] border border-[var(--border)] rounded text-[var(--text)]">
              <Lock className="w-3 h-3 text-[var(--text-secondary)] shrink-0" />
              <span className="truncate">{assignedWarehouse} (Assigned)</span>
            </div>
          ) : (
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All origin warehouses</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 3. Deliveries Table */}
      <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
              <th className="py-2.5 px-3 font-medium">Reference</th>
              <th className="py-2.5 px-3 font-medium">Customer</th>
              <th className="py-2.5 px-3 font-medium">Date</th>
              <th className="py-2.5 px-3 font-medium">Origin</th>
              <th className="py-2.5 px-3 font-medium text-right">Items / Units</th>
              <th className="py-2.5 px-3 font-medium">Status</th>
              <th className="py-2.5 px-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredDeliveries.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-xs text-[var(--text-secondary)]">
                  No deliveries found matching current filters.
                </td>
              </tr>
            ) : (
              filteredDeliveries.map((dlv) => {
                const totalUnits = dlv.items.reduce((sum, it) => sum + it.quantity, 0);
                const isDone = dlv.status === 'Done';
                const originName = getLocationName(dlv.warehouseId);

                let hasStock = true;
                if (!isDone) {
                  for (const it of dlv.items) {
                    const prod = products.find((p) => p.id === it.productId);
                    if (!prod || (prod.locationStock[dlv.warehouseId] || 0) < it.quantity) {
                      hasStock = false;
                      break;
                    }
                  }
                }

                return (
                  <tr
                    key={dlv.id}
                    onClick={() => setSelectedDelivery(dlv)}
                    className="hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono text-[var(--text)] font-medium">
                      {dlv.id}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text)]">{dlv.customer}</td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">{dlv.date}</td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">{originName}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--text)] font-medium">
                      {totalUnits.toLocaleString()}{' '}
                      <span className="text-[10px] text-[var(--text-secondary)] font-normal">
                        ({dlv.items.length} lines)
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={dlv.status} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {isDone ? (
                        <span className="text-[11px] text-[var(--success)] font-medium inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Dispatched
                        </span>
                      ) : hasStock ? (
                        <button
                          onClick={() => setDeliveryToValidate(dlv)}
                          className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                        >
                          Dispatch order
                        </button>
                      ) : (
                        <span className="text-[11px] text-[var(--danger)]">
                          Insufficient stock
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--surface-secondary)] text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
          <span>
            Showing {filteredDeliveries.length} of {deliveries.length} deliveries
            {isStaff ? ` (${assignedWarehouse})` : ''}
          </span>
          <span>Click row to view manifest details</span>
        </div>
      </div>

      {/* 4. DETAIL SLIDE-OVER DRAWER */}
      {selectedDelivery && (
        <SlideOverDrawer
          isOpen={!!selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
          title={`Delivery ${selectedDelivery.id}`}
          subtitle={`Customer: ${selectedDelivery.customer}`}
          width="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <div className="text-[var(--text-secondary)]">Status</div>
                <div className="mt-1">
                  <StatusBadge status={selectedDelivery.status} size="sm" />
                </div>
              </div>

              <div>
                <div className="text-[var(--text-secondary)]">Dispatch date</div>
                <div className="mt-1 font-medium text-[var(--text)]">{selectedDelivery.date}</div>
              </div>

              <div>
                <div className="text-[var(--text-secondary)]">Origin warehouse</div>
                <div className="mt-1 font-medium text-[var(--text)]">
                  {getLocationName(selectedDelivery.warehouseId)}
                </div>
              </div>

              <div>
                <div className="text-[var(--text-secondary)]">Total units</div>
                <div className="mt-1 font-medium text-[var(--text)]">
                  {selectedDelivery.items.reduce((s, i) => s + i.quantity, 0)} units
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-[var(--text)]">Line items</div>
              <div className="border border-[var(--border)] rounded divide-y divide-[var(--border-subtle)] overflow-hidden">
                {selectedDelivery.items.map((it, idx) => {
                  const prod = products.find((p) => p.id === it.productId);
                  const available = prod ? prod.locationStock[selectedDelivery.warehouseId] || 0 : 0;
                  const hasStock = available >= it.quantity;

                  return (
                    <div key={idx} className="p-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[var(--text)]">{it.productName}</div>
                        <div className="text-[10px] text-[var(--text-secondary)] font-mono">
                          {it.sku} · {available} available at warehouse
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-medium text-[var(--text)]">
                          {it.quantity} {it.unit}
                        </div>
                        {!hasStock && selectedDelivery.status !== 'Done' && (
                          <div className="text-[10px] text-[var(--danger)]">deficit</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedDelivery.notes && (
              <div className="space-y-1 pt-2">
                <div className="text-[var(--text-secondary)]">Dispatch instructions</div>
                <div className="p-2.5 bg-[var(--surface-secondary)] rounded text-[var(--text)]">
                  {selectedDelivery.notes}
                </div>
              </div>
            )}

            {selectedDelivery.status !== 'Done' && (
              <div className="pt-4 border-t border-[var(--border)]">
                <button
                  onClick={() => {
                    const d = selectedDelivery;
                    setSelectedDelivery(null);
                    setDeliveryToValidate(d);
                  }}
                  className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium rounded transition-colors"
                >
                  Confirm and dispatch order
                </button>
              </div>
            )}
          </div>
        </SlideOverDrawer>
      )}

      {/* 5. CREATE DELIVERY SLIDE-OVER DRAWER */}
      <SlideOverDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New delivery"
        subtitle="Prepare an outbound order for customer dispatch"
        width="lg"
      >
        <form onSubmit={handleCreateDelivery} className="space-y-4 text-xs">
          {formError && (
            <div className="p-2.5 bg-[var(--danger-subtle)] text-[var(--danger)] rounded border border-[var(--danger)]/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[var(--text-secondary)] font-medium">Customer / Recipient *</label>
            <input
              type="text"
              required
              value={formCustomer}
              onChange={(e) => setFormCustomer(e.target.value)}
              placeholder="e.g. Metro Construction Ltd."
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Dispatch date *</label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Origin warehouse *</label>
              <select
                value={formWarehouse}
                onChange={(e) => setFormWarehouse(e.target.value)}
                disabled={isStaff}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)] disabled:bg-[var(--surface-secondary)]"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              {isStaff && (
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Locked to your assigned warehouse ({assignedWarehouse}).
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <label className="text-[var(--text-secondary)] font-medium">Items</label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-[var(--accent)] hover:underline text-[11px] font-medium"
              >
                + Add item
              </button>
            </div>

            <div className="space-y-2">
              {formItems.map((item, idx) => {
                const prod = products.find((p) => p.id === item.productId);
                const available = prod ? prod.locationStock[formWarehouse] || 0 : 0;

                return (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <select
                        value={item.productId}
                        onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                      <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 pl-1">
                        Available at origin: {available}
                      </div>
                    </div>

                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-20 px-2 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] text-right font-medium focus:outline-none focus:border-[var(--accent)]"
                    />

                    <button
                      type="button"
                      disabled={formItems.length === 1}
                      onClick={() => handleRemoveItemRow(idx)}
                      className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--danger)] disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[var(--text-secondary)] font-medium">Instructions / Notes</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="e.g. Call client prior to delivery."
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded text-[var(--text)] hover:bg-[var(--surface-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded"
            >
              Create delivery
            </button>
          </div>
        </form>
      </SlideOverDrawer>

      {/* 6. CONFIRM DISPATCH DIALOG */}
      <ConfirmDialog
        isOpen={!!deliveryToValidate}
        onClose={() => setDeliveryToValidate(null)}
        onConfirm={handleConfirmValidate}
        title="Dispatch delivery"
        message={`Dispatch delivery order ${deliveryToValidate?.id} for ${deliveryToValidate?.customer}? Stock will be deducted from ${getLocationName(
          deliveryToValidate?.warehouseId || ''
        )}.`}
        confirmLabel="Dispatch order"
        variant="info"
      />
    </div>
  );
};
