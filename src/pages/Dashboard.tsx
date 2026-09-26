import React, { useMemo } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { NavPage } from '../components/layout/TopNavigation';
import { StatusBadge } from '../components/ui/StatusBadge';

interface DashboardProps {
  onNavigate: (page: NavPage) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const {
    products,
    locations,
    receipts,
    deliveries,
    transfers,
    ledger,
    selectedWarehouseId,
    currentUser,
    isStaff,
    assignedWarehouse,
    assignedWarehouseId,
  } = useInventory();

  // Metrics based on role & warehouse context
  const totalStockUnits = useMemo(() => {
    if (isStaff) {
      return products.reduce((acc, p) => acc + (p.locationStock[assignedWarehouseId] || 0), 0);
    }
    if (selectedWarehouseId === 'all') {
      return products.reduce((acc, p) => acc + p.stock, 0);
    }
    return products.reduce((acc, p) => acc + (p.locationStock[selectedWarehouseId] || 0), 0);
  }, [products, isStaff, assignedWarehouseId, selectedWarehouseId]);

  const lowStockItems = useMemo(() => {
    if (isStaff) {
      return products.filter((p) => {
        const qtyAtLoc = p.locationStock[assignedWarehouseId] || 0;
        return qtyAtLoc > 0 && qtyAtLoc <= p.reorderLevel;
      });
    }
    return products.filter((p) => p.stock > 0 && p.stock <= p.reorderLevel);
  }, [products, isStaff, assignedWarehouseId]);

  const outOfStockItems = useMemo(() => {
    if (isStaff) {
      return products.filter((p) => {
        const qtyAtLoc = p.locationStock[assignedWarehouseId] || 0;
        return qtyAtLoc === 0 && p.primaryLocationId === assignedWarehouseId;
      });
    }
    return products.filter((p) => p.stock === 0);
  }, [products, isStaff, assignedWarehouseId]);

  const pendingReceiptsCount = useMemo(() => {
    if (isStaff) {
      return receipts.filter(
        (r) =>
          r.warehouseId === assignedWarehouseId &&
          r.status !== 'Done' &&
          r.status !== 'Canceled'
      ).length;
    }
    return receipts.filter((r) => r.status !== 'Done' && r.status !== 'Canceled').length;
  }, [receipts, isStaff, assignedWarehouseId]);

  const readyDeliveriesCount = useMemo(() => {
    if (isStaff) {
      return deliveries.filter(
        (d) =>
          d.warehouseId === assignedWarehouseId &&
          d.status !== 'Done' &&
          d.status !== 'Canceled'
      ).length;
    }
    return deliveries.filter((d) => d.status !== 'Done' && d.status !== 'Canceled').length;
  }, [deliveries, isStaff, assignedWarehouseId]);

  const activeTransfersCount = useMemo(() => {
    if (isStaff) {
      return transfers.filter(
        (t) =>
          (t.fromLocationId === assignedWarehouseId || t.toLocationId === assignedWarehouseId) &&
          t.status !== 'Done' &&
          t.status !== 'Canceled'
      ).length;
    }
    return transfers.filter((t) => t.status !== 'Done' && t.status !== 'Canceled').length;
  }, [transfers, isStaff, assignedWarehouseId]);

  // Stock requiring attention
  const attentionItems = useMemo(() => {
    const list = isStaff
      ? products.filter((p) => {
          const qty = p.locationStock[assignedWarehouseId] || 0;
          return qty <= p.reorderLevel && (qty > 0 || p.primaryLocationId === assignedWarehouseId);
        })
      : products.filter((p) => p.stock <= p.reorderLevel);

    return list
      .sort((a, b) => {
        const stockA = isStaff ? a.locationStock[assignedWarehouseId] || 0 : a.stock;
        const stockB = isStaff ? b.locationStock[assignedWarehouseId] || 0 : b.stock;
        if (stockA === 0 && stockB > 0) return -1;
        if (stockB === 0 && stockA > 0) return 1;
        return stockA - stockB;
      })
      .slice(0, 6);
  }, [products, isStaff, assignedWarehouseId]);

  // Recent activity: filter to assigned warehouse for staff
  const recentActivity = useMemo(() => {
    if (isStaff) {
      return ledger
        .filter((entry) => {
          return Boolean(
            entry.fromLocationId === assignedWarehouseId ||
            entry.toLocationId === assignedWarehouseId ||
            (entry.fromLocationName &&
              entry.fromLocationName.toLowerCase().includes(assignedWarehouse.toLowerCase())) ||
            (entry.toLocationName &&
              entry.toLocationName.toLowerCase().includes(assignedWarehouse.toLowerCase()))
          );
        })
        .slice(0, 8);
    }
    return ledger.slice(0, 8);
  }, [ledger, isStaff, assignedWarehouseId, assignedWarehouse]);

