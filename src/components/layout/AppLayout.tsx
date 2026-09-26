import React from 'react';
import { TopNavigation, NavPage } from './TopNavigation';
import { ToastContainer } from '../ui/ToastContainer';

interface AppLayoutProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentPage,
  onNavigate,
  children,
}) => {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-sans transition-colors duration-150">
      {/* Editorial Top Navigation */}
      <TopNavigation currentPage={currentPage} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-[var(--border)] px-4 sm:px-6 py-3 text-xs text-[var(--text-secondary)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>StockSense Inventory Management</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Local reactive storage</span>
            <span>•</span>
            <span>Verified immutable ledger</span>
          </div>
        </div>
      </footer>

      <ToastContainer />
    </div>
  );
};
