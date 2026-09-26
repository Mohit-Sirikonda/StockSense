export type UserRole = 'Inventory Manager' | 'Warehouse Staff' | 'Administrator';

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  warehouse: string;
  warehouseId: string;
  phone?: string;
  department?: string;
  permissions: string[];
}

export interface AuthSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  warehouse: string;
  warehouseId: string;
  phone?: string;
  department?: string;
  permissions: string[];
}