  return (
    <div className="space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">
            {isStaff ? `Inventory — ${assignedWarehouse}` : 'Inventory'}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {isStaff
              ? `Operational visibility for ${assignedWarehouse} · Logged in as ${currentUser?.name} (${currentUser?.role})`
              : 'Real-time visibility across stock, movement and warehouse operations.'}
          </p>
        </div>

        {isStaff && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-secondary)] self-start sm:self-auto">
            <Lock className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="font-medium text-[var(--text)]">Assigned:</span>
            <span>{assignedWarehouse}</span>
          </div>
        )}
      </div>

      {/* 2. Operational Summary - Horizontal band */}
      <div className="py-4 border-y border-[var(--border)] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
        <div>
          <div className="text-xs text-[var(--text-secondary)]">
            {isStaff ? 'Available stock' : 'Total stock'}
          </div>
          <div className="text-xl font-semibold text-[var(--text)] mt-1">
            {totalStockUnits.toLocaleString()}{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">units</span>
          </div>
        </div>

        <div className="sm:border-l border-[var(--border-subtle)] sm:pl-6">
          <div className="text-xs text-[var(--text-secondary)]">Low stock</div>
          <div className="text-xl font-semibold text-[var(--warning)] mt-1">
            {lowStockItems.length}{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">items</span>
          </div>
        </div>

        <div className="lg:border-l border-[var(--border-subtle)] lg:pl-6">
          <div className="text-xs text-[var(--text-secondary)]">
            {isStaff ? 'Zero stock' : 'Out of stock'}
          </div>
          <div className="text-xl font-semibold text-[var(--danger)] mt-1">
            {outOfStockItems.length}{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">items</span>
          </div>
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] sm:pl-6 pt-4 sm:pt-0">
          <div className="text-xs text-[var(--text-secondary)]">
            {isStaff ? "Today's receipts" : 'Pending receipts'}
          </div>
          <div className="text-xl font-semibold text-[var(--text)] mt-1">
            {pendingReceiptsCount}{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">orders</span>
          </div>
        </div>

        <div className="border-t sm:border-t-0 lg:border-l border-[var(--border-subtle)] lg:pl-6 pt-4 sm:pt-0">
          <div className="text-xs text-[var(--text-secondary)]">
            {isStaff ? "Today's deliveries" : 'Ready deliveries'}
          </div>
          <div className="text-xl font-semibold text-[var(--text)] mt-1">
            {readyDeliveriesCount}{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">shipments</span>
          </div>
        </div>

        <div className="border-t sm:border-t-0 border-[var(--border-subtle)] lg:border-l lg:pl-6 pt-4 sm:pt-0">
          <div className="text-xs text-[var(--text-secondary)]">
            {isStaff ? 'Pending transfers' : 'Active transfers'}
          </div>
          <div className="text-xl font-semibold text-[var(--text)] mt-1">
            {activeTransfersCount}{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">
              {isStaff ? 'transfers' : 'in transit'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Grid: Attention Items & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section: Stock requiring attention */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text)]">Stock requiring attention</h2>
            <button
              onClick={() => onNavigate('products')}
              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              <span>{isStaff ? 'View floor products' : 'View all products'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-hidden">
            {attentionItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                All inventory items are currently above safe reorder thresholds.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                    <th className="py-2.5 px-3 font-medium">Product</th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      {isStaff ? 'At facility' : 'Current'}
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right">Reorder level</th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                    <th className="py-2.5 px-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {attentionItems.map((prod) => {
                    const displayedStock = isStaff
                      ? prod.locationStock[assignedWarehouseId] || 0
                      : prod.stock;
                    const isOut = displayedStock === 0;

                    return (
                      <tr key={prod.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-[var(--text)]">{prod.name}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] font-mono">{prod.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          {displayedStock} <span className="text-[10px] text-[var(--text-secondary)]">{prod.unit}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                          {prod.reorderLevel} {prod.unit}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={isOut ? 'Out of stock' : 'Low stock'} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => onNavigate('receipts')}
                            className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                          >
                            Receive stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Section: Recent activity */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text)]">Recent activity</h2>
            <button
              onClick={() => onNavigate('ledger')}
              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              <span>{isStaff ? 'View floor ledger' : 'View full ledger'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-hidden">
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                No recent activity recorded for {isStaff ? assignedWarehouse : 'inventory'}.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                    <th className="py-2.5 px-3 font-medium">Time</th>
                    <th className="py-2.5 px-3 font-medium">Operation</th>
                    <th className="py-2.5 px-3 font-medium">Product</th>
                    <th className="py-2.5 px-3 font-medium text-right">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {recentActivity.map((entry) => {
                    const timeOnly = entry.timestamp.includes('T')
                      ? entry.timestamp.split('T')[1].slice(0, 5)
                      : entry.timestamp.slice(11, 16);
                    const isPositive = entry.quantityChange > 0;

                    return (
                      <tr key={entry.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                        <td className="py-2.5 px-3 text-[var(--text-secondary)] font-mono text-[11px]">
                          {timeOnly}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-[var(--text)]">{entry.operationType}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[var(--text)]">{entry.productName}</span>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-medium font-mono ${
                            isPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                          }`}
                        >
                          {isPositive ? `+${entry.quantityChange}` : entry.quantityChange} {entry.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* 4. Warehouse overview section - ONLY for Inventory Manager & Administrator */}
      {!isStaff && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text)]">Warehouse overview</h2>
            <span className="text-xs text-[var(--text-secondary)]">
              {locations.length} active locations
            </span>
          </div>

          <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                  <th className="py-2.5 px-4 font-medium">Location</th>
                  <th className="py-2.5 px-4 font-medium">Code</th>
                  <th className="py-2.5 px-4 font-medium text-right">Stock on hand</th>
                  <th className="py-2.5 px-4 font-medium text-right">Share of inventory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {locations.map((loc) => {
                  const stockAtLoc = products.reduce(
                    (sum, p) => sum + (p.locationStock[loc.id] || 0),
                    0
                  );
                  const globalTotal = products.reduce((sum, p) => sum + p.stock, 0);
                  const sharePercent =
                    globalTotal > 0 ? Math.round((stockAtLoc / globalTotal) * 100) : 0;

                  return (
                    <tr key={loc.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-[var(--text)]">{loc.name}</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {loc.description || 'Facility'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-secondary)]">{loc.code}</td>
                      <td className="py-3 px-4 text-right font-medium text-[var(--text)]">
                        {stockAtLoc.toLocaleString()}{' '}
                        <span className="text-[10px] text-[var(--text-secondary)] font-normal">units</span>
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--text-secondary)]">
                        {sharePercent}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
