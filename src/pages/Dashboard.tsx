import React, { useState } from 'react';
import { selectDashboard } from '../domain/dashboard';
import type { OperationStatus, OperationType } from '../types';
import {
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import type { NavPage } from '../components/layout/TopNavigation';
import { StatusBadge } from '../components/ui/StatusBadge';
import { inWarehouse, stockAt, ledgerMovement, quantitySummary } from '../domain/selectors';
export const Dashboard: React.FC<{ onNavigate: (page: NavPage) => void }> = ({ onNavigate }) => {
  const {
    products,
    locations,
    receipts,
    deliveries,
    transfers,
    adjustments,
    setSelectedWarehouseId,
    isStaff,
    ledger,
    selectedWarehouseId: scope,
    getLocationName,
    can,
  } = useInventory();
  const [document, setDocument] = useState<OperationType | 'all'>('all');
  const [status, setStatus] = useState<OperationStatus | 'all'>('all');
  const [category, setCategory] = useState('all');
  const summary = selectDashboard(
    { products, receipts, deliveries, transfers, adjustments, ledger },
    { warehouse: scope, category, document, status },
  );
  const { products: scoped, attention } = summary;
  const activity = summary.activity.slice(0, 6);
  const icons = {
    Receipt: ArrowDownToLine,
    Delivery: ArrowUpFromLine,
    Transfer: ArrowLeftRight,
    Adjustment: Package,
  };
  const queue = summary.documents.map((row) => ({ ...row, icon: icons[row.type] }));
  const categories = Array.from(new Set(products.map((product) => product.category))).sort();
  return (
    <div className="space-y-7">
      <div className="page-heading">
        <div>
          <div className="eyebrow mb-2">
            CONTROL ROOM{' '}
            <span className="section-index ml-2">
              / {scope === 'all' ? 'ALL FACILITIES' : getLocationName(scope).toUpperCase()}
            </span>
          </div>
          <h1>
            Inventory overview<span className="heading-period">.</span>
          </h1>
          <p>Stock that needs attention. Work ready to move.</p>
        </div>
        <button className="primary-button" onClick={() => onNavigate('receipts')}>
          <ArrowDownToLine size={15} />
          Receive stock
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" aria-label="Dashboard filters">
        <label className="field-label">
          Document type
          <select value={document} onChange={(e) => setDocument(e.target.value as OperationType | 'all')}>
            <option value="all">All documents</option>
            <option value="Receipt">Receipts</option>
            <option value="Delivery">Delivery</option>
            <option value="Transfer">Internal</option>
            <option value="Adjustment">Adjustments</option>
          </select>
        </label>
        <label className="field-label">
          Document status
          <select value={status} onChange={(e) => setStatus(e.target.value as OperationStatus | 'all')}>
            <option value="all">All statuses</option>
            {['Draft', 'Waiting', 'Ready', 'Done', 'Canceled'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Warehouse / location
          <select disabled={isStaff} value={scope} onChange={(e) => setSelectedWarehouseId(e.target.value)}>
            {!isStaff && <option value="all">All warehouses</option>}
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Product category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        Stock summaries show current balances. Document and status filters narrow them to products in matching
        documents. Pending counts exclude completed and canceled work.
      </p>
      <div className="metrics-band">
        {[
          {
            label: 'Products in stock',
            value: summary.inStock,
            note: 'distinct SKUs',
            icon: Package,
            page: 'products',
          },
          {
            label: 'Stock alerts',
            value: attention.length,
            note: attention.filter((p) => stockAt(p, scope) === 0).length + ' out of stock',
            icon: AlertTriangle,
            page: 'products',
          },
          {
            label: 'Open receipts',
            value: summary.pendingReceipts,
            note: 'awaiting receipt',
            icon: ArrowDownToLine,
            page: 'receipts',
          },
          {
            label: 'Open deliveries',
            value: summary.pendingDeliveries,
            note: 'awaiting dispatch',
            icon: ArrowUpFromLine,
            page: 'deliveries',
          },
          {
            label: 'Transfers scheduled',
            value: summary.scheduledTransfers,
            note: 'awaiting execution',
            icon: ArrowLeftRight,
            page: 'transfers',
          },
        ].map((metric, i) => (
          <button
            key={metric.label}
            className={'metric ' + (i === 1 && metric.value ? 'attention' : '')}
            onClick={() => onNavigate(metric.page as NavPage)}
          >
            <span className="metric-label">
              {metric.label}
              <metric.icon size={15} />
            </span>
            <span className="metric-value">{String(metric.value).padStart(2, '0')}</span>
            <span className="metric-note">
              {metric.note}
              <ArrowRight size={13} />
            </span>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <section>
          <div className="section-heading">
            <h2>
              <span className="section-number">01</span>Stock requiring attention
            </h2>
            <button className="text-link" onClick={() => onNavigate('products')}>
              All products <ArrowRight size={13} />
            </button>
          </div>
          <div className="data-panel">
            <table>
              <thead>
                <tr>
                  <th>Product / SKU</th>
                  <th className="text-right">Available</th>
                  <th className="text-right">Reorder</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attention.slice(0, 6).map((product) => (
                  <tr key={product.id}>
                    <td>
                      <button className="table-product" onClick={() => onNavigate('products')}>
                        <strong>{product.name}</strong>
                        <small>{product.sku}</small>
                      </button>
                    </td>
                    <td className="text-right tabular-nums font-medium">
                      {stockAt(product, scope)}{' '}
                      <span className="text-[var(--text-secondary)]">{product.unit}</span>
                    </td>
                    <td className="text-right font-mono">{product.reorderLevel}</td>
                    <td>
                      <StatusBadge status={stockAt(product, scope) === 0 ? 'Out of stock' : 'Low stock'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!attention.length && (
              <div className="empty-state">
                <Package size={24} />
                <strong>Stock is above reorder levels</strong>
                <span>No stock alerts in the selected facility.</span>
              </div>
            )}
            <div className="table-footnote">
              <span>{attention.length} products need review</span>
              <span>Measured in each product’s own unit</span>
            </div>
          </div>
        </section>
        <section>
          <div className="section-heading">
            <h2>
              <span className="section-number">02</span>Operations register
            </h2>
            <span className="eyebrow">{queue.length} MATCHING</span>
          </div>
          <div className="data-panel queue-list">
            {queue.length ? (
              queue.map((item) => (
                <button key={item.id} className="queue-row" onClick={() => onNavigate(item.page)}>
                  <span className="queue-icon">
                    <item.icon size={17} />
                  </span>
                  <span className="queue-detail">
                    <strong>{item.id}</strong>
                    <small>{item.partner}</small>
                  </span>
                  <StatusBadge status={item.status} />
                  <ArrowRight size={13} />
                </button>
              ))
            ) : (
              <div className="empty-state">
                <ClipboardEmpty />
                <strong>No matching operations</strong>
                <span>Change the document, status, category, or facility filters.</span>
              </div>
            )}
          </div>
        </section>
      </div>
      <section>
        <div className="section-heading">
          <h2>
            <span className="section-number">03</span>Latest movements
          </h2>
          <button className="text-link" onClick={() => onNavigate('ledger')}>
            Open stock ledger <ArrowRight size={13} />
          </button>
        </div>
        <div className="data-panel">
          <table>
            <thead>
              <tr>
                <th>Recorded</th>
                <th>Reference</th>
                <th>Operation</th>
                <th>Product</th>
                <th className="text-right">Movement</th>
                <th>Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((entry) => {
                const movement = ledgerMovement(entry, scope);
                return (
                  <tr key={entry.id}>
                    <td className="font-mono text-[var(--text-secondary)] whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="font-mono">{entry.referenceId}</td>
                    <td>{entry.operationType}</td>
                    <td>
                      <strong className="font-medium">{entry.productName}</strong>
                    </td>
                    <td className={'text-right font-mono movement-' + movement.tone}>{movement.text}</td>
                    <td className="text-[var(--text-secondary)]">{entry.user}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!activity.length && <div className="empty-state">No stock movements in this facility yet.</div>}
        </div>
      </section>
      {can('manageLocations') && (
        <section>
          <div className="section-heading">
            <h2>
              <span className="section-number">04</span>Facility register
            </h2>
            <span className="eyebrow">BALANCES BY UNIT</span>
          </div>
          <div className="data-panel">
            <table>
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Code</th>
                  <th className="text-right">Products stocked</th>
                  <th>Stock on hand</th>
                </tr>
              </thead>
              <tbody>
                {locations
                  .filter((location) => inWarehouse(location.id, scope))
                  .map((location) => (
                    <tr key={location.id}>
                      <td>
                        <strong className="font-medium">{location.name}</strong>
                        <small className="table-subtext">{location.description}</small>
                      </td>
                      <td className="font-mono text-[var(--text-secondary)]">{location.code}</td>
                      <td className="text-right font-mono">
                        {scoped.filter((p) => (p.locationStock[location.id] ?? 0) > 0).length}
                      </td>
                      <td className="font-mono">
                        {quantitySummary(
                          scoped
                            .filter((p) => (p.locationStock[location.id] ?? 0) > 0)
                            .map((p) => ({ quantity: p.locationStock[location.id], unit: p.unit })),
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
function ClipboardEmpty() {
  return <Package size={24} />;
}
