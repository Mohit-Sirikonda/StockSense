import { DEMO_USERS } from '../data/users';
import type {
  AccountData,
  AuthSession,
  CommandResult,
  EditableProfile,
  Location,
  RegisteredUser,
} from '../types';
import { createId } from '../utils/id';
import { hashSecret, requirePassword, validateVerifier, verifySecret } from '../utils/credentials';

export const emptyAccounts = (): AccountData => ({ version: 1, session: null, profiles: {} });
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function record(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function emailAddress(email: string) {
  ensure(
    typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    'Enter a valid email address.',
  );
  return email.trim().toLowerCase();
}
export function editableProfile(value: any): EditableProfile {
  ensure(
    record(value) &&
      typeof value.name === 'string' &&
      !!value.name.trim() &&
      (value.phone === undefined || typeof value.phone === 'string') &&
      (value.department === undefined || typeof value.department === 'string'),
    'Saved profile data is invalid.',
  );
  return { name: value.name, phone: value.phone, department: value.department };
}
export function accountDirectory(data: Pick<AccountData, 'users'>): AuthSession[] {
  return [
    ...DEMO_USERS.map(({ password: _password, ...user }) => ({
      ...user,
      permissions: [...user.permissions],
    })),
    ...(data.users ?? []).map((user) => ({
      ...user,
      permissions: [...DEMO_USERS.find((template) => template.role === user.role)!.permissions],
    })),
  ];
}
export function canonicalSession(value: unknown, users: RegisteredUser[] = []): AuthSession | null {
  if (value === null || value === undefined) return null;
  ensure(record(value), 'Saved session is invalid. Sign in again.');
  const identity = accountDirectory({ users }).find((user) => user.id === value.id);
  ensure(
    identity &&
      value.role === identity.role &&
      value.warehouseId === identity.warehouseId &&
      value.email === identity.email,
    'Saved session is invalid. Sign in again.',
  );
  return { ...identity, ...editableProfile(value) };
}
export function validateAccounts(value: unknown): AccountData {
  ensure(record(value) && value.version === 1 && record(value.profiles), 'Saved account data is invalid.');
  const users = value.users ?? [];
  ensure(Array.isArray(users), 'Saved account directory is invalid.');
  const ids = new Set(DEMO_USERS.map((user) => user.id)),
    emails = new Set(DEMO_USERS.map((user) => user.email));
  for (const user of users) {
    ensure(
      record(user) &&
        typeof user.id === 'string' &&
        user.id.startsWith('USR-') &&
        typeof user.name === 'string' &&
        !!user.name.trim() &&
        typeof user.warehouse === 'string' &&
        typeof user.warehouseId === 'string' &&
        !!user.warehouseId &&
        ['Inventory Manager', 'Warehouse Staff'].includes(user.role),
      'Saved registered account is invalid.',
    );
    const email = emailAddress(user.email);
    ensure(
      email === user.email && !ids.has(user.id) && !emails.has(email),
      'Duplicate or invalid saved account.',
    );
    ensure(
      user.role === 'Inventory Manager' ? user.warehouseId === 'all' : user.warehouseId !== 'all',
      'Invalid warehouse assignment.',
    );
    ids.add(user.id);
    emails.add(email);
  }
  const profiles: AccountData['profiles'] = {};
  for (const [id, profile] of Object.entries(value.profiles)) {
    ensure(ids.has(id), 'Saved profile references an unknown account.');
    profiles[id] = editableProfile(profile);
  }
  const credentials = value.credentials ?? {},
    resets = value.resets ?? {};
  ensure(record(credentials) && record(resets), 'Saved credential data is invalid.');
  for (const [id, verifier] of Object.entries(credentials)) {
    ensure(ids.has(id), 'Unknown credential account.');
    validateVerifier(verifier);
  }
  for (const user of users)
    ensure(Object.hasOwn(credentials, user.id), 'A registered account has no credential.');
  for (const [id, challenge] of Object.entries(resets)) {
    ensure(
      ids.has(id) &&
        record(challenge) &&
        Number.isFinite(challenge.expiresAt) &&
        Number.isFinite(challenge.requestedAt) &&
        challenge.expiresAt > challenge.requestedAt &&
        Number.isInteger(challenge.attempts) &&
        challenge.attempts >= 0 &&
        challenge.attempts <= 5,
      'Saved password reset is invalid.',
    );
    validateVerifier(challenge.verifier);
  }
  return {
    version: 1,
    session: canonicalSession(value.session, users),
    profiles,
    users,
    credentials,
    resets,
  };
}

export function createAccountStore(
  initial: AccountData,
  persist: (data: AccountData) => void,
  getLocations: () => Location[],
  now: () => number = Date.now,
) {
  let current = validateAccounts(initial);
  let queue = Promise.resolve();
  function commit(next: AccountData) {
    const valid = validateAccounts(next);
    persist(valid);
    current = valid;
  }
  function sync(action: (data: AccountData) => AccountData): CommandResult {
    try {
      commit(action(current));
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
  function command<T>(
    action: (data: AccountData) => Promise<{ next: AccountData; data: T; error?: string }>,
  ): Promise<CommandResult<T>> {
    const result = queue.then(async () => {
      const before = current;
      try {
        const result = await action(before);
        ensure(current === before, 'Account data changed while this request was running. Please retry.');
        commit(result.next);
        return result.error
          ? { success: false as const, error: result.error }
          : { success: true as const, data: result.data };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    });
    queue = result.then(() => undefined);
    return result;
  }
  return {
    getSnapshot: () => current,
    replace(data: AccountData) {
      current = validateAccounts(data);
    },
    login(email: string, password: string) {
      return command(async (data) => {
        const identity = accountDirectory(data).find((user) => user.email === emailAddress(email));
        ensure(identity, 'Invalid email or password.');
        const credential = data.credentials?.[identity.id];
        const matches = credential
          ? await verifySecret(password, credential)
          : DEMO_USERS.find((user) => user.id === identity.id)?.password === password;
        ensure(matches, 'Invalid email or password.');
        return {
          next: { ...data, session: { ...identity, ...data.profiles[identity.id] } },
          data: undefined,
        };
      });
    },
    signup(input: { name: string; email: string; password: string; role: string; warehouseId: string }) {
      return command(async (data) => {
        const email = emailAddress(input.email);
        requirePassword(input.password);
        ensure(input.name.trim(), 'Enter your name.');
        ensure(
          ['Inventory Manager', 'Warehouse Staff'].includes(input.role),
          'Choose a supported demo role.',
        );
        ensure(
          !accountDirectory(data).some((user) => user.email === email),
          'An account already uses this email.',
        );
        const location = getLocations().find((location) => location.id === input.warehouseId);
        ensure(input.role !== 'Warehouse Staff' || location, 'Select an existing assigned warehouse.');
        const user: RegisteredUser = {
          id: 'USR-' + createId(),
          name: input.name.trim(),
          email,
          role: input.role as RegisteredUser['role'],
          warehouseId: input.role === 'Warehouse Staff' ? location!.id : 'all',
          warehouse: input.role === 'Warehouse Staff' ? location!.name : 'All warehouses',
        };
        const next = {
          ...data,
          users: [...(data.users ?? []), user],
          credentials: { ...data.credentials, [user.id]: await hashSecret(input.password) },
          profiles: { ...data.profiles, [user.id]: { name: user.name } },
        };
        return {
          next: { ...next, session: accountDirectory(next).find((identity) => identity.id === user.id)! },
          data: undefined,
        };
      });
    },
    requestReset(email: string) {
      return command(async (data) => {
        const identity = accountDirectory(data).find((user) => user.email === emailAddress(email));
        ensure(identity, 'No demo account uses that email in this browser.');
        const requestedAt = now(),
          previous = data.resets?.[identity.id];
        ensure(
          !previous || requestedAt - previous.requestedAt >= 30000,
          'Wait 30 seconds before requesting another code.',
        );
        let random: number;
        do {
          random = crypto.getRandomValues(new Uint32Array(1))[0];
        } while (random >= 4294000000);
        const code = String(random % 1000000).padStart(6, '0'),
          expiresAt = requestedAt + 5 * 60000;
        const challenge = { verifier: await hashSecret(code), requestedAt, expiresAt, attempts: 0 };
        return {
          next: { ...data, resets: { ...data.resets, [identity.id]: challenge } },
          data: { code, expiresAt },
        };
      });
    },
    completeReset(email: string, code: string, password: string) {
      return command(async (data) => {
        requirePassword(password);
        const identity = accountDirectory(data).find((user) => user.email === emailAddress(email));
        const challenge = identity && data.resets?.[identity.id];
        ensure(identity && challenge, 'Request a new reset code. This code is unavailable or already used.');
        ensure(now() < challenge.expiresAt, 'This reset code has expired. Request a new code.');
        ensure(challenge.attempts < 5, 'Too many incorrect attempts. Request a new code.');
        if (!/^\d{6}$/.test(code) || !(await verifySecret(code, challenge.verifier))) {
          return {
            next: {
              ...data,
              resets: { ...data.resets, [identity.id]: { ...challenge, attempts: challenge.attempts + 1 } },
            },
            data: undefined,
            error: 'Incorrect reset code.',
          };
        }
        const resets = { ...data.resets };
        delete resets[identity.id];
        return {
          next: {
            ...data,
            resets,
            credentials: { ...data.credentials, [identity.id]: await hashSecret(password) },
            session: data.session?.id === identity.id ? null : data.session,
          },
          data: undefined,
        };
      });
    },
    logout: () => sync((data) => ({ ...data, session: null })),
    updateProfile(updates: Partial<EditableProfile>) {
      return sync((data) => {
        ensure(data.session, 'Sign in before editing your profile.');
        ensure(
          Object.keys(updates).every((key) => ['name', 'phone', 'department'].includes(key)),
          'Email, role, and warehouse assignment cannot be changed here.',
        );
        const profile = editableProfile({ ...data.session, ...updates });
        profile.name = profile.name.trim();
        profile.phone = profile.phone?.trim();
        profile.department = profile.department?.trim();
        return {
          ...data,
          session: { ...data.session, ...profile },
          profiles: { ...data.profiles, [data.session.id]: profile },
        };
      });
    },
    reset: () => sync(() => emptyAccounts()),
  };
}
