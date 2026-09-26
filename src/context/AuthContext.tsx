import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthSession } from '../types';
import { DemoUser, UserRole } from '../types/auth';
import { StorageService } from '../services/storage';

// Default permission sets applied automatically based on role.
// Keeps newly created accounts consistent with the seeded demo users.
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'Inventory Manager': [
    'view_dashboard',
    'view_all_products',
    'create_products',
    'edit_products',
    'delete_products',
    'receive_stock',
    'create_deliveries',
    'create_transfers',
    'perform_adjustments',
    'view_stock_ledger',
    'manage_warehouses',
    'view_all_locations',
    'access_settings',
  ],
  'Warehouse Staff': [
    'view_dashboard',
    'view_products',
    'view_assigned_stock',
    'receive_stock',
    'process_deliveries',
    'perform_assigned_transfers',
    'view_assigned_ledger',
    'perform_physical_counts',
  ],
  Administrator: [
    'view_dashboard',
    'view_all_products',
    'create_products',
    'edit_products',
    'delete_products',
    'receive_stock',
    'create_deliveries',
    'create_transfers',
    'perform_adjustments',
    'view_stock_ledger',
    'manage_warehouses',
    'view_all_locations',
    'access_settings',
    'manage_users',
    'manage_global_settings',
  ],
};

export interface NewUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  warehouse: string;
  warehouseId: string;
  phone?: string;
  department?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  warehouse?: string;
  warehouseId?: string;
  phone?: string;
  department?: string;
}

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

  // User management (Administrator only, enforced in UI via 'manage_users' permission)
  users: DemoUser[];
  addUser: (input: NewUserInput) => { success: boolean; error?: string };
  updateUser: (id: string, updates: UpdateUserInput) => { success: boolean; error?: string };
  deleteUser: (id: string) => { success: boolean; error?: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(() => StorageService.getSession());
  const [users, setUsers] = useState<DemoUser[]>(() => StorageService.getUsers());

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

    const matchedUser = users.find(
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
  }, [users]);

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

  const persistUsers = useCallback((next: DemoUser[]) => {
    setUsers(next);
    StorageService.setUsers(next);
  }, []);

  const addUser = useCallback(
    (input: NewUserInput): { success: boolean; error?: string } => {
      const cleanEmail = input.email.trim().toLowerCase();

      if (!input.name.trim()) {
        return { success: false, error: 'Name is required.' };
      }
      if (!cleanEmail) {
        return { success: false, error: 'Email is required.' };
      }
      if (!input.password || input.password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
      }
      const emailTaken = users.some((u) => u.email.toLowerCase() === cleanEmail);
      if (emailTaken) {
        return { success: false, error: `A user with email "${cleanEmail}" already exists.` };
      }

      const newUser: DemoUser = {
        id: `USR-${Date.now().toString(36).toUpperCase()}`,
        name: input.name.trim(),
        email: cleanEmail,
        password: input.password.trim(),
        role: input.role,
        warehouse: input.warehouse,
        warehouseId: input.warehouseId,
        phone: input.phone?.trim(),
        department: input.department?.trim(),
        permissions: [...ROLE_PERMISSIONS[input.role]],
      };

      persistUsers([...users, newUser]);
      return { success: true };
    },
    [users, persistUsers]
  );

  const updateUser = useCallback(
    (id: string, updates: UpdateUserInput): { success: boolean; error?: string } => {
      const target = users.find((u) => u.id === id);
      if (!target) {
        return { success: false, error: 'User not found.' };
      }

      if (updates.email) {
        const cleanEmail = updates.email.trim().toLowerCase();
        const emailTaken = users.some(
          (u) => u.id !== id && u.email.toLowerCase() === cleanEmail
        );
        if (emailTaken) {
          return { success: false, error: `A user with email "${cleanEmail}" already exists.` };
        }
      }

      if (updates.password && updates.password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
      }

      const nextRole = updates.role || target.role;
      const roleChanged = updates.role && updates.role !== target.role;

      const updatedUser: DemoUser = {
        ...target,
        ...updates,
        name: updates.name?.trim() ?? target.name,
        email: updates.email ? updates.email.trim().toLowerCase() : target.email,
        password: updates.password ? updates.password.trim() : target.password,
        phone: updates.phone !== undefined ? updates.phone.trim() : target.phone,
        department: updates.department !== undefined ? updates.department.trim() : target.department,
        permissions: roleChanged ? [...ROLE_PERMISSIONS[nextRole]] : target.permissions,
      };

      persistUsers(users.map((u) => (u.id === id ? updatedUser : u)));

      // Keep the active session in sync if the admin edits their own account
      if (session?.id === id) {
        const updatedSession: AuthSession = {
          ...session,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          warehouse: updatedUser.warehouse,
          warehouseId: updatedUser.warehouseId,
          phone: updatedUser.phone,
          department: updatedUser.department,
          permissions: [...updatedUser.permissions],
        };
        StorageService.setSession(updatedSession);
        setSession(updatedSession);
      }

      return { success: true };
    },
    [users, persistUsers, session]
  );

  const deleteUser = useCallback(
    (id: string): { success: boolean; error?: string } => {
      const target = users.find((u) => u.id === id);
      if (!target) {
        return { success: false, error: 'User not found.' };
      }
      if (session?.id === id) {
        return { success: false, error: 'You cannot delete your own account while signed in.' };
      }
      if (target.role === 'Administrator') {
        const adminCount = users.filter((u) => u.role === 'Administrator').length;
        if (adminCount <= 1) {
          return { success: false, error: 'Cannot delete the last remaining Administrator.' };
        }
      }

      persistUsers(users.filter((u) => u.id !== id));
      return { success: true };
    },
    [users, persistUsers, session]
  );

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
        users,
        addUser,
        updateUser,
        deleteUser,
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
