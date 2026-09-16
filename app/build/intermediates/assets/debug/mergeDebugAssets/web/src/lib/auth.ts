export interface Win12Account {
  username: string;
  displayName: string;
  createdAt: number;
  passwordHash: string;
  passwordSalt: string;
}

const ACCOUNT_KEY = 'win12.account.v1';
const SESSION_KEY = 'win12.session.v1';

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function derivePassword(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' }, material, 256);
  return new Uint8Array(bits);
}

export async function createAccount(username: string, password: string): Promise<Win12Account> {
  const clean = username.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,31}$/.test(clean)) throw new Error('Use 2–32 letters, numbers, spaces, dots, underscores or hyphens.');
  if (password.length < 8) throw new Error('Password must contain at least 8 characters.');
  const salt = randomBytes(16);
  const hash = await derivePassword(password, salt);
  const account: Win12Account = { username: clean, displayName: clean, createdAt: Date.now(), passwordHash: bytesToBase64(hash), passwordSalt: bytesToBase64(salt) };
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  localStorage.removeItem(SESSION_KEY);
  return account;
}

export function getAccount(): Win12Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Win12Account>;
    if (!value.username || !value.passwordHash || !value.passwordSalt) return null;
    return value as Win12Account;
  } catch { return null; }
}

export function hasAccount() { return getAccount() !== null; }
export function hasSession() { return localStorage.getItem(SESSION_KEY) === 'signed-in'; }
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

export async function signIn(password: string, remember = false) {
  const account = getAccount();
  if (!account) throw new Error('No WIN12 user has been configured yet.');
  const hash = await derivePassword(password, base64ToBytes(account.passwordSalt));
  if (bytesToBase64(hash) !== account.passwordHash) throw new Error('The password is incorrect.');
  if (remember) localStorage.setItem(SESSION_KEY, 'signed-in'); else localStorage.removeItem(SESSION_KEY);
  return account;
}

export function getUserProfile() {
  const account = getAccount();
  const name = account?.displayName || 'Administrator';
  return { displayName: name, pcName: `${name} PC`, description: `Local WIN12 profile for ${name}; Android permissions are unchanged.` };
}
