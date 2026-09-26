import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  AlertCircle,
  Sun,
  Moon,
  Key,
  ShieldCheck,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { SlideOverDrawer } from '../components/ui/SlideOverDrawer';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Location } from '../types';
import { DemoUser, UserRole } from '../types/auth';

const ROLE_OPTIONS: UserRole[] = ['Inventory Manager', 'Warehouse Staff', 'Administrator'];

export const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const {
    locations,
    addLocation,
    updateLocation,
    deleteLocation,
    resetDemoData,
    products,
    users,
    addUser,
    updateUser,
    deleteUser,
    hasPermission,
    currentUser,
  } = useInventory();
  const { showToast } = useToast();
  const canManageUsers = hasPermission('manage_users');

  // Location drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locName, setLocName] = useState('');
  const [locCode, setLocCode] = useState('');
  const [locDesc, setLocDesc] = useState('');
  const [locError, setLocError] = useState('');

  // Delete confirmation
  const [locToDelete, setLocToDelete] = useState<Location | null>(null);

  // Reset confirmation
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // User management drawer
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<DemoUser | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('Warehouse Staff');
  const [userWarehouseId, setUserWarehouseId] = useState('all');
  const [userPhone, setUserPhone] = useState('');
  const [userDepartment, setUserDepartment] = useState('');
  const [userError, setUserError] = useState('');

  // Delete user confirmation
  const [userToDelete, setUserToDelete] = useState<DemoUser | null>(null);

  const warehouseLabel = (warehouseId: string) => {
    if (warehouseId === 'all') return 'All Warehouses';
    return locations.find((l) => l.id === warehouseId)?.name || warehouseId;
  };

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserRole('Warehouse Staff');
    setUserWarehouseId(locations[0]?.id || 'all');
    setUserPhone('');
    setUserDepartment('');
    setUserError('');
    setIsUserDrawerOpen(true);
  };

  const handleOpenEditUser = (user: DemoUser) => {
    setEditingUser(user);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserPassword('');
    setUserRole(user.role);
    setUserWarehouseId(user.warehouseId);
    setUserPhone(user.phone || '');
    setUserDepartment(user.department || '');
    setUserError('');
    setIsUserDrawerOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');

    if (!userName.trim()) {
      setUserError('Name is required.');
      return;
    }
    if (!userEmail.trim()) {
      setUserError('Email is required.');
      return;
    }

    const warehouseName = warehouseLabel(userWarehouseId);

    if (editingUser) {
      const res = updateUser(editingUser.id, {
        name: userName,
        email: userEmail,
        ...(userPassword.trim() ? { password: userPassword } : {}),
        role: userRole,
        warehouse: warehouseName,
        warehouseId: userWarehouseId,
        phone: userPhone,
        department: userDepartment,
      });

      if (!res.success) {
        setUserError(res.error || 'Failed to update user');
        return;
      }

      showToast(`User "${userName}" updated.`, 'success');
      setIsUserDrawerOpen(false);
    } else {
      if (!userPassword.trim() || userPassword.length < 6) {
        setUserError('Password must be at least 6 characters.');
        return;
      }

      const res = addUser({
        name: userName,
        email: userEmail,
        password: userPassword,
        role: userRole,
        warehouse: warehouseName,
        warehouseId: userWarehouseId,
        phone: userPhone,
        department: userDepartment,
      });

      if (!res.success) {
        setUserError(res.error || 'Failed to add user');
        return;
      }

      showToast(`User "${userName}" added.`, 'success');
      setIsUserDrawerOpen(false);
    }
  };

  const handleDeleteUserConfirm = () => {
    if (!userToDelete) return;

    const res = deleteUser(userToDelete.id);
    if (!res.success) {
      showToast(res.error || 'Failed to delete user', 'error');
    } else {
      showToast(`User "${userToDelete.name}" removed.`, 'success');
    }
    setUserToDelete(null);
  };

  const handleOpenAdd = () => {
    setEditingLocation(null);
    setLocName('');
    setLocCode('');
    setLocDesc('');
    setLocError('');
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (loc: Location) => {
    setEditingLocation(loc);
    setLocName(loc.name);
    setLocCode(loc.code);
    setLocDesc(loc.description || '');
    setLocError('');
    setIsDrawerOpen(true);
  };

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    setLocError('');

    if (!locName.trim()) {
      setLocError('Location name is required.');
      return;
    }
    if (!locCode.trim()) {
      setLocError('Location code is required.');
      return;
    }

    if (editingLocation) {
      const res = updateLocation(editingLocation.id, {
        name: locName.trim(),
        code: locCode.trim().toUpperCase(),
        description: locDesc.trim(),
      });

      if (!res.success) {
        setLocError(res.error || 'Failed to update location');
        return;
      }

      showToast(`Location "${locName}" updated.`, 'success');
      setIsDrawerOpen(false);
    } else {
      const res = addLocation({
        name: locName.trim(),
        code: locCode.trim().toUpperCase(),
        description: locDesc.trim(),
      });

      if (!res.success) {
        setLocError(res.error || 'Failed to add location');
        return;
      }

      showToast(`Location "${locName}" registered.`, 'success');
      setIsDrawerOpen(false);
    }
  };

  const handleDeleteConfirm = () => {
    if (!locToDelete) return;

    // Check if location holds stock
    const hasStock = products.some((p) => (p.locationStock[locToDelete.id] || 0) > 0);
    if (hasStock) {
      showToast(
        `Cannot delete "${locToDelete.name}" because it currently holds inventory units. Transfer items first.`,
        'error'
      );
      setLocToDelete(null);
      return;
    }

    const res = deleteLocation(locToDelete.id);
    if (!res.success) {
      showToast(res.error || 'Failed to delete location', 'error');
    } else {
      showToast(`Location "${locToDelete.name}" removed.`, 'success');
    }
    setLocToDelete(null);
  };

  const handleExecuteReset = () => {
    resetDemoData();
    showToast('Demo data restored to initial state.', 'info');
    setIsResetConfirmOpen(false);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* 1. Header */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)]">Settings</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Configure warehouse locations, appearance, and inventory parameters.
        </p>
      </div>

      {/* 2. Warehouse Locations Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Warehouse locations</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Physical buildings, storage racks, and operational zones.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add location</span>
          </button>
        </div>

        <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                <th className="py-2.5 px-3 font-medium">Name</th>
                <th className="py-2.5 px-3 font-medium">Code</th>
                <th className="py-2.5 px-3 font-medium">Description</th>
                <th className="py-2.5 px-3 font-medium text-right">Units on hand</th>
                <th className="py-2.5 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {locations.map((loc) => {
                const totalUnits = products.reduce(
                  (sum, p) => sum + (p.locationStock[loc.id] || 0),
                  0
                );
                return (
                  <tr key={loc.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[var(--text)]">{loc.name}</td>
                    <td className="py-2.5 px-3 font-mono text-[var(--text-secondary)]">{loc.code}</td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                      {loc.description || 'Facility zone'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-[var(--text)]">
                      {totalUnits.toLocaleString()} units
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(loc)}
                        className="text-[var(--accent)] hover:underline text-[11px]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setLocToDelete(loc)}
                        className="text-[var(--danger)] hover:underline text-[11px]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2b. Team & Access Section - Administrator only */}
      {canManageUsers && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Team &amp; access</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Manage user accounts, roles, and warehouse assignments.
              </p>
            </div>
            <button
              onClick={handleOpenAddUser}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add user</span>
            </button>
          </div>

          <div className="border border-[var(--border)] rounded bg-[var(--surface)] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                  <th className="py-2.5 px-3 font-medium">Name</th>
                  <th className="py-2.5 px-3 font-medium">Role</th>
                  <th className="py-2.5 px-3 font-medium">Warehouse</th>
                  <th className="py-2.5 px-3 font-medium">Department</th>
                  <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[var(--text)] flex items-center gap-1.5">
                          {u.name}
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent)] font-medium">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)]">{u.email}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 text-[var(--text)]">
                          {u.role === 'Administrator' && (
                            <ShieldCheck className="w-3 h-3 text-[var(--accent)]" />
                          )}
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                        {warehouseLabel(u.warehouseId)}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                        {u.department || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditUser(u)}
                          className="text-[var(--accent)] hover:underline text-[11px]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setUserToDelete(u)}
                          disabled={isSelf}
                          className="text-[var(--danger)] hover:underline text-[11px] disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                          title={isSelf ? 'You cannot delete your own account' : undefined}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 3. Appearance Section */}
      <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Appearance</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Choose how StockSense looks to you.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-3 rounded border text-left text-xs transition-colors ${
              theme === 'light'
                ? 'border-[var(--accent)] bg-[var(--accent-subtle)] font-medium text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            <Sun className="w-4 h-4 mb-2 text-[var(--text)]" />
            <div className="font-medium text-[var(--text)]">Light</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Warm off-white background
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-3 rounded border text-left text-xs transition-colors ${
              theme === 'dark'
                ? 'border-[var(--accent)] bg-[var(--accent-subtle)] font-medium text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            <Moon className="w-4 h-4 mb-2 text-[var(--text)]" />
            <div className="font-medium text-[var(--text)]">Dark</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Restrained dark gray surface
            </div>
          </button>
        </div>
      </section>

      {/* 4. Reset Data Section */}
      <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Data maintenance</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Restore sample products, receipts, deliveries, and ledger entries back to demo defaults.
          </p>
        </div>

        <div className="p-4 border border-[var(--border)] rounded bg-[var(--surface)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-[var(--text)]">Reset demo data</div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
              Replaces in-browser modified items with fresh baseline inventory.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] hover:bg-[var(--surface-secondary)] text-[var(--text)] rounded transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span>Reset data</span>
          </button>
        </div>
      </section>

      {/* LOCATION SLIDE-OVER DRAWER */}
      <SlideOverDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingLocation ? 'Edit location' : 'Add location'}
        subtitle="Manage warehouse facilities and zones"
        width="md"
      >
        <form onSubmit={handleSaveLocation} className="space-y-4 text-xs">
          {locError && (
            <div className="p-2.5 bg-[var(--danger-subtle)] text-[var(--danger)] rounded border border-[var(--danger)]/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{locError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[var(--text-secondary)] font-medium">Location name *</label>
            <input
              type="text"
              required
              value={locName}
              onChange={(e) => setLocName(e.target.value)}
              placeholder="e.g. West Storage Rack"
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[var(--text-secondary)] font-medium">Code (Identifier) *</label>
            <input
              type="text"
              required
              value={locCode}
              onChange={(e) => setLocCode(e.target.value.toUpperCase())}
              placeholder="e.g. LOC-WEST-01"
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[var(--text-secondary)] font-medium">Description</label>
            <input
              type="text"
              value={locDesc}
              onChange={(e) => setLocDesc(e.target.value)}
              placeholder="e.g. Primary zone for dry goods"
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded text-[var(--text)] hover:bg-[var(--surface-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded"
            >
              {editingLocation ? 'Save changes' : 'Add location'}
            </button>
          </div>
        </form>
      </SlideOverDrawer>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!locToDelete}
        onClose={() => setLocToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete location"
        message={`Are you sure you want to delete "${locToDelete?.name}" (${locToDelete?.code})?`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* USER SLIDE-OVER DRAWER */}
      <SlideOverDrawer
        isOpen={isUserDrawerOpen}
        onClose={() => setIsUserDrawerOpen(false)}
        title={editingUser ? 'Edit user' : 'Add user'}
        subtitle="Manage account access, role, and warehouse assignment"
        width="md"
      >
        <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
          {userError && (
            <div className="p-2.5 bg-[var(--danger-subtle)] text-[var(--danger)] rounded border border-[var(--danger)]/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{userError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[var(--text-secondary)] font-medium">Full name *</label>
            <input
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Neha Kapoor"
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[var(--text-secondary)] font-medium">Email address *</label>
            <input
              type="email"
              required
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[var(--text-secondary)] font-medium">
              {editingUser ? 'New password' : 'Password *'}
            </label>
            <div className="relative">
              <Key className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-2 pointer-events-none" />
              <input
                type="password"
                required={!editingUser}
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                placeholder={editingUser ? 'Leave blank to keep current password' : 'At least 6 characters'}
                className="w-full pl-8 pr-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Role *</label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as UserRole)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Warehouse *</label>
              <select
                value={userWarehouseId}
                onChange={(e) => setUserWarehouseId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                {userRole !== 'Warehouse Staff' && <option value="all">All Warehouses</option>}
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Phone</label>
              <input
                type="text"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Department</label>
              <input
                type="text"
                value={userDepartment}
                onChange={(e) => setUserDepartment(e.target.value)}
                placeholder="e.g. Floor Logistics"
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <p className="text-[11px] text-[var(--text-secondary)]">
            Permissions are assigned automatically based on the selected role.
          </p>

          <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsUserDrawerOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded text-[var(--text)] hover:bg-[var(--surface-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded"
            >
              {editingUser ? 'Save changes' : 'Add user'}
            </button>
          </div>
        </form>
      </SlideOverDrawer>

      {/* CONFIRM DELETE USER DIALOG */}
      <ConfirmDialog
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleDeleteUserConfirm}
        title="Delete user"
        message={`Are you sure you want to remove "${userToDelete?.name}" (${userToDelete?.email})? They will immediately lose access.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* CONFIRM RESET DIALOG */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleExecuteReset}
        title="Reset demo data"
        message="This will overwrite current changes in your browser and restore factory sample products, receipts, deliveries, and ledger records."
        confirmLabel="Reset data"
        variant="warning"
      />
    </div>
  );
};
