import React, { useState, useEffect } from 'react';
import { LogOut, Check, Lock } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { DEMO_USERS } from '../data/users';

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

  const originalName = DEMO_USERS.find((user) => user.id === currentUser?.id)?.name;
  const userOperationsCount = ledger.filter((l) =>
    l.userId ? l.userId === currentUser?.id : l.user === originalName,
  ).length;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name cannot be empty.', 'error');
      return;
    }

    const result = updateUserProfile({
      name: name.trim(),
      phone: phone.trim(),
      department: department.trim(),
    });

    if (!result.success) {
      showToast(result.error, 'error');
      return;
    }
    showToast('Contact details saved in this browser.', 'success');
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Profile</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Your contact details, account role, and facility access.
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
              <span className="font-medium text-[var(--text)]">{currentUser.role}</span> ·{' '}
              {department || 'Operations'}
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

        <p className="notice">
          Contact details are saved in this browser and retained when you sign in again. Login email, role,
          and warehouse assignment cannot be edited here. Sign out and use account recovery to reset a demo
          password.
        </p>
        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="profile-field-0" className="text-[var(--text-secondary)] font-medium">
                Full name *
              </label>
              <input
                id="profile-field-0"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="profile-field-1" className="text-[var(--text-secondary)] font-medium">
                Email address *
              </label>
              <input
                id="profile-field-1"
                type="email"
                readOnly
                required
                value={email}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="profile-field-2" className="text-[var(--text-secondary)] font-medium">
                Role title
              </label>
              <input
                id="profile-field-2"
                type="text"
                readOnly
                value={role}
                className="w-full px-2.5 py-1.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded text-[var(--text)] cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="profile-field-3" className="text-[var(--text-secondary)] font-medium">
                Department
              </label>
              <input
                id="profile-field-3"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="profile-field-4" className="text-[var(--text-secondary)] font-medium">
                Contact phone
              </label>
              <input
                id="profile-field-4"
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
              : 'Operational access across all registered facilities.'}
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
                    <Lock className="w-3 h-3 text-[var(--text-secondary)]" /> Transfers involving your
                    facility only
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
