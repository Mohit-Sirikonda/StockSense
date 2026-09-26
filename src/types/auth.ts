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

export type EditableProfile = Pick<AuthSession, 'name' | 'phone' | 'department'>;
export type RegisteredUser = Pick<
  AuthSession,
  'id' | 'name' | 'email' | 'role' | 'warehouse' | 'warehouseId'
>;
export interface PasswordVerifier {
  algorithm: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  hash: string;
}
export interface ResetChallenge {
  verifier: PasswordVerifier;
  requestedAt: number;
  expiresAt: number;
  attempts: number;
}
export interface AccountData {
  version: 1;
  session: AuthSession | null;
  profiles: Record<string, EditableProfile>;
  users?: RegisteredUser[];
  credentials?: Record<string, PasswordVerifier>;
  resets?: Record<string, ResetChallenge>;
}
