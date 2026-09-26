import React, { useState } from 'react';
import {
  Boxes,
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ClipboardCheck,
  BookOpen,
  Settings,
  Search,
  Sun,
  Moon,
  LogOut,
  Bell,
  X,
  ChevronDown,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useTheme } from '../../context/ThemeContext';
import { inWarehouse, productInWarehouse, stockAt } from '../../domain/selectors';
export type NavPage =
  | 'dashboard'
  | 'products'
  | 'receipts'
  | 'deliveries'
  | 'transfers'
  | 'adjustments'
  | 'ledger'
  | 'settings'
  | 'profile';
export const navigation = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { id: 'products', label: 'Products', icon: Package, group: 'Workspace' },
  { id: 'receipts', label: 'Receipts', icon: ArrowDownToLine, group: 'Operations' },
  { id: 'deliveries', label: 'Deliveries', icon: ArrowUpFromLine, group: 'Operations' },
  { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight, group: 'Operations' },
  { id: 'adjustments', label: 'Stock counts', icon: ClipboardCheck, group: 'Operations' },
  { id: 'ledger', label: 'Stock ledger', icon: BookOpen, group: 'Control' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'Control' },
] as const;
interface Props {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
}
export const TopNavigation: React.FC<Props> = ({ currentPage, onNavigate }) => {
  const {
    locations,
    selectedWarehouseId,
    setSelectedWarehouseId,
    currentUser,
    logout,
    products,
    receipts,
    deliveries,
    isStaff,
    assignedWarehouse,
    can,
  } = useInventory();
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [alertsOpen, setAlertsOpen] = useState(false);
  const links = navigation.filter((link) => link.id !== 'settings' || can('settings'));
  const scopedProducts = products.filter((p) => productInWarehouse(p, selectedWarehouseId));
  const low = scopedProducts.filter((p) => stockAt(p, selectedWarehouseId) <= p.reorderLevel).length;
  const inbound = receipts.filter(
    (r) => inWarehouse(r.warehouseId, selectedWarehouseId) && !['Done', 'Canceled'].includes(r.status),
  ).length;
  const outbound = deliveries.filter(
    (d) => inWarehouse(d.warehouseId, selectedWarehouseId) && !['Done', 'Canceled'].includes(d.status),
  ).length;
  const results = scopedProducts
    .filter((p) =>
      [p.name, p.sku, p.category].some((value) => value.toLowerCase().includes(query.trim().toLowerCase())),
    )
    .slice(0, 6);
  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setAlertsOpen(false);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  return (
    <>
      <aside className="sidebar">
        <button className="brand" onClick={() => onNavigate('dashboard')} aria-label="StockSense overview">
          <span className="brand-mark">
            <Boxes size={20} />
          </span>
          <span>
            StockSense<small>INVENTORY OPERATIONS</small>
          </span>
        </button>
        <div className="workspace-label">
          <span className="status-dot" /> DEMO WORKSPACE <span className="ml-auto font-mono">01</span>
        </div>
        <nav aria-label="Main navigation" className="side-links">
          {['Workspace', 'Operations', 'Control'].map((group) => (
            <div key={group} className="nav-group">
              <div className="eyebrow">{group}</div>
              {links
                .filter((link) => link.group === group)
                .map((link) => (
                  <button
                    key={link.id}
                    onClick={() => onNavigate(link.id)}
                    className={'nav-link ' + (currentPage === link.id ? 'active' : '')}
                    aria-current={currentPage === link.id ? 'page' : undefined}
                  >
                    <link.icon size={16} />
                    <span>{link.label}</span>
                    {currentPage === link.id && <span className="nav-marker" />}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="eyebrow">Account / {isStaff ? 'Warehouse staff' : 'Management'}</div>
          <button className="account-button" onClick={() => onNavigate('profile')}>
            <span className="avatar">{currentUser?.name.slice(0, 1)}</span>
            <span>
              <strong>{currentUser?.name}</strong>
              <small>{isStaff ? assignedWarehouse : 'All facilities'}</small>
            </span>
            <ChevronDown size={14} />
          </button>
          <button className="signout-link" onClick={logout}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>
      <header className="topbar">
        <div className="topbar-row">
          <div className="breadcrumb">
            <span className="desktop-only">Operations</span>
            <span className="desktop-only">/</span>
            <strong>{links.find((link) => link.id === currentPage)?.label ?? 'Profile'}</strong>
          </div>
          <div className="topbar-controls">
            {isStaff ? (
              <span className="warehouse-chip">
                <span className="status-dot" />
                {assignedWarehouse}
              </span>
            ) : (
              <label className="warehouse-control">
                <span>Facility</span>
                <select
                  aria-label="Active warehouse"
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                >
                  <option value="all">All warehouses</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="icon-button"
              aria-label="Search products"
              title="Search products (Ctrl+K)"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={17} />
            </button>
            <div className="relative">
              <button
                className="icon-button"
                aria-label="Operational alerts"
                aria-expanded={alertsOpen}
                onClick={() => setAlertsOpen(!alertsOpen)}
              >
                <Bell size={17} />
                {low + inbound + outbound > 0 && <span className="notification-dot" />}
              </button>
              {alertsOpen && (
                <div className="alerts-popover">
                  <div className="eyebrow mb-3">Requires attention</div>
                  {[
                    [low, 'products at or below reorder', 'products'],
                    [inbound, 'open inbound receipts', 'receipts'],
                    [outbound, 'open dispatch orders', 'deliveries'],
                  ].map(([count, label, page]) => (
                    <button
                      key={page}
                      onClick={() => {
                        onNavigate(page as NavPage);
                        setAlertsOpen(false);
                      }}
                    >
                      <strong>{count}</strong>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="icon-button"
              aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button className="avatar mobile-only" aria-label="Profile" onClick={() => onNavigate('profile')}>
              {currentUser?.name.slice(0, 1)}
            </button>
          </div>
        </div>
        <nav className="mobile-navigation" aria-label="Mobile navigation">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              className={currentPage === link.id ? 'active' : ''}
            >
              <link.icon size={14} />
              {link.label}
            </button>
          ))}
        </nav>
      </header>
      {searchOpen && (
        <div className="search-backdrop" onClick={() => setSearchOpen(false)}>
          <section
            className="search-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Product search"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-heading">
              <Search size={18} />
              <input
                autoFocus
                aria-label="Search products by name or SKU"
                placeholder="Find a product, SKU or category…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="icon-button" aria-label="Close search" onClick={() => setSearchOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="eyebrow px-4 py-3">Products in active facility scope</div>
            {results.length ? (
              results.map((product) => (
                <button
                  className="search-result"
                  key={product.id}
                  onClick={() => {
                    setSearchOpen(false);
                    onNavigate('products');
                  }}
                >
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.sku}</small>
                  </span>
                  <span className="font-mono">
                    {stockAt(product, selectedWarehouseId).toLocaleString()} {product.unit}
                  </span>
                </button>
              ))
            ) : (
              <p className="empty-state">No matching products in this facility.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
};
