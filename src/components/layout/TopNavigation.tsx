import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  Sun,
  Moon,
  ChevronDown,
  User,
  LogOut,
  Bell,
  Check,
  Lock,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useTheme } from '../../context/ThemeContext';

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

interface TopNavigationProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  onOpenSearch?: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  currentPage,
  onNavigate,
}) => {
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
    isManager,
    isAdmin,
    assignedWarehouse,
    assignedWarehouseId,
  } = useInventory();

  const { theme, toggleTheme } = useTheme();

  // Dropdown states
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  const [isOperationsOpen, setIsOperationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const warehouseRef = useRef<HTMLDivElement>(null);
  const operationsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (warehouseRef.current && !warehouseRef.current.contains(e.target as Node)) {
        setIsWarehouseOpen(false);
      }
      if (operationsRef.current && !operationsRef.current.contains(e.target as Node)) {
        setIsOperationsOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  // Selected warehouse display name
  const currentWarehouseName = useMemo(() => {
    if (isStaff) {
      return assignedWarehouse;
    }
    if (selectedWarehouseId === 'all') {
      return 'All Warehouses';
    }
    return locations.find((l) => l.id === selectedWarehouseId)?.name || 'Main Warehouse';
  }, [isStaff, assignedWarehouse, selectedWarehouseId, locations]);

  // Low stock and pending notifications (filtered for staff)
  const lowStockCount = useMemo(() => {
    if (isStaff) {
      return products.filter(
        (p) =>
          (p.locationStock[assignedWarehouseId] || 0) <= p.reorderLevel &&
          (p.locationStock[assignedWarehouseId] || 0) > 0
      ).length;
    }
    return products.filter((p) => p.stock <= p.reorderLevel).length;
  }, [products, isStaff, assignedWarehouseId]);

  const pendingReceipts = useMemo(() => {
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

  const pendingDeliveries = useMemo(() => {
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

  const totalAlerts = lowStockCount + pendingReceipts + pendingDeliveries;

  // Filtered search results (for staff, prioritizing assigned warehouse)
  const searchResults = searchQuery.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 6)
    : [];

  const isOperationsActive =
    currentPage === 'receipts' ||
    currentPage === 'deliveries' ||
    currentPage === 'transfers' ||
    currentPage === 'adjustments';

  const userName = currentUser?.name || 'User';
  const userRole = currentUser?.role || 'Guest';

  return (
    <header className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)] select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-13 flex items-center justify-between">
        {/* Left: Brand & Main Navigation */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 text-left"
          >
            <span className="text-sm font-semibold tracking-tight text-[var(--text)]">
              StockSense
            </span>
          </button>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`px-3 py-1.5 rounded transition-colors ${
                currentPage === 'dashboard'
                  ? 'text-[var(--text)] font-semibold bg-[var(--surface-secondary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => onNavigate('products')}
              className={`px-3 py-1.5 rounded transition-colors ${
                currentPage === 'products'
                  ? 'text-[var(--text)] font-semibold bg-[var(--surface-secondary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Products
            </button>

            {/* Operations Dropdown */}
            <div className="relative" ref={operationsRef}>
              <button
                onClick={() => setIsOperationsOpen(!isOperationsOpen)}
                className={`px-3 py-1.5 rounded flex items-center gap-1 transition-colors ${
                  isOperationsActive
                    ? 'text-[var(--text)] font-semibold bg-[var(--surface-secondary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                <span>Operations</span>
                <ChevronDown className="w-3 h-3 text-[var(--text-secondary)]" />
              </button>

              {isOperationsOpen && (
                <div className="absolute left-0 mt-1 w-44 bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-md py-1 z-50">
                  <button
                    onClick={() => {
                      onNavigate('receipts');
                      setIsOperationsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between ${
                      currentPage === 'receipts'
                        ? 'font-semibold text-[var(--text)] bg-[var(--surface-secondary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-secondary)]'
                    }`}
                  >
                    <span>Receipts</span>
                    {pendingReceipts > 0 && (
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {pendingReceipts} pending
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('deliveries');
                      setIsOperationsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between ${
                      currentPage === 'deliveries'
                        ? 'font-semibold text-[var(--text)] bg-[var(--surface-secondary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-secondary)]'
                    }`}
                  >
                    <span>Deliveries</span>
                    {pendingDeliveries > 0 && (
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {pendingDeliveries} ready
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('transfers');
                      setIsOperationsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs ${
                      currentPage === 'transfers'
                        ? 'font-semibold text-[var(--text)] bg-[var(--surface-secondary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-secondary)]'
                    }`}
                  >
                    Internal Transfers
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('adjustments');
                      setIsOperationsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs ${
                      currentPage === 'adjustments'
                        ? 'font-semibold text-[var(--text)] bg-[var(--surface-secondary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-secondary)]'
                    }`}
                  >
                    Adjustments
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => onNavigate('ledger')}
              className={`px-3 py-1.5 rounded transition-colors ${
                currentPage === 'ledger'
                  ? 'text-[var(--text)] font-semibold bg-[var(--surface-secondary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Ledger
            </button>

            {/* Settings link - Hidden for Warehouse Staff */}
            {!isStaff && (
              <button
                onClick={() => onNavigate('settings')}
                className={`px-3 py-1.5 rounded transition-colors ${
                  currentPage === 'settings'
                    ? 'text-[var(--text)] font-semibold bg-[var(--surface-secondary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                Settings
              </button>
            )}
          </nav>
        </div>

        {/* Right: Controls & User Profile */}
        <div className="flex items-center gap-3">
          {/* Warehouse Selector / Badge */}
          <div className="relative" ref={warehouseRef}>
            <button
              onClick={() => setIsWarehouseOpen(!isWarehouseOpen)}
              className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] px-2.5 py-1.5 rounded border border-[var(--border)] hover:bg-[var(--surface-secondary)] transition-colors"
            >
              <span className="text-[var(--text-secondary)]">Warehouse:</span>
              <span className="font-medium text-[var(--text)]">{currentWarehouseName}</span>
              {isStaff ? (
                <Lock className="w-3 h-3 text-[var(--text-secondary)] ml-0.5" />
              ) : (
                <ChevronDown className="w-3 h-3 text-[var(--text-secondary)] ml-0.5" />
              )}
            </button>

            {isWarehouseOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-md py-1 z-50">
                {isStaff ? (
                  <div className="px-3 py-2 text-xs space-y-1">
                    <div className="font-semibold text-[var(--text)] flex items-center gap-1">
                      <Lock className="w-3 h-3 text-[var(--text-secondary)]" />
                      <span>{assignedWarehouse}</span>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      Assigned operational facility for {userName}. Scoped to assigned warehouse.
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setSelectedWarehouseId('all');
                        setIsWarehouseOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                        selectedWarehouseId === 'all'
                          ? 'font-semibold text-[var(--accent)] bg-[var(--accent-subtle)]'
                          : 'text-[var(--text)] hover:bg-[var(--surface-secondary)]'
                      }`}
                    >
                      <span>All Warehouses</span>
                      {selectedWarehouseId === 'all' && <Check className="w-3 h-3" />}
                    </button>

                    <div className="my-1 border-t border-[var(--border-subtle)]" />

                    {locations.map((loc) => {
                      const isSelected = selectedWarehouseId === loc.id;
                      return (
                        <button
                          key={loc.id}
                          onClick={() => {
                            setSelectedWarehouseId(loc.id);
                            setIsWarehouseOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                            isSelected
                              ? 'font-semibold text-[var(--accent)] bg-[var(--accent-subtle)]'
                              : 'text-[var(--text)] hover:bg-[var(--surface-secondary)]'
                          }`}
                        >
                          <span>{loc.name}</span>
                          {isSelected && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Quick Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text)] rounded hover:bg-[var(--surface-secondary)] transition-colors"
            title="Search products (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text)] rounded hover:bg-[var(--surface-secondary)] transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {totalAlerts > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--danger)]" />
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-1 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-md p-3 z-50 text-xs space-y-2">
                <div className="font-semibold text-[var(--text)] pb-1 border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <span>Operational alerts</span>
                  <span className="text-[10px] text-[var(--text-secondary)] font-normal">
                    {totalAlerts} active
                  </span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {lowStockCount > 0 && (
                    <div
                      onClick={() => {
                        onNavigate('products');
                        setIsNotificationsOpen(false);
                      }}
                      className="p-2 bg-[var(--warning-subtle)] text-[var(--warning)] rounded cursor-pointer hover:opacity-90 flex items-center justify-between"
                    >
                      <span>{lowStockCount} items below reorder point</span>
                      <span className="font-medium underline text-[11px]">View</span>
                    </div>
                  )}

                  {pendingReceipts > 0 && (
                    <div
                      onClick={() => {
                        onNavigate('receipts');
                        setIsNotificationsOpen(false);
                      }}
                      className="p-2 bg-[var(--surface-secondary)] text-[var(--text)] rounded cursor-pointer hover:bg-[var(--border-subtle)] flex items-center justify-between"
                    >
                      <span>{pendingReceipts} inbound receipts waiting</span>
                      <span className="text-[var(--accent)] underline text-[11px]">Review</span>
                    </div>
                  )}

                  {pendingDeliveries > 0 && (
                    <div
                      onClick={() => {
                        onNavigate('deliveries');
                        setIsNotificationsOpen(false);
                      }}
                      className="p-2 bg-[var(--surface-secondary)] text-[var(--text)] rounded cursor-pointer hover:bg-[var(--border-subtle)] flex items-center justify-between"
                    >
                      <span>{pendingDeliveries} dispatch orders ready</span>
                      <span className="text-[var(--accent)] underline text-[11px]">Review</span>
                    </div>
                  )}

                  {totalAlerts === 0 && (
                    <p className="text-[var(--text-secondary)] text-center py-4">
                      No active operational alerts.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text)] rounded hover:bg-[var(--surface-secondary)] transition-colors"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* User Menu */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1 pl-2 rounded hover:bg-[var(--surface-secondary)] transition-colors text-xs text-[var(--text)]"
            >
              <span className="font-medium hidden sm:inline">{userName}</span>
              <div className="w-6 h-6 rounded bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-semibold">
                {userName.slice(0, 1)}
              </div>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-md py-1 z-50 text-xs">
                <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                  <div className="font-medium text-[var(--text)]">{userName}</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">{userRole}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] truncate">
                    {currentUser?.email}
                  </div>
                </div>

                <button
                  onClick={() => {
                    onNavigate('profile');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-secondary)]"
                >
                  Profile & Clearances
                </button>

                {/* Only Manager and Admin have Settings in dropdown */}
                {!isStaff && (
                  <button
                    onClick={() => {
                      onNavigate('settings');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-secondary)]"
                  >
                    Settings & Warehouses
                  </button>
                )}

                <div className="my-1 border-t border-[var(--border-subtle)]" />

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-3 py-1.5 text-[var(--danger)] hover:bg-[var(--danger-subtle)] flex items-center justify-between"
                >
                  <span>Sign out</span>
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QUICK SEARCH DIALOG */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          <div
            className="fixed inset-0 bg-black/30 transition-opacity"
            onClick={() => setIsSearchOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-lg overflow-hidden z-10">
            <div className="p-3 border-b border-[var(--border-subtle)] flex items-center gap-2 bg-[var(--surface)]">
              <Search className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search products by SKU, name, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none"
              />
              <span className="text-[10px] text-[var(--text-secondary)] border border-[var(--border)] px-1.5 py-0.5 rounded">
                Esc
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto p-2 text-xs">
              {searchResults.length > 0 ? (
                searchResults.map((prod) => {
                  const stockDisplay = isStaff
                    ? `${prod.locationStock[assignedWarehouseId] || 0} ${prod.unit}`
                    : `${prod.stock} ${prod.unit}`;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => {
                        setIsSearchOpen(false);
                        onNavigate('products');
                      }}
                      className="p-2 rounded hover:bg-[var(--surface-secondary)] cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-[var(--text)]">{prod.name}</span>
                        <span className="text-[10px] text-[var(--text-secondary)] ml-2 font-mono">
                          {prod.sku}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {stockDisplay}
                      </span>
                    </div>
                  );
                })
              ) : searchQuery ? (
                <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
                  No matching products found.
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
                  Type a product name or SKU to inspect stock levels.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
