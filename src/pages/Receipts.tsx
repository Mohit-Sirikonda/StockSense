import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, CheckCircle2, Trash2, AlertCircle, Lock } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SlideOverDrawer } from '../components/ui/SlideOverDrawer';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Receipt, OperationStatus, OperationItem } from '../types';
import { quantitySummary } from '../domain/selectors';
import { createId } from '../utils/id';

export const Receipts: React.FC = () => {
  const {
    receipts,
    products,
    can,
    locations,
    selectedWarehouseId,
    setSelectedWarehouseId,
    addReceipt,
    validateReceipt,
    setReceiptStatus,
    getLocationName,
    isStaff,
    assignedWarehouse,
    assignedWarehouseId,
  } = useInventory();
  const { showToast } = useToast();

  const submissionId = React.useRef(createId());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const warehouseFilter = selectedWarehouseId;
  const setWarehouseFilter = setSelectedWarehouseId;
  // Slide-over drawer states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  // Form states
  const [formSupplier, setFormSupplier] = useState('');
  const [formWarehouse, setFormWarehouse] = useState(
    isStaff ? assignedWarehouseId : locations[0]?.id || 'loc-main',
  );
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<OperationStatus>('Ready');

  const [formItems, setFormItems] = useState<Array<{ productId: string; quantity: number }>>([
    {
      productId: products[0]?.id || '',
      quantity: 50,
    },
  ]);
  const [formError, setFormError] = useState('');

  // Validate dialog
  const [receiptToValidate, setReceiptToValidate] = useState<Receipt | null>(null);

  const handleOpenCreate = () => {
    submissionId.current = createId();
    setFormSupplier('');
    setFormWarehouse(
      isStaff
        ? assignedWarehouseId
        : selectedWarehouseId !== 'all'
          ? selectedWarehouseId
          : locations[0]?.id || 'loc-main',
    );
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormStatus('Ready');
    setFormItems([
      {
        productId: products[0]?.id || '',
        quantity: 50,
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
        quantity: 10,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: 'productId' | 'quantity', value: string | number) => {
    setFormItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          [field]: field === 'quantity' ? Number(value) : value,
        };
      }),
    );
  };

  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formSupplier.trim()) {
      setFormError('Supplier name is required.');
      return;
    }

    if (isStaff && formWarehouse !== assignedWarehouseId) {
      setFormError(`Warehouse Staff may only receive shipments into ${assignedWarehouse}.`);
      return;
    }

    for (const it of formItems) {
      if (it.quantity <= 0) {
        setFormError('All quantities must be greater than zero.');
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

    const newReceipt = addReceipt(
      {
        supplier: formSupplier.trim(),
        date: formDate,
        warehouseId: formWarehouse,
        notes: formNotes.trim(),
        items: processedItems,
        status: formStatus,
      },
      submissionId.current,
    );
    if (!newReceipt.success) {
      setFormError(newReceipt.error);
      return;
    }

    showToast(`Receipt ${newReceipt.data.id} created.`, 'success');
    setIsCreateOpen(false);
  };

  const handleConfirmValidate = () => {
    if (!receiptToValidate) return;

    if (isStaff && receiptToValidate.warehouseId !== assignedWarehouseId) {
      showToast(`Access restricted: You may only validate receipts for ${assignedWarehouse}.`, 'error');
      setReceiptToValidate(null);
      return;
    }

    const res = validateReceipt(receiptToValidate.id);
    if (!res.success) {
      showToast(res.error || 'Validation failed', 'error');
    } else {
      showToast(
        `Receipt ${receiptToValidate.id} validated. Stock allocated to ${getLocationName(
          receiptToValidate.warehouseId,
        )}.`,
        'success',
      );
      if (selectedReceipt?.id === receiptToValidate.id) {
        setSelectedReceipt({ ...selectedReceipt, status: 'Done' });
      }
    }
    setReceiptToValidate(null);
  };

  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (isStaff && r.warehouseId !== assignedWarehouseId) {
        return false;
      }

      const matchesSearch =
        searchTerm === '' ||
        r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.items.some((item) =>
          [item.sku, item.productName].some((value) =>
            value.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
        );

      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesWarehouse = isStaff || warehouseFilter === 'all' || r.warehouseId === warehouseFilter;

      return matchesSearch && matchesStatus && matchesWarehouse;
    });
  }, [receipts, searchTerm, statusFilter, warehouseFilter, isStaff, assignedWarehouseId]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Receipts</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {isStaff
              ? `Manage inbound receipts destined for ${assignedWarehouse}.`
              : 'Manage incoming purchase orders and stock receipts from suppliers across all facilities.'}
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New receipt</span>
        </button>
      </div>

      {/* 2. Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search reference, supplier, product or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <select
            aria-label="Receipt status filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All statuses</option>
            <option value="Ready">Ready</option>
            <option value="Waiting">Waiting</option>
            <option value="Draft">Draft</option>
            <option value="Done">Validated (Done)</option>
            <option value="Canceled">Canceled</option>
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
              <option value="all">All destination warehouses</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 3. Receipts Table */}
      <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
              <th className="py-2.5 px-3 font-medium">Reference</th>
              <th className="py-2.5 px-3 font-medium">Supplier</th>
              <th className="py-2.5 px-3 font-medium">Date</th>
              <th className="py-2.5 px-3 font-medium">Destination</th>
              <th className="py-2.5 px-3 font-medium text-right">Items / Units</th>
              <th className="py-2.5 px-3 font-medium">Status</th>
              <th className="py-2.5 px-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredReceipts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-xs text-[var(--text-secondary)]">
                  No receipts found matching current filters.
                </td>
              </tr>
            ) : (
              filteredReceipts.map((rcpt) => {
                const totalUnits = quantitySummary(rcpt.items);
                const isDone = rcpt.status === 'Done';
                const isCanceled = rcpt.status === 'Canceled';
                const destName = getLocationName(rcpt.warehouseId);

                return (
                  <tr
                    key={rcpt.id}
                    onClick={() => setSelectedReceipt(rcpt)}
                    className="hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono text-[var(--text)] font-medium">{rcpt.id}</td>
                    <td className="py-2.5 px-3 text-[var(--text)]">{rcpt.supplier}</td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">{rcpt.date}</td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">{destName}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--text)] font-medium">
                      {totalUnits}{' '}
                      <span className="text-[10px] text-[var(--text-secondary)] font-normal">
                        ({rcpt.items.length} lines)
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={rcpt.status} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {isDone ? (
                        <span className="text-[11px] text-[var(--success)] font-medium inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Validated
                        </span>
                      ) : isCanceled ? (
                        <span className="text-[var(--text-secondary)]">Canceled</span>
                      ) : (
                        <button
                          onClick={() => setReceiptToValidate(rcpt)}
                          className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                        >
                          Validate receipt
                        </button>
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
            Showing {filteredReceipts.length} of {receipts.length} receipts
            {isStaff ? ` (${assignedWarehouse})` : ''}
          </span>
          <span>Click row to view manifest details</span>
        </div>
      </div>

      {/* 4. DETAIL SLIDE-OVER DRAWER */}
      {selectedReceipt && (
        <SlideOverDrawer
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          title={`Receipt ${selectedReceipt.id}`}
          subtitle={`Supplier: ${selectedReceipt.supplier}`}
          width="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <div className="text-[var(--text-secondary)]">Status</div>
                <div className="mt-1">
                  <StatusBadge status={selectedReceipt.status} size="sm" />
                </div>
              </div>

              <div>
                <div className="text-[var(--text-secondary)]">Arrival date</div>
                <div className="mt-1 font-medium text-[var(--text)]">{selectedReceipt.date}</div>
              </div>

              <div>
                <div className="text-[var(--text-secondary)]">Destination warehouse</div>
                <div className="mt-1 font-medium text-[var(--text)]">
                  {getLocationName(selectedReceipt.warehouseId)}
                </div>
              </div>

              <div>
                <div className="text-[var(--text-secondary)]">Quantities by unit</div>
                <div className="mt-1 font-medium text-[var(--text)]">
                  {quantitySummary(selectedReceipt.items)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-[var(--text)]">Line items</div>
              <div className="border border-[var(--border)] rounded divide-y divide-[var(--border-subtle)] overflow-hidden">
                {selectedReceipt.items.map((it, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-[var(--text)]">{it.productName}</div>
                      <div className="text-[10px] text-[var(--text-secondary)] font-mono">{it.sku}</div>
                    </div>
                    <div className="font-mono font-medium text-[var(--text)]">
                      {it.quantity} {it.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!['Done', 'Canceled'].includes(selectedReceipt.status) && (
              <label className="field-label">
                Receipt status
                <select
                  value={selectedReceipt.status}
                  onChange={(e) => {
                    const result = setReceiptStatus(
                      selectedReceipt.id,
                      e.target.value as 'Draft' | 'Waiting' | 'Ready' | 'Canceled',
                    );
                    if (!result.success) showToast(result.error, 'error');
                    else setSelectedReceipt(result.data);
                  }}
                >
                  {['Draft', 'Waiting', 'Ready', 'Canceled'].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            )}
            {selectedReceipt.notes && (
              <div className="space-y-1 pt-2">
                <div className="text-[var(--text-secondary)]">Notes</div>
                <div className="p-2.5 bg-[var(--surface-secondary)] rounded text-[var(--text)]">
                  {selectedReceipt.notes}
                </div>
              </div>
            )}

            {!['Done', 'Canceled'].includes(selectedReceipt.status) && (
              <div className="pt-4 border-t border-[var(--border)]">
                <button
                  onClick={() => {
                    const r = selectedReceipt;
                    setSelectedReceipt(null);
                    setReceiptToValidate(r);
                  }}
                  className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium rounded transition-colors"
                >
                  Validate and receive stock
                </button>
              </div>
            )}
          </div>
        </SlideOverDrawer>
      )}

      {/* 5. CREATE RECEIPT SLIDE-OVER DRAWER */}
      <SlideOverDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New receipt"
        subtitle="Log an incoming supplier shipment"
        width="lg"
      >
        <form onSubmit={handleCreateReceipt} className="space-y-4 text-xs">
          {formError && (
            <div className="p-2.5 bg-[var(--danger-subtle)] text-[var(--danger)] rounded border border-[var(--danger)]/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="receipts-field-0" className="text-[var(--text-secondary)] font-medium">
              Supplier / Vendor *
            </label>
            <input
              id="receipts-field-0"
              type="text"
              required
              value={formSupplier}
              onChange={(e) => setFormSupplier(e.target.value)}
              placeholder="e.g. Apex Industrial Supplies"
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <label className="field-label">
            Initial status
            <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as OperationStatus)}>
              {['Draft', 'Waiting', 'Ready'].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="receipts-field-1" className="text-[var(--text-secondary)] font-medium">
                Arrival date *
              </label>
              <input
                id="receipts-field-1"
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="receipts-field-2" className="text-[var(--text-secondary)] font-medium">
                Destination warehouse *
              </label>
              <select
                id="receipts-field-2"
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
              {formItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    aria-label={`Product on line ${idx + 1}`}
                    value={item.productId}
                    onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    aria-label={`Quantity on line ${idx + 1}`}
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
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="receipts-field-3" className="text-[var(--text-secondary)] font-medium">
              Notes
            </label>
            <textarea
              id="receipts-field-3"
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="e.g. Delivery order #9021 confirmed."
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
              Create receipt
            </button>
          </div>
        </form>
      </SlideOverDrawer>

      {/* 6. CONFIRM VALIDATE DIALOG */}
      <ConfirmDialog
        isOpen={!!receiptToValidate}
        onClose={() => setReceiptToValidate(null)}
        onConfirm={handleConfirmValidate}
        title="Validate receipt"
        message={`Validate receipt ${receiptToValidate?.id} from ${receiptToValidate?.supplier}? This will immediately update inventory counts in ${getLocationName(
          receiptToValidate?.warehouseId || '',
        )}.`}
        confirmLabel="Validate & receive"
        variant="info"
      />
    </div>
  );
};
