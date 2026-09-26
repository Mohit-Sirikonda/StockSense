import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Transfer } from '../types';

export const Transfers: React.FC = () => {
  const {
    transfers,
    products,
    locations,
    addTransfer,
    validateTransfer,
    getLocationName,
    isStaff,
    assignedWarehouse,
    assignedWarehouseId,
  } = useInventory();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Transfer form state
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [sourceWarehouse, setSourceWarehouse] = useState(
    isStaff ? assignedWarehouseId : 'loc-main'
  );
  const [destWarehouse, setDestWarehouse] = useState(
    isStaff
      ? locations.find((l) => l.id !== assignedWarehouseId)?.id || 'loc-fg'
      : 'loc-prod'
  );
  const [transferQty, setTransferQty] = useState('20');
  const [transferError, setTransferError] = useState('');

  // Update defaults when role or locations change
  useEffect(() => {
    if (isStaff) {
      setSourceWarehouse(assignedWarehouseId);
      const other = locations.find((l) => l.id !== assignedWarehouseId)?.id || 'loc-fg';
      setDestWarehouse(other);
    }
  }, [isStaff, assignedWarehouseId, locations]);

  // Validate dialog
  const [transferToValidate, setTransferToValidate] = useState<Transfer | null>(null);

  const activeProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const availableAtSource = useMemo(() => {
    if (!activeProduct) return 0;
    return activeProduct.locationStock[sourceWarehouse] || 0;
  }, [activeProduct, sourceWarehouse]);

  const currentAtDest = useMemo(() => {
    if (!activeProduct) return 0;
    return activeProduct.locationStock[destWarehouse] || 0;
  }, [activeProduct, destWarehouse]);

  const parsedQty = parseInt(transferQty, 10) || 0;
  const remainingAtSource = availableAtSource - parsedQty;
  const projectedAtDest = currentAtDest + parsedQty;

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');

    if (sourceWarehouse === destWarehouse) {
      setTransferError('Source and destination locations cannot be the same.');
      return;
    }

    // Role-based rule: Warehouse Staff can only perform transfers involving their assigned location
    if (
      isStaff &&
      sourceWarehouse !== assignedWarehouseId &&
      destWarehouse !== assignedWarehouseId
    ) {
      setTransferError(
        `Operational policy: As Warehouse Staff assigned to ${assignedWarehouse}, transfers must originate from or be destined for ${assignedWarehouse}.`
      );
      return;
    }

    if (parsedQty <= 0) {
      setTransferError('Transfer quantity must be greater than zero.');
      return;
    }

    if (parsedQty > availableAtSource) {
      setTransferError(
        `Insufficient stock at ${getLocationName(sourceWarehouse)}. Available: ${availableAtSource}, requested: ${parsedQty}`
      );
      return;
    }

    const newTransfer = addTransfer({
      productId: selectedProductId,
      productName: activeProduct?.name || 'Item',
      sku: activeProduct?.sku || 'SKU',
      unit: activeProduct?.unit || 'pcs',
      fromLocationId: sourceWarehouse,
      toLocationId: destWarehouse,
      quantity: parsedQty,
      date: new Date().toISOString().split('T')[0],
      notes: isStaff
        ? `Relocated via ${assignedWarehouse} operations`
        : 'Internal stock relocation',
      status: 'Ready',
    });

    const res = validateTransfer(newTransfer.id);
    if (res.success) {
      showToast(
        `Moved ${parsedQty} ${activeProduct?.unit} from ${getLocationName(sourceWarehouse)} to ${getLocationName(
          destWarehouse
        )}.`,
        'success'
      );
      setTransferQty('10');
    } else {
      showToast(`Transfer staged: ${newTransfer.id}`, 'info');
    }
  };

  const handleConfirmValidate = () => {
    if (!transferToValidate) return;

    if (
      isStaff &&
      transferToValidate.fromLocationId !== assignedWarehouseId &&
      transferToValidate.toLocationId !== assignedWarehouseId
    ) {
      showToast(
        `Access restricted: You may only execute transfers involving ${assignedWarehouse}.`,
        'error'
      );
      setTransferToValidate(null);
      return;
    }

    const res = validateTransfer(transferToValidate.id);
    if (!res.success) {
      showToast(res.error || 'Transfer validation failed', 'error');
    } else {
      showToast(
        `Transfer ${transferToValidate.id} completed.`,
        'success'
      );
    }
    setTransferToValidate(null);
  };

  // Filter transfers for staff
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (
        isStaff &&
        t.fromLocationId !== assignedWarehouseId &&
        t.toLocationId !== assignedWarehouseId
      ) {
        return false;
      }

      const matchesSearch =
        searchTerm === '' ||
        t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.productName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transfers, searchTerm, statusFilter, isStaff, assignedWarehouseId]);

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)]">Internal Transfers</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          {isStaff
            ? `Relocate inventory involving ${assignedWarehouse} without changing total company stock.`
            : 'Relocate inventory between warehouse facilities without changing total company stock.'}
        </p>
      </div>

      {/* 2. Human-Designed Transfer Formulation */}
      <section className="border border-[var(--border)] rounded bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text)]">Relocate stock</h2>
          {isStaff && (
            <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
              <Lock className="w-3 h-3 text-[var(--accent)]" /> Must involve {assignedWarehouse}
            </span>
          )}
        </div>

        {transferError && (
          <div className="p-2.5 bg-[var(--danger-subtle)] text-[var(--danger)] rounded border border-[var(--danger)]/20 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{transferError}</span>
          </div>
        )}

        <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs">
          {/* Product & Qty Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Select product</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) · {isStaff ? `${p.locationStock[assignedWarehouseId] || 0} at facility` : `${p.stock} total`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Transfer quantity</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={availableAtSource || 99999}
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
                <span className="text-[var(--text-secondary)]">{activeProduct?.unit}</span>
              </div>
            </div>
          </div>

          {/* Clean Horizontal From -> To Arrangement */}
          <div className="p-4 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* From */}
            <div className="w-full sm:w-5/12 space-y-2">
              <div className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                From location
              </div>
              <select
                value={sourceWarehouse}
                onChange={(e) => setSourceWarehouse(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {isStaff && l.id === assignedWarehouseId ? '(Your facility)' : ''}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-[var(--text-secondary)] flex justify-between">
                <span>Available: {availableAtSource} {activeProduct?.unit}</span>
                <span>After: {remainingAtSource >= 0 ? `${remainingAtSource} ${activeProduct?.unit}` : 'Deficit'}</span>
              </div>
            </div>

            {/* Direction Arrow */}
            <div className="flex flex-col items-center justify-center text-[var(--text-secondary)] shrink-0 py-1">
              <div className="flex items-center gap-1.5 font-medium text-xs text-[var(--text)]">
                <span>{parsedQty} {activeProduct?.unit}</span>
                <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]" />
              </div>
            </div>

            {/* To */}
            <div className="w-full sm:w-5/12 space-y-2">
              <div className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                To location
              </div>
              <select
                value={destWarehouse}
                onChange={(e) => setDestWarehouse(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {isStaff && l.id === assignedWarehouseId ? '(Your facility)' : ''}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-[var(--text-secondary)] flex justify-between">
                <span>Current: {currentAtDest} {activeProduct?.unit}</span>
                <span>Projected: {projectedAtDest} {activeProduct?.unit}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={remainingAtSource < 0 || availableAtSource === 0}
              className="px-4 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium rounded disabled:opacity-40 transition-colors"
            >
              Confirm transfer
            </button>
          </div>
        </form>
      </section>

      {/* 3. Transfer History Table */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--text)]">Transfer history</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search transfers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-2.5 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none"
            />
          </div>
        </div>

        <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                <th className="py-2.5 px-3 font-medium">Reference</th>
                <th className="py-2.5 px-3 font-medium">Date</th>
                <th className="py-2.5 px-3 font-medium">Product</th>
                <th className="py-2.5 px-3 font-medium text-right">Quantity</th>
                <th className="py-2.5 px-3 font-medium">Route</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[var(--text-secondary)]">
                    No transfer records found.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => {
                  const isDone = t.status === 'Done';
                  const fromName = getLocationName(t.fromLocationId);
                  const toName = getLocationName(t.toLocationId);

                  return (
                    <tr key={t.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[var(--text)] font-medium">{t.id}</td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)]">{t.date}</td>
                      <td className="py-2.5 px-3 font-medium text-[var(--text)]">{t.productName}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-[var(--text)]">
                        {t.quantity} {t.unit}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                        <span>{fromName}</span>
                        <span className="mx-1 text-[var(--text-secondary)]">→</span>
                        <span>{toName}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={t.status} size="sm" />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isDone ? (
                          <span className="text-[11px] text-[var(--success)] font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        ) : (
                          <button
                            onClick={() => setTransferToValidate(t)}
                            className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                          >
                            Execute
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--surface-secondary)] text-[11px] text-[var(--text-secondary)]">
            Showing {filteredTransfers.length} of {transfers.length} transfers
            {isStaff ? ` (filtered to ${assignedWarehouse})` : ''}
          </div>
        </div>
      </section>

      {/* CONFIRM EXECUTE DIALOG */}
      <ConfirmDialog
        isOpen={!!transferToValidate}
        onClose={() => setTransferToValidate(null)}
        onConfirm={handleConfirmValidate}
        title="Execute transfer"
        message={`Execute transfer ${transferToValidate?.id} (${transferToValidate?.quantity} ${transferToValidate?.unit} of ${transferToValidate?.productName}) from ${getLocationName(
          transferToValidate?.fromLocationId || ''
        )} to ${getLocationName(transferToValidate?.toLocationId || '')}?`}
        confirmLabel="Execute transfer"
        variant="info"
      />
    </div>
  );
};
