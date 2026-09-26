import React, { useState } from 'react';
import { Plus, Edit2, Trash2, RotateCcw, AlertCircle, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { SlideOverDrawer } from '../components/ui/SlideOverDrawer';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Location } from '../types';
import { quantitySummary } from '../domain/selectors';

export const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { locations, addLocation, updateLocation, deleteLocation, resetDemoData, products } = useInventory();
  const { showToast } = useToast();

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
        'error',
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
    const result = resetDemoData();
    if (!result.success) {
      showToast(result.error, 'error');
      return;
    }
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
                <th className="py-2.5 px-3 font-medium text-right">Stock by unit</th>
                <th className="py-2.5 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {locations.map((loc) => {
                const totalUnits = quantitySummary(
                  products
                    .filter((p) => (p.locationStock[loc.id] ?? 0) > 0)
                    .map((p) => ({ quantity: p.locationStock[loc.id], unit: p.unit })),
                );
                return (
                  <tr key={loc.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[var(--text)]">{loc.name}</td>
                    <td className="py-2.5 px-3 font-mono text-[var(--text-secondary)]">{loc.code}</td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                      {loc.description || 'Facility zone'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-[var(--text)]">{totalUnits}</td>
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

      {/* 3. Appearance Section */}
      <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Appearance</h2>
          <p className="text-xs text-[var(--text-secondary)]">Choose how StockSense looks to you.</p>
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
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Warm off-white background</div>
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
            <label htmlFor="settings-field-0" className="text-[var(--text-secondary)] font-medium">
              Location name *
            </label>
            <input
              id="settings-field-0"
              type="text"
              required
              value={locName}
              onChange={(e) => setLocName(e.target.value)}
              placeholder="e.g. West Storage Rack"
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="settings-field-1" className="text-[var(--text-secondary)] font-medium">
              Code (Identifier) *
            </label>
            <input
              id="settings-field-1"
              type="text"
              required
              value={locCode}
              onChange={(e) => setLocCode(e.target.value.toUpperCase())}
              placeholder="e.g. LOC-WEST-01"
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="settings-field-2" className="text-[var(--text-secondary)] font-medium">
              Description
            </label>
            <input
              id="settings-field-2"
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
