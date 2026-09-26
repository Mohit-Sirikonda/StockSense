import React from 'react';
import { TopNavigation, type NavPage } from './TopNavigation';
import { useInventory } from '../../context/InventoryContext';
import { useTheme } from '../../context/ThemeContext';
interface Props {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  children: React.ReactNode;
}
export const AppLayout: React.FC<Props> = ({ currentPage, onNavigate, children }) => {
  const { selectionError } = useInventory();
  const { themeError } = useTheme();
  return (
    <div className="app-shell">
      <TopNavigation currentPage={currentPage} onNavigate={onNavigate} />
      <main className="app-main">
        {(selectionError || themeError) && (
          <div role="alert" className="notice error mb-5">
            {selectionError || themeError}
          </div>
        )}
        <div className="page-content" key={currentPage}>
          {children}
        </div>
        <footer className="app-footer">
          <span>
            StockSense <span className="footer-divider">/</span> Inventory operations
          </span>
          <span>
            <span className="status-dot" /> Browser demo · Single workspace
          </span>
        </footer>
      </main>
    </div>
  );
};
