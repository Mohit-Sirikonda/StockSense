import type { PasswordVerifier } from '../types';

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const bytes = (value: string) => Uint8Array.from(value.match(/../g)!, (pair) => parseInt(pair, 16));
function subtle() {
  if (!globalThis.crypto?.subtle)
    throw new Error(
      'Protected demo passwords require HTTPS or localhost. Open this workspace on a secure origin.',
    );
  return globalThis.crypto.subtle;
}
async function derive(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const api = subtle();
  const key = await api.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  return hex(
    new Uint8Array(await api.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)),
  );
}
export function requirePassword(password: string) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    throw new Error('Use a demo password between 8 and 128 characters. Do not reuse a real password.');
}
export async function hashSecret(secret: string): Promise<PasswordVerifier> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;
  return {
    algorithm: 'PBKDF2-SHA256',
    iterations,
    salt: hex(salt),
    hash: await derive(secret, salt, iterations),
  };
}
export async function verifySecret(secret: string, verifier: PasswordVerifier): Promise<boolean> {
  const candidate = await derive(secret, bytes(verifier.salt), verifier.iterations);
  let difference = 0;
  for (let i = 0; i < candidate.length; i++)
    difference |= candidate.charCodeAt(i) ^ verifier.hash.charCodeAt(i);
  return difference === 0;
}
export function validateVerifier(value: any): asserts value is PasswordVerifier {
  if (
    !value ||
    value.algorithm !== 'PBKDF2-SHA256' ||
    value.iterations !== 100000 ||
    typeof value.salt !== 'string' ||
    !/^[a-f0-9]{32}$/.test(value.salt) ||
    typeof value.hash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.hash)
  )
    throw new Error('Saved credential data is invalid.');
}
