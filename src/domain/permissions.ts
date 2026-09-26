import type { AuthSession } from '../types';
import { DEMO_USERS } from '../data/users';

export type InventoryAction =
  | 'createProduct'
  | 'editProduct'
  | 'deleteProduct'
  | 'manageLocations'
  | 'receive'
  | 'createDelivery'
  | 'dispatch'
  | 'transfer'
  | 'adjust'
  | 'settings'
  | 'reset';

const permissions: Record<InventoryAction, string[]> = {
  createProduct: ['create_products'],
  editProduct: ['edit_products'],
  deleteProduct: ['delete_products'],
  manageLocations: ['manage_warehouses'],
  receive: ['receive_stock'],
  createDelivery: ['create_deliveries'],
  dispatch: ['create_deliveries', 'process_deliveries'],
  transfer: ['create_transfers', 'perform_assigned_transfers'],
  adjust: ['perform_adjustments', 'perform_physical_counts'],
  settings: ['access_settings'],
  reset: ['access_settings'],
};

// The validated account directory is authoritative; editable session fields never grant capabilities.
export function canPerform(
  session: AuthSession | null,
  action: InventoryAction,
  locationIds: string[] = [],
  directory: readonly AuthSession[] = DEMO_USERS,
): boolean {
  const account = directory.find((user) => user.id === session?.id);
  if (
    !account ||
    account.role !== session?.role ||
    account.warehouseId !== session?.warehouseId ||
    account.email !== session?.email
  )
    return false;
  if (!permissions[action].some((permission) => account.permissions.includes(permission))) return false;
  if (account.role !== 'Warehouse Staff' || locationIds.length === 0) return true;
  return action === 'transfer'
    ? locationIds.includes(account.warehouseId)
    : locationIds.every((id) => id === account.warehouseId);
}

export function requirePermission(
  session: AuthSession | null,
  action: InventoryAction,
  locationIds: string[] = [],
  directory: readonly AuthSession[] = DEMO_USERS,
) {
  if (!canPerform(session, action, locationIds, directory))
    throw new Error('Your role does not permit this action at the selected location.');
}
