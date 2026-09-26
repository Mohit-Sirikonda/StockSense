import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { AppLayout } from './components/layout/AppLayout';
import { NavPage } from './components/layout/TopNavigation';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Receipts } from './pages/Receipts';
import { Deliveries } from './pages/Deliveries';
import { Transfers } from './pages/Transfers';
import { Adjustments } from './pages/Adjustments';
import { Ledger } from './pages/Ledger';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { ToastContainer } from './components/ui/ToastContainer';
import { ConfirmDialog } from './components/ui/ConfirmDialog';

const AppContent: React.FC = () => {
  const { isAuthenticated, currentUser, loadError, retryLoad, resetDemoData, can } = useInventory();
  const canAccessSettings = can('settings');
  const { showToast } = useToast();
  const [currentPage, setCurrentPage] = useState<NavPage>('dashboard');
  const [resetOpen, setResetOpen] = useState(false);

  // Role-based route protection: Warehouse Staff cannot access Settings
  useEffect(() => {
    if (isAuthenticated && !canAccessSettings && currentPage === 'settings') {
      setCurrentPage('dashboard');
      showToast('Access restricted: Settings are only accessible by Inventory Managers.', 'error');
    }
  }, [isAuthenticated, canAccessSettings, currentPage, showToast]);

  // If not authenticated or no active session, render Login view exclusively
  if (!isAuthenticated || !currentUser) {
    return <Login onSuccess={() => setCurrentPage('dashboard')} />;
  }

  if (loadError)
    return (
      <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
        <section className="recovery-panel">
          <div className="eyebrow">SAVED DATA NEEDS ATTENTION</div>
          <h1>Inventory could not be loaded.</h1>
          <div className="notice error" role="alert">
            {loadError}
          </div>
          <p className="my-5 text-sm text-[var(--text-secondary)]">
            Your saved data has been preserved. No stock commands are available until the data is restored. A
            demo reset replaces inventory only and keeps your account.
          </p>
          <div className="flex gap-3">
            <button className="secondary-button" onClick={retryLoad}>
              Retry loading
            </button>
            {can('reset') && (
              <button className="primary-button" onClick={() => setResetOpen(true)}>
                Reset demo inventory
              </button>
            )}
          </div>
        </section>
        <ConfirmDialog
          isOpen={resetOpen}
          onClose={() => setResetOpen(false)}
          title="Replace saved inventory?"
          message="This replaces the current inventory with the original demo dataset. This cannot be undone from the app. Your account details are preserved."
          confirmLabel="Replace inventory"
          variant="danger"
          onConfirm={() => {
            const result = resetDemoData();
            if (result.success) setResetOpen(false);
            else showToast(result.error, 'error');
          }}
        />
      </AppLayout>
    );

  // Guard against forbidden settings route
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'products':
        return <Products />;
      case 'receipts':
        return <Receipts />;
      case 'deliveries':
        return <Deliveries />;
      case 'transfers':
        return <Transfers />;
      case 'adjustments':
        return <Adjustments />;
      case 'ledger':
        return <Ledger />;
      case 'settings':
        if (!canAccessSettings) {
          return <Dashboard onNavigate={setCurrentPage} />;
        }
        return <Settings />;
      case 'profile':
        return <Profile />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderCurrentPage()}
    </AppLayout>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <AuthProvider>
          <InventoryProvider>
            <AppContent />
          </InventoryProvider>
        </AuthProvider>
        <ToastContainer />
      </ThemeProvider>
    </ToastProvider>
  );
}
