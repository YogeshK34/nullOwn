import type { StealthKeys } from "./stealth";

/**
 * Passphrase-encrypted storage for stealth keys.
 *
 * ARCHITECTURE.md §13 is explicit: stealth keys persisted to localStorage must
 * be AES-encrypted. localStorage is readable by any script on the origin, so
 * plaintext there would hand the spend key to a single XSS bug.
 *
 * Scheme: PBKDF2-SHA-256 (600k iterations) derives a 256-bit key from the
 * passphrase; AES-256-GCM provides confidentiality and integrity together, so a
 * tampered blob fails to decrypt rather than yielding garbage keys. Salt and IV
 * are fresh per write and stored alongside the ciphertext — neither is secret.
 *
 * The passphrase is never persisted. Decrypted keys live in React state for the
 * session only, and nothing here ever touches the network.
 */

const STORAGE_KEY = "nullown.stealth-keys.v1";
const KEYSTORE_VERSION = 1;

/** OWASP's 2023 floor for PBKDF2-HMAC-SHA256. */
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // 96 bits, the GCM-recommended size.

/** On-disk shape. Contains no secret material beyond the ciphertext. */
interface EncryptedKeystore {
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
}

export class KeystoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeystoreError";
  }
}

function requireCrypto(): Crypto {
  if (typeof globalThis.crypto?.subtle === "undefined") {
    throw new KeystoreError(
      "Web Crypto is unavailable. The keystore requires a secure context (HTTPS or localhost).",
    );
  }
  return globalThis.crypto;
}

function requireStorage(): Storage {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new KeystoreError("localStorage is unavailable in this environment.");
  }
  return window.localStorage;
}

// --- base64 helpers (avoiding Buffer, which is not in the browser) ----------

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Stretch the passphrase into an AES-GCM key. */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = requireCrypto().subtle;

  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable: the derived key can never be read back out
    ["encrypt", "decrypt"],
  );
}

/** Encrypt and persist. Overwrites any existing keystore on this origin. */
export async function saveKeys(keys: StealthKeys, passphrase: string): Promise<void> {
  if (passphrase.length < 8) {
    throw new KeystoreError("Passphrase must be at least 8 characters.");
  }

  const crypto = requireCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);

  const plaintext = new TextEncoder().encode(JSON.stringify(keys));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext,
  );

  const record: EncryptedKeystore = {
    version: KEYSTORE_VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    createdAt: new Date().toISOString(),
  };

  requireStorage().setItem(STORAGE_KEY, JSON.stringify(record));
}

/** Decrypt the stored keystore. Throws `KeystoreError` on a wrong passphrase. */
export async function loadKeys(passphrase: string): Promise<StealthKeys> {
  const raw = requireStorage().getItem(STORAGE_KEY);
  if (!raw) throw new KeystoreError("No stealth keys are stored on this device.");

  let record: EncryptedKeystore;
  try {
    record = JSON.parse(raw) as EncryptedKeystore;
  } catch {
    throw new KeystoreError("Stored keystore is corrupt and cannot be parsed.");
  }

  if (record.version !== KEYSTORE_VERSION) {
    throw new KeystoreError(
      `Unsupported keystore version ${record.version}. Re-import your keys to upgrade.`,
    );
  }

  const key = await deriveKey(passphrase, fromBase64(record.salt));

  let plaintext: ArrayBuffer;
  try {
    plaintext = await requireCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(record.iv) as BufferSource },
      key,
      fromBase64(record.ciphertext) as BufferSource,
    );
  } catch {
    // GCM authentication covers both a wrong passphrase and a tampered blob.
    // They are not distinguishable, and conflating them is the safe default.
    throw new KeystoreError("Incorrect passphrase, or the keystore has been tampered with.");
  }

  const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as StealthKeys;
  if (!parsed?.spend?.privateKey || !parsed?.view?.privateKey) {
    throw new KeystoreError("Decrypted keystore is missing a spend or view key.");
  }

  return parsed;
}

/** Whether this device holds an encrypted keystore. Safe to call during SSR. */
export function hasStoredKeys(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  return window.localStorage.getItem(STORAGE_KEY) !== null;
}

/** When the stored keystore was written, if there is one. */
export function storedKeysCreatedAt(): string | undefined {
  if (!hasStoredKeys()) return undefined;
  try {
    const record = JSON.parse(requireStorage().getItem(STORAGE_KEY) ?? "{}") as EncryptedKeystore;
    return record.createdAt;
  } catch {
    return undefined;
  }
}

/**
 * Erase the keystore.
 *
 * Irreversible without a backup of the private keys: the passphrase alone
 * cannot regenerate them, and any assets at derived stealth addresses become
 * unreachable.
 */
export function clearKeys(): void {
  requireStorage().removeItem(STORAGE_KEY);
}
