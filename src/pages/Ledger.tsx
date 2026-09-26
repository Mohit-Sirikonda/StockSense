import React, { useState, useMemo } from 'react';
import {
  Download,
  Search,
  Lock,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';

export const Ledger: React.FC = () => {
  const {
    ledger,
    locations,
    selectedWarehouseId,
    getLocationName,
    isStaff,
    assignedWarehouse,
    assignedWarehouseId,
  } = useInventory();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [operationFilter, setOperationFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>(
    isStaff ? assignedWarehouseId : selectedWarehouseId || 'all'
  );

  React.useEffect(() => {
    if (isStaff) {
      setWarehouseFilter(assignedWarehouseId);
    } else if (selectedWarehouseId !== 'all') {
      setWarehouseFilter(selectedWarehouseId);
    }
  }, [isStaff, assignedWarehouseId, selectedWarehouseId]);

  const filteredLedger = useMemo(() => {
    return ledger.filter((entry) => {
      const matchesSearch =
        searchTerm === '' ||
        entry.referenceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.user.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesOp = operationFilter === 'all' || entry.operationType === operationFilter;

      let matchesWarehouse = true;
      if (isStaff) {
        // Warehouse Staff can ONLY see ledger entries involving their assigned warehouse
        const assignedLower = assignedWarehouse.toLowerCase();
        matchesWarehouse = Boolean(
          entry.fromLocationId === assignedWarehouseId ||
          entry.toLocationId === assignedWarehouseId ||
          (entry.fromLocationName && entry.fromLocationName.toLowerCase().includes(assignedLower)) ||
          (entry.toLocationName && entry.toLocationName.toLowerCase().includes(assignedLower))
        );
      } else if (warehouseFilter !== 'all') {
        const locName = getLocationName(warehouseFilter).toLowerCase();
        matchesWarehouse = Boolean(
          (entry.fromLocationName && entry.fromLocationName.toLowerCase().includes(locName)) ||
          (entry.toLocationName && entry.toLocationName.toLowerCase().includes(locName)) ||
          entry.fromLocationId === warehouseFilter ||
          entry.toLocationId === warehouseFilter
        );
      }

      return matchesSearch && matchesOp && matchesWarehouse;
    });
  }, [ledger, searchTerm, operationFilter, warehouseFilter, isStaff, assignedWarehouse, assignedWarehouseId, getLocationName]);

  const handleExportCSV = () => {
    if (filteredLedger.length === 0) {
      showToast('No ledger entries available to export.', 'warning');
      return;
    }

    const headers = [
      'Timestamp',
      'Reference',
      'Operation',
      'SKU',
      'Product',
      'Unit',
      'From Location',
      'To Location',
      'Quantity Change',
      'User',
      'Notes',
    ];

    const rows = filteredLedger.map((e) => [
      `"${e.timestamp}"`,
      `"${e.referenceId}"`,
      `"${e.operationType}"`,
      `"${e.sku}"`,
      `"${e.productName.replace(/"/g, '""')}"`,
      `"${e.unit}"`,
      `"${e.fromLocationName || ''}"`,
      `"${e.toLocationName || ''}"`,
      e.quantityChange,
      `"${e.user}"`,
      `"${(e.reasonNotes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `stocksense_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${filteredLedger.length} ledger rows to CSV.`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Stock Ledger</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {isStaff
              ? `Audit trail of inventory movements involving ${assignedWarehouse}.`
              : 'Immutable audit record of every inventory receipt, transfer, dispatch, and adjustment across all facilities.'}
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-[var(--text)] text-xs font-medium transition-colors self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* 2. Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search reference, SKU, or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <select
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All operations</option>
            <option value="Receipt">Receipts</option>
            <option value="Delivery">Deliveries</option>
            <option value="Transfer">Internal Transfers</option>
            <option value="Adjustment">Adjustments</option>
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
              <option value="all">All warehouse locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 3. Dense Audit Table */}
      <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
              <th className="py-2.5 px-3 font-medium">Timestamp</th>
              <th className="py-2.5 px-3 font-medium">Reference</th>
              <th className="py-2.5 px-3 font-medium">Operation</th>
              <th className="py-2.5 px-3 font-medium">Product</th>
              <th className="py-2.5 px-3 font-medium">Location</th>
              <th className="py-2.5 px-3 font-medium text-right">Change</th>
              <th className="py-2.5 px-3 font-medium">User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredLedger.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-xs text-[var(--text-secondary)]">
                  No ledger entries match current filters.
                </td>
              </tr>
            ) : (
              filteredLedger.map((entry) => {
                const isPositive = entry.quantityChange > 0;
                const formattedTime = entry.timestamp.includes('T')
                  ? `${entry.timestamp.split('T')[0]} ${entry.timestamp.split('T')[1].slice(0, 8)}`
                  : entry.timestamp;

                return (
                  <tr key={entry.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="py-2.5 px-3 text-[var(--text-secondary)] font-mono text-[11px] whitespace-nowrap">
                      {formattedTime}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-[var(--text)]">
                      {entry.referenceId}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text)]">{entry.operationType}</td>
                    <td className="py-2.5 px-3 text-[var(--text)]">
                      <span className="font-medium">{entry.productName}</span>
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono ml-1.5">
                        {entry.sku}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                      {entry.toLocationName ? (
                        <span>
                          {entry.fromLocationName || 'Vendor'} → {entry.toLocationName}
                        </span>
                      ) : (
                        <span>{entry.fromLocationName || 'Main Warehouse'}</span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-medium font-mono whitespace-nowrap ${
                        isPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                      }`}
                    >
                      {isPositive ? `+${entry.quantityChange}` : entry.quantityChange} {entry.unit}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)] whitespace-nowrap">
                      {entry.user}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--surface-secondary)] text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
          <span>Showing {filteredLedger.length} of {ledger.length} events</span>
          <span>Verified immutable ledger</span>
        </div>
      </div>
    </div>
  );
};
