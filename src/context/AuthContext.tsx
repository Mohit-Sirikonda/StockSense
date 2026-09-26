import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { AccountData, CommandResult, EditableProfile } from '../types';
import { StorageService, ACCOUNT_KEY, errorMessage } from '../services/storage';
import { accountDirectory, createAccountStore, emptyAccounts } from '../domain/accounts';
import { useToast } from './ToastContext';

function initialize() {
  try {
    return { data: StorageService.loadAccounts(), error: '' };
  } catch (error) {
    return { data: emptyAccounts(), error: errorMessage(error) };
  }
}
function useAuthValue() {
  const [initial] = useState(initialize);
  const [data, setData] = useState(initial.data);
  const [authError, setAuthError] = useState(initial.error);
  const store = useRef<ReturnType<typeof createAccountStore> | null>(null);
  if (!store.current)
    store.current = createAccountStore(
      initial.data,
      StorageService.saveAccounts,
      () => StorageService.loadInventory().locations,
    );
  const { showToast } = useToast();
  const session = data.session;
  function publish<T>(result: CommandResult<T>) {
    setData(store.current!.getSnapshot());
    if (result.success) setAuthError('');
    return result;
  }
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ACCOUNT_KEY || event.key === 'stocksense_session' || event.key === null) {
        try {
          const next = StorageService.loadAccounts();
          store.current!.replace(next);
          setData(store.current!.getSnapshot());
          setAuthError('');
        } catch (error) {
          store.current!.replace(emptyAccounts());
          setData(emptyAccounts());
          setAuthError(errorMessage(error));
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  const blocked = (): CommandResult => ({
    success: false,
    error: 'Reset invalid saved account data before signing in.',
  });
  async function login(email: string, password: string) {
    if (authError) return blocked();
    return publish(await store.current!.login(email, password));
  }
  async function signup(input: Parameters<ReturnType<typeof createAccountStore>['signup']>[0]) {
    if (authError) return blocked();
    return publish(await store.current!.signup(input));
  }
  async function requestReset(email: string) {
    if (authError) return { success: false as const, error: 'Reset invalid saved account data first.' };
    return publish(await store.current!.requestReset(email));
  }
  async function completeReset(email: string, code: string, password: string) {
    if (authError) return blocked();
    return publish(await store.current!.completeReset(email, code, password));
  }
  function logout() {
    const result = publish(store.current!.logout());
    if (!result.success) showToast(result.error, 'error');
  }
  const accounts = accountDirectory(data);
  return {
    session,
    currentUser: session,
    isAuthenticated: !!session,
    login,
    signup,
    requestReset,
    completeReset,
    logout,
    accounts,
    updateSessionProfile: (updates: Partial<EditableProfile>) =>
      publish(store.current!.updateProfile(updates)),
    authError,
    resetSavedAccount: () => publish(store.current!.reset()),
    hasPermission: (permission: string) =>
      accounts.find((user) => user.id === session?.id)?.permissions.includes(permission) ?? false,
    isManager: session?.role === 'Inventory Manager',
    isStaff: session?.role === 'Warehouse Staff',
    isAdmin: session?.role === 'Administrator',
    assignedWarehouse: session?.warehouse ?? 'All warehouses',
    assignedWarehouseId: session?.warehouseId ?? 'all',
  };
}
const AuthContext = createContext<ReturnType<typeof useAuthValue> | undefined>(undefined);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthContext.Provider value={useAuthValue()}>{children}</AuthContext.Provider>
);
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
