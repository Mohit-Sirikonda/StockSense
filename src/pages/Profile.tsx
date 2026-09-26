import React, { useState, useEffect } from 'react';
import {
  LogOut,
  Check,
  Lock,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';

export const Profile: React.FC = () => {
  const {
    currentUser,
    updateUserProfile,
    logout,
    locations,
    ledger,
    isStaff,
    assignedWarehouse,
    assignedWarehouseId,
  } = useInventory();
  const { showToast } = useToast();

  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [role, setRole] = useState(currentUser?.role || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [department, setDepartment] = useState(currentUser?.department || '');

  // Keep form inputs synced whenever active session changes
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setEmail(currentUser.email);
      setRole(currentUser.role);
      setPhone(currentUser.phone || '');
      setDepartment(currentUser.department || '');
    }
  }, [currentUser]);

  const userOperationsCount = ledger.filter((l) => l.user === currentUser?.name).length;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name cannot be empty.', 'error');
      return;
    }

    updateUserProfile({
      name: name.trim(),
      email: email.trim(),
      role: role.trim() as any,
      phone: phone.trim(),
      department: department.trim(),
    });

    showToast('Profile information updated.', 'success');
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Profile</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Active session parameters and role-based operational clearances.
          </p>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--danger)]/30 hover:bg-[var(--danger-subtle)] text-[var(--danger)] rounded text-xs font-medium transition-colors self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </div>

      {/* 2. Account Overview Header */}
      <div className="p-5 border border-[var(--border)] rounded bg-[var(--surface)] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded bg-[var(--accent)] text-white flex items-center justify-center text-lg font-semibold">
            {currentUser.name.slice(0, 1)}
          </div>
          <div>
            <div className="text-base font-semibold text-[var(--text)]">{currentUser.name}</div>
            <div className="text-xs text-[var(--text-secondary)]">{currentUser.email}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              <span className="font-medium text-[var(--text)]">{currentUser.role}</span> · {department || 'Operations'}
            </div>
            {isStaff && (
              <div className="text-[11px] text-[var(--accent)] mt-0.5 font-medium">
                Assigned facility: {assignedWarehouse}
              </div>
            )}
          </div>
        </div>

        <div className="text-right text-xs">
          <div className="text-[var(--text-secondary)]">Activity</div>
          <div className="text-sm font-semibold text-[var(--text)] mt-0.5">
            {userOperationsCount} ledger actions
          </div>
        </div>
      </div>

      {/* 3. Account Form */}
      <section className="border border-[var(--border)] rounded bg-[var(--surface)] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--text)]">Personal details</h2>

        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Full name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Email address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Role title</label>
              <input
                type="text"
                readOnly
                value={role}
                className="w-full px-2.5 py-1.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded text-[var(--text)] cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-[var(--text-secondary)] font-medium">Contact phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex justify-end">
            <button
              type="submit"
              className="px-4 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium rounded transition-colors"
            >
              Save details
            </button>
          </div>
        </form>
      </section>

      {/* 4. Warehouse Authorizations */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Warehouse access & permissions</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            {isStaff
              ? `Operational authorizations for ${currentUser.name} (${currentUser.role}).`
              : 'Full organization authorization granted across all registered storage facilities.'}
          </p>
        </div>

        <div className="border border-[var(--border)] rounded bg-[var(--surface)] divide-y divide-[var(--border-subtle)] text-xs">
          {locations.map((loc) => {
            const isAssigned = isStaff && loc.id === assignedWarehouseId;
            const isAuthorized = !isStaff || isAssigned;

            return (
              <div key={loc.id} className="p-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-[var(--text)]">{loc.name}</span>
                  <span className="text-[var(--text-secondary)] font-mono ml-2 text-[11px]">{loc.code}</span>
                  {isAssigned && (
                    <span className="text-[10px] text-[var(--accent)] ml-2 font-medium">
                      (Assigned Operational Facility)
                    </span>
                  )}
                </div>

                {isAuthorized ? (
                  <span className="text-[11px] text-[var(--success)] font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Authorized
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--text-secondary)] font-medium flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[var(--text-secondary)]" /> Restricted (View only)
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
