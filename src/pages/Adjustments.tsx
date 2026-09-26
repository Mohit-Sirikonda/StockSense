import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, AlertCircle, Lock } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { SlideOverDrawer } from '../components/ui/SlideOverDrawer';
import { Adjustment } from '../types';
import { createId } from '../utils/id';

export const Adjustments: React.FC = () => {
  const {
    adjustments,
    products,
    locations,
    selectedWarehouseId,
    addAdjustment,
    getLocationName,
    isStaff,
    assignedWarehouse,
    assignedWarehouseId,
  } = useInventory();
  const { showToast } = useToast();

  const submissionId = React.useRef(createId());
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');

  // Slide-over drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Form states
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [selectedLocationId, setSelectedLocationId] = useState(
    isStaff
      ? assignedWarehouseId
      : selectedWarehouseId !== 'all'
        ? selectedWarehouseId
        : locations[0]?.id || 'loc-main',
  );
  const [physicalCount, setPhysicalCount] = useState<string>('0');
  const [reason, setReason] = useState<string>('Inventory Count Discrepancy');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (isStaff) {
      setSelectedLocationId(assignedWarehouseId);
    }
  }, [isStaff, assignedWarehouseId]);

  const activeProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const currentSystemQty = useMemo(() => {
    if (!activeProduct) return 0;
    return activeProduct.locationStock[selectedLocationId] || 0;
  }, [activeProduct, selectedLocationId]);

  // When opening drawer or changing selection, reset physical count to system quantity
  const handleOpenDrawer = () => {
    submissionId.current = createId();
    const locId = isStaff
      ? assignedWarehouseId
      : selectedWarehouseId !== 'all'
        ? selectedWarehouseId
        : locations[0]?.id || 'loc-main';

    setSelectedProductId(products[0]?.id || '');
    setSelectedLocationId(locId);
    setPhysicalCount((products[0]?.locationStock[locId] || 0).toString());
    setReason('Inventory Count Discrepancy');
    setNotes('');
    setFormError('');
    setIsDrawerOpen(true);
  };

  React.useEffect(() => {
    if (isDrawerOpen) {
      setPhysicalCount(currentSystemQty.toString());
    }
  }, [currentSystemQty, isDrawerOpen, selectedProductId, selectedLocationId]);

  const parsedPhysicalCount = physicalCount.trim() === '' ? NaN : Number(physicalCount);
  const validCount = Number.isFinite(parsedPhysicalCount) ? parsedPhysicalCount : 0;
  const difference = validCount - currentSystemQty;

  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (isStaff && selectedLocationId !== assignedWarehouseId) {
      setFormError(`Warehouse Staff may only record physical counts for ${assignedWarehouse}.`);
      return;
    }

    if (!Number.isFinite(parsedPhysicalCount) || parsedPhysicalCount < 0) {
      setFormError('Physical count must be a non-negative number.');
      return;
    }

    if (difference === 0) {
      setFormError('Physical count matches system balance. Difference is 0.');
      return;
    }

    if (!activeProduct) return;

    const res = addAdjustment(
      {
        productId: selectedProductId,
        productName: activeProduct.name,
        sku: activeProduct.sku,
        unit: activeProduct.unit,
        locationId: selectedLocationId,
        physicalCount: parsedPhysicalCount,
        reason: notes ? `${reason} - ${notes.trim()}` : reason,
        date: new Date().toISOString().split('T')[0],
      },
      submissionId.current,
    );

    if (!res.success) {
      setFormError(res.error || 'Failed to apply adjustment');
      showToast(res.error || 'Adjustment failed', 'error');
    } else {
      showToast(
        `Adjustment committed. Difference of ${difference > 0 ? `+${difference}` : difference} recorded in ledger.`,
        'success',
      );
      setIsDrawerOpen(false);
    }
  };

  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      if (selectedWarehouseId !== 'all' && adj.locationId !== selectedWarehouseId) {
        return false;
      }

      const matchesSearch =
        searchTerm === '' ||
        adj.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        [adj.productName, adj.sku].some((value) => value.toLowerCase().includes(searchTerm.toLowerCase())) ||
        adj.reason.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesReason = reasonFilter === 'all' || adj.reason.includes(reasonFilter);

      return matchesSearch && matchesReason;
    });
  }, [adjustments, searchTerm, reasonFilter, selectedWarehouseId]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Adjustments</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {isStaff
              ? `Reconcile physical stock counts at ${assignedWarehouse} against system records.`
              : 'Reconcile physical inventory counts against system records with audit justifications.'}
          </p>
        </div>

        <button
          onClick={handleOpenDrawer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New adjustment</span>
        </button>
      </div>

      {/* 2. Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by reference, product, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All reason categories</option>
            <option value="Discrepancy">Count discrepancy</option>
            <option value="Damaged">Damaged goods</option>
            <option value="Expired">Expired product</option>
            <option value="Found">Found stock</option>
            <option value="Internal">Internal use</option>
          </select>
        </div>
      </div>

      {/* 3. Adjustments Table */}
      <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
              <th className="py-2.5 px-3 font-medium">Reference</th>
              <th className="py-2.5 px-3 font-medium">Date</th>
              <th className="py-2.5 px-3 font-medium">Product</th>
              <th className="py-2.5 px-3 font-medium">Location</th>
              <th className="py-2.5 px-3 font-medium text-right">System count</th>
              <th className="py-2.5 px-3 font-medium text-right">Physical count</th>
              <th className="py-2.5 px-3 font-medium text-right">Difference</th>
              <th className="py-2.5 px-3 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredAdjustments.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-xs text-[var(--text-secondary)]">
                  No adjustments found matching current filters.
                </td>
              </tr>
            ) : (
              filteredAdjustments.map((adj) => {
                const locName = getLocationName(adj.locationId);
                const isPositive = adj.difference > 0;

                return (
                  <tr key={adj.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[var(--text)] font-medium">{adj.id}</td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">{adj.date}</td>
                    <td className="py-2.5 px-3 font-medium text-[var(--text)]">{adj.productName}</td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">{locName}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] font-mono">
                      {adj.systemQuantity}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-[var(--text)] font-mono">
                      {adj.physicalCount}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-medium font-mono ${
                        isPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                      }`}
                    >
                      {isPositive ? `+${adj.difference}` : adj.difference} {adj.unit}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)] max-w-xs truncate">
                      {adj.reason}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--surface-secondary)] text-[11px] text-[var(--text-secondary)]">
          Showing {filteredAdjustments.length} of {adjustments.length} adjustment entries
          {isStaff ? ` (${assignedWarehouse})` : ''}
        </div>
      </div>

      {/* 4. NEW ADJUSTMENT SLIDE-OVER DRAWER */}
      <SlideOverDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="New adjustment"
        subtitle="Reconcile inventory count with system balance"
        width="lg"
      >
        <form onSubmit={handleApplyAdjustment} className="space-y-4 text-xs">
          {formError && (
            <div className="p-2.5 bg-[var(--danger-subtle)] text-[var(--danger)] rounded border border-[var(--danger)]/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="adjustments-field-0" className="text-[var(--text-secondary)] font-medium">
              Select product *
            </label>
            <select
              id="adjustments-field-0"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="adjustments-field-1" className="text-[var(--text-secondary)] font-medium">
              Location *
            </label>
            <select
              id="adjustments-field-1"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
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

          <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--surface-secondary)] rounded border border-[var(--border-subtle)]">
            <div>
              <div className="text-[11px] text-[var(--text-secondary)]">System count</div>
              <div className="text-base font-semibold text-[var(--text)] mt-0.5 font-mono">
                {currentSystemQty} <span className="text-xs font-normal">{activeProduct?.unit}</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="physical-count"
                className="text-[11px] text-[var(--text-secondary)] font-medium"
              >
                Physical count
              </label>
              <input
                id="physical-count"
                type="number"
                min="0"
                step="any"
                required
                value={physicalCount}
                onChange={(e) => setPhysicalCount(e.target.value)}
                className="w-full mt-0.5 px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] font-mono font-medium focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <div className="text-[11px] text-[var(--text-secondary)]">Difference</div>
              <div
                className={`text-base font-semibold mt-1 font-mono ${
                  difference > 0
                    ? 'text-[var(--success)]'
                    : difference < 0
                      ? 'text-[var(--danger)]'
                      : 'text-[var(--text-secondary)]'
                }`}
              >
                {difference > 0 ? `+${difference}` : difference} {activeProduct?.unit}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="adjustments-field-2" className="text-[var(--text-secondary)] font-medium">
              Reason *
            </label>
            <select
              id="adjustments-field-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="Inventory Count Discrepancy">Physical count discrepancy</option>
              <option value="Damaged Goods">Damaged / defective stock</option>
              <option value="Expired Product">Expired / obsolete stock</option>
              <option value="Found Unrecorded Stock">Found unrecorded stock</option>
              <option value="Internal Use">Internal consumption / testing</option>
              <option value="Other Discrepancy">Other</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="adjustments-field-3" className="text-[var(--text-secondary)] font-medium">
              Notes (optional)
            </label>
            <input
              id="adjustments-field-3"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Recounted during weekly cycle audit."
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded text-[var(--text)] hover:bg-[var(--surface-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={difference === 0}
              className="px-3.5 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded disabled:opacity-40"
            >
              Apply adjustment
            </button>
          </div>
        </form>
      </SlideOverDrawer>
    </div>
  );
};
