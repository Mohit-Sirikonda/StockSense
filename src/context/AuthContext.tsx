import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthSession } from '../types';
import { DEMO_USERS } from '../data/users';
import { StorageService } from '../services/storage';

interface AuthContextType {
  session: AuthSession | null;
  currentUser: AuthSession | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  updateSessionProfile: (updates: Partial<AuthSession>) => void;
  hasPermission: (permission: string) => boolean;
  isManager: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  assignedWarehouse: string;
  assignedWarehouseId: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(() => StorageService.getSession());

  // Listen for storage changes across windows/tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'stocksense_session') {
        const updated = StorageService.getSession();
        setSession(updated);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = useCallback((email: string, password: string): { success: boolean; error?: string } => {
    if (!email || !password) {
      return { success: false, error: 'Invalid email or password.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    const matchedUser = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === cleanEmail && u.password === cleanPassword
    );

    if (!matchedUser) {
      return { success: false, error: 'Invalid email or password.' };
    }

    const newSession: AuthSession = {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
      warehouse: matchedUser.warehouse,
      warehouseId: matchedUser.warehouseId,
      phone: matchedUser.phone,
      department: matchedUser.department,
      permissions: [...matchedUser.permissions],
    };

    StorageService.setSession(newSession);
    setSession(newSession);

    // If user is staff, align the active warehouse to their assigned warehouse
    if (newSession.role === 'Warehouse Staff') {
      StorageService.setSelectedWarehouse(newSession.warehouseId);
    } else {
      StorageService.setSelectedWarehouse('all');
    }

    return { success: true };
  }, []);

  const logout = useCallback(() => {
    StorageService.clearSession();
    setSession(null);
  }, []);

  const updateSessionProfile = useCallback(
    (updates: Partial<AuthSession>) => {
      if (!session) return;
      const updated: AuthSession = {
        ...session,
        ...updates,
      };
      StorageService.setSession(updated);
      setSession(updated);
    },
    [session]
  );

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!session) return false;
      return session.permissions.includes(permission);
    },
    [session]
  );

  const isManager = session?.role === 'Inventory Manager';
  const isStaff = session?.role === 'Warehouse Staff';
  const isAdmin = session?.role === 'Administrator';
  const assignedWarehouse = session?.warehouse || 'Main Warehouse';
  const assignedWarehouseId = session?.warehouseId || 'all';

  return (
    <AuthContext.Provider
      value={{
        session,
        currentUser: session,
        isAuthenticated: !!session,
        login,
        logout,
        updateSessionProfile,
        hasPermission,
        isManager,
        isStaff,
        isAdmin,
        assignedWarehouse,
        assignedWarehouseId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
