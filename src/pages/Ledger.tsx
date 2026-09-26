import React, { useState } from 'react';
import { Download, Search, BookOpen } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { movementInWarehouse, ledgerMovement } from '../domain/selectors';
import { serializeCSV } from '../utils/csv';

export const Ledger: React.FC = () => {
  const { ledger, locations, selectedWarehouseId, setSelectedWarehouseId, isStaff, getLocationName } =
    useInventory();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState(''),
    [operationFilter, setOperationFilter] = useState('all');
  const filtered = ledger.filter(
    (entry) =>
      movementInWarehouse(entry.fromLocationId, entry.toLocationId, selectedWarehouseId) &&
      (operationFilter === 'all' || entry.operationType === operationFilter) &&
      [entry.referenceId, entry.productName, entry.sku, entry.user].some((value) =>
        value.toLowerCase().includes(searchTerm.trim().toLowerCase()),
      ),
  );
  function exportCSV() {
    if (!filtered.length) {
      showToast('No matching ledger entries to export.', 'warning');
      return;
    }
    const rows: unknown[][] = [
      [
        'Timestamp (UTC)',
        'Reference',
        'Operation',
        'SKU',
        'Product',
        'Unit',
        'From location',
        'To location',
        'Recorded quantity',
        'Scoped movement',
        'User ID',
        'Recorded by',
        'Notes',
      ],
    ];
    for (const entry of filtered)
      rows.push([
        entry.timestamp,
        entry.referenceId,
        entry.operationType,
        entry.sku,
        entry.productName,
        entry.unit,
        entry.fromLocationName,
        entry.toLocationName,
        entry.quantityChange,
        ledgerMovement(entry, selectedWarehouseId).text,
        entry.userId,
        entry.user,
        entry.reasonNotes,
      ]);
    const url = URL.createObjectURL(new Blob([serializeCSV(rows)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stocksense_ledger_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Exported ${filtered.length} ledger entries.`, 'success');
  }
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <div className="eyebrow mb-2">MOVEMENT REGISTER</div>
          <h1>
            Stock ledger<span className="heading-period">.</span>
          </h1>
          <p>The recorded history of receipts, dispatches, transfers, and physical counts.</p>
        </div>
        <button className="secondary-button" onClick={exportCSV}>
          <Download size={15} />
          Export CSV
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="relative">
          <Search size={14} className="absolute left-3 top-3 text-[var(--text-secondary)]" />
          <input
            aria-label="Search ledger"
            className="w-full pl-9 pr-3 border border-[var(--border)] bg-[var(--surface)]"
            placeholder="Reference, SKU, product or person…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter operation type"
          className="border border-[var(--border)] bg-[var(--surface)] px-3"
          value={operationFilter}
          onChange={(e) => setOperationFilter(e.target.value)}
        >
          <option value="all">All operation types</option>
          {['Receipt', 'Delivery', 'Transfer', 'Adjustment'].map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
        <select
          aria-label="Ledger warehouse"
          className="border border-[var(--border)] bg-[var(--surface)] px-3"
          value={selectedWarehouseId}
          onChange={(e) => setSelectedWarehouseId(e.target.value)}
          disabled={isStaff}
        >
          {!isStaff && <option value="all">All warehouses</option>}
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </div>
      <div className="data-panel">
        <table>
          <thead>
            <tr>
              <th>Recorded / local time</th>
              <th>Reference</th>
              <th>Operation</th>
              <th>Product</th>
              <th>Route / location</th>
              <th className="text-right">Movement</th>
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const movement = ledgerMovement(entry, selectedWarehouseId);
              return (
                <tr key={entry.id}>
                  <td className="font-mono whitespace-nowrap text-[var(--text-secondary)]">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="font-mono whitespace-nowrap">{entry.referenceId}</td>
                  <td>{entry.operationType}</td>
                  <td>
                    <strong className="font-medium">{entry.productName}</strong>
                    <small className="table-subtext font-mono">{entry.sku}</small>
                  </td>
                  <td className="text-[var(--text-secondary)]">
                    {entry.fromLocationName && entry.toLocationName ? (
                      <>
                        {entry.fromLocationName}
                        <span className="mx-1">→</span>
                        {entry.toLocationName}
                      </>
                    ) : (
                      (entry.toLocationName ?? entry.fromLocationName ?? '—')
                    )}
                  </td>
                  <td className={'text-right font-mono whitespace-nowrap movement-' + movement.tone}>
                    {movement.text}
                  </td>
                  <td title={entry.userId ?? 'Historical name snapshot'}>{entry.user}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="empty-state">
            <BookOpen size={26} />
            <strong>No matching movements</strong>
            <span>Try another reference, operation type, or warehouse.</span>
          </div>
        )}
        <div className="table-footnote">
          <span>
            {filtered.length} entries · {getLocationName(selectedWarehouseId)}
          </span>
          <span>Newest first · Historical snapshots preserved</span>
        </div>
      </div>
      <div className="notice">
        Transfers relocate stock: company-wide movement is neutral; a facility view shows stock moving in or
        out. Export includes the original recorded quantity and the movement for this view.
      </div>
    </div>
  );
};
