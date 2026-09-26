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

const AppContent: React.FC = () => {
  const { isAuthenticated, currentUser, isStaff } = useInventory();
  const { showToast } = useToast();
  const [currentPage, setCurrentPage] = useState<NavPage>('dashboard');

  // Role-based route protection: Warehouse Staff cannot access Settings
  useEffect(() => {
    if (isAuthenticated && isStaff && currentPage === 'settings') {
      setCurrentPage('dashboard');
      showToast('Access restricted: Settings are only accessible by Inventory Managers.', 'error');
    }
  }, [isAuthenticated, isStaff, currentPage, showToast]);

  // If not authenticated or no active session, render Login view exclusively
  if (!isAuthenticated || !currentUser) {
    return <Login onSuccess={() => setCurrentPage('dashboard')} />;
  }

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
        if (isStaff) {
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
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <InventoryProvider>
            <AppContent />
          </InventoryProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
