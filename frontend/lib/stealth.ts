import { secp256k1 } from "@noble/curves/secp256k1";
import { getAddress, keccak256 } from "ethers";
import type { Address } from "viem";

/**
 * ERC-5564 stealth addresses over secp256k1 (scheme id 0).
 *
 * ---------------------------------------------------------------------------
 * Protocol
 * ---------------------------------------------------------------------------
 * A recipient publishes two public keys: a *spend* key `K = k·G` and a *view*
 * key `V = v·G`. To pay them privately, a sender:
 *
 *   1. draws an ephemeral key `r`, with `R = r·G`
 *   2. computes the shared secret point `S = r·V`
 *   3. hashes it: `h = keccak256(compressed(S))`
 *   4. derives the one-time address from `P = K + h·G`
 *   5. publishes `R` (never `S`, never `h`) via the announcer
 *
 * The recipient recovers the same secret from the other side of the
 * Diffie–Hellman: `S = v·R`. Only they can do this, because only they hold `v`.
 * The corresponding private key is `k + h (mod n)`, which needs `k` — so the
 * *view* key alone is enough to detect a payment but not to spend it. That
 * split is what makes it safe to hand a view key to a watch-only scanner.
 *
 * ---------------------------------------------------------------------------
 * Non-custodial guarantee
 * ---------------------------------------------------------------------------
 * Every function here is pure and runs in the browser. No private key is ever
 * serialised to a network call. Persistence goes through `lib/keystore.ts`,
 * which encrypts under a user passphrase before touching localStorage.
 */

export type Hex = `0x${string}`;

/** ERC-5564 scheme id for secp256k1 with view tags. */
export const SCHEME_ID = 0n;

/** Compressed secp256k1 point, in bytes. */
export const COMPRESSED_PUBKEY_BYTES = 33;

/** Meta-address is spend key ‖ view key. */
export const META_ADDRESS_BYTES = COMPRESSED_PUBKEY_BYTES * 2;

const CURVE_ORDER = secp256k1.CURVE.n;

export interface StealthKeyPair {
  /** 32-byte scalar. */
  privateKey: Hex;
  /** 33-byte compressed point. */
  publicKey: Hex;
}

export interface StealthKeys {
  spend: StealthKeyPair;
  view: StealthKeyPair;
}

export interface StealthMetaAddress {
  spendPublicKey: Hex;
  viewPublicKey: Hex;
  /** 66-byte concatenation, as stored in the registry. */
  encoded: Hex;
}

/** What a sender produces and broadcasts. */
export interface StealthPayment {
  stealthAddress: Address;
  ephemeralPublicKey: Hex;
  /** First byte of the shared-secret hash; lets scanners skip ~99.6% of entries. */
  viewTag: number;
  /** Announcement metadata — byte 0 is the view tag. */
  metadata: Hex;
}

/** A payment the scanner matched to the local keys. */
export interface DiscoveredPayment {
  stealthAddress: Address;
  ephemeralPublicKey: Hex;
  viewTag: number;
}

// ---------------------------------------------------------------------------
// Byte helpers
// ---------------------------------------------------------------------------

function toHex(bytes: Uint8Array): Hex {
  let out = "0x";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out as Hex;
}

function fromHex(value: string): Uint8Array {
  const clean = value.startsWith("0x") ? value.slice(2) : value;
  if (clean.length % 2 !== 0) throw new StealthError(`Odd-length hex string: ${value}`);
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new StealthError(`Invalid hex string: ${value}`);
    bytes[i] = byte;
  }
  return bytes;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) result = (result << 8n) | BigInt(byte);
  return result;
}

function bigIntTo32Bytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let remaining = value;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

/** Errors thrown by this module, so callers can distinguish them from RPC faults. */
export class StealthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StealthError";
  }
}

// ---------------------------------------------------------------------------
// Key generation and encoding
// ---------------------------------------------------------------------------

function keyPairFromPrivate(privateKey: Uint8Array): StealthKeyPair {
  return {
    privateKey: toHex(privateKey),
    publicKey: toHex(secp256k1.getPublicKey(privateKey, true)),
  };
}

/** Fresh spend and view key pairs from the platform CSPRNG. */
export function generateStealthKeys(): StealthKeys {
  return {
    spend: keyPairFromPrivate(secp256k1.utils.randomPrivateKey()),
    view: keyPairFromPrivate(secp256k1.utils.randomPrivateKey()),
  };
}

/** Rebuild a key pair from an imported 32-byte scalar. */
export function importKeyPair(privateKey: string): StealthKeyPair {
  const bytes = fromHex(privateKey);
  if (bytes.length !== 32) {
    throw new StealthError(`Private key must be 32 bytes, received ${bytes.length}.`);
  }
  const scalar = bytesToBigInt(bytes);
  if (scalar === 0n || scalar >= CURVE_ORDER) {
    throw new StealthError("Private key is outside the secp256k1 scalar field.");
  }
  return keyPairFromPrivate(bytes);
}

/** Rebuild both key pairs from imported scalars. */
export function importStealthKeys(spendPrivateKey: string, viewPrivateKey: string): StealthKeys {
  return {
    spend: importKeyPair(spendPrivateKey),
    view: importKeyPair(viewPrivateKey),
  };
}

/** Encode `spendPubKey ‖ viewPubKey` for the ERC-6538 registry. */
export function encodeMetaAddress(spendPublicKey: string, viewPublicKey: string): StealthMetaAddress {
  const spend = fromHex(spendPublicKey);
  const view = fromHex(viewPublicKey);

  if (spend.length !== COMPRESSED_PUBKEY_BYTES || view.length !== COMPRESSED_PUBKEY_BYTES) {
    throw new StealthError(
      `Both keys must be ${COMPRESSED_PUBKEY_BYTES}-byte compressed points.`,
    );
  }

  const encoded = new Uint8Array(META_ADDRESS_BYTES);
  encoded.set(spend, 0);
  encoded.set(view, COMPRESSED_PUBKEY_BYTES);

  return {
    spendPublicKey: toHex(spend),
    viewPublicKey: toHex(view),
    encoded: toHex(encoded),
  };
}

/** Meta-address for a local key set. */
export function metaAddressFromKeys(keys: StealthKeys): StealthMetaAddress {
  return encodeMetaAddress(keys.spend.publicKey, keys.view.publicKey);
}

/** Split a registry entry back into its two public keys, validating both points. */
export function decodeMetaAddress(encoded: string): StealthMetaAddress {
  const bytes = fromHex(encoded);
  if (bytes.length !== META_ADDRESS_BYTES) {
    throw new StealthError(
      `Meta-address must be ${META_ADDRESS_BYTES} bytes, received ${bytes.length}.`,
    );
  }

  const spendPublicKey = toHex(bytes.slice(0, COMPRESSED_PUBKEY_BYTES));
  const viewPublicKey = toHex(bytes.slice(COMPRESSED_PUBKEY_BYTES));

  // Reject malformed points here rather than letting them surface as an opaque
  // failure deep inside the derivation.
  assertValidPoint(spendPublicKey, "spend");
  assertValidPoint(viewPublicKey, "view");

  return { spendPublicKey, viewPublicKey, encoded: toHex(bytes) };
}

function assertValidPoint(publicKey: Hex, label: string): void {
  try {
    secp256k1.ProjectivePoint.fromHex(publicKey.slice(2)).assertValidity();
  } catch {
    throw new StealthError(`Registered ${label} public key is not a valid secp256k1 point.`);
  }
}

// ---------------------------------------------------------------------------
// Shared secret
// ---------------------------------------------------------------------------

/**
 * `h = keccak256(compressed(scalar · point))` — the value both sides derive.
 *
 * Compressed encoding is used on purpose: sender and recipient must hash byte
 * strings that agree exactly, and compression is the ERC-5564 convention.
 */
function sharedSecretHash(scalar: bigint, point: string): Uint8Array {
  const shared = secp256k1.ProjectivePoint.fromHex(point.startsWith("0x") ? point.slice(2) : point)
    .multiply(scalar)
    .toRawBytes(true);
  return fromHex(keccak256(shared));
}

/** Ethereum address of a secp256k1 point: last 20 bytes of keccak(uncompressed body). */
function pointToAddress(point: InstanceType<typeof secp256k1.ProjectivePoint>): Address {
  // Drop the 0x04 prefix — the address is defined over the 64-byte coordinate pair.
  const uncompressed = point.toRawBytes(false).slice(1);
  const hash = keccak256(uncompressed);
  return getAddress(`0x${hash.slice(-40)}`) as Address;
}

// ---------------------------------------------------------------------------
// Sender side
// ---------------------------------------------------------------------------

/**
 * Derive a one-time stealth address for a recipient's meta-address.
 *
 * Call once per transfer. Reusing an ephemeral key across two payments would
 * produce the same stealth address twice and destroy the unlinkability the
 * whole scheme exists to provide.
 *
 * @param metaAddress The recipient's registry entry (66 bytes).
 * @param ephemeralPrivateKey Optional override; supply only for deterministic tests.
 */
export function computeStealthAddress(
  metaAddress: string,
  ephemeralPrivateKey?: string,
): StealthPayment {
  const { spendPublicKey, viewPublicKey } = decodeMetaAddress(metaAddress);

  const ephemeral = ephemeralPrivateKey
    ? fromHex(ephemeralPrivateKey)
    : secp256k1.utils.randomPrivateKey();
  const ephemeralScalar = bytesToBigInt(ephemeral);
  if (ephemeralScalar === 0n || ephemeralScalar >= CURVE_ORDER) {
    throw new StealthError("Ephemeral key is outside the secp256k1 scalar field.");
  }

  // S = r·V, then h = keccak256(S).
  const secretHash = sharedSecretHash(ephemeralScalar, viewPublicKey);
  const tweak = bytesToBigInt(secretHash) % CURVE_ORDER;
  if (tweak === 0n) {
    throw new StealthError("Degenerate shared secret; retry with a new ephemeral key.");
  }

  // P = K + h·G
  const spendPoint = secp256k1.ProjectivePoint.fromHex(spendPublicKey.slice(2));
  const stealthPoint = spendPoint.add(secp256k1.ProjectivePoint.BASE.multiply(tweak));

  const viewTag = secretHash[0] ?? 0;

  return {
    stealthAddress: pointToAddress(stealthPoint),
    ephemeralPublicKey: toHex(secp256k1.getPublicKey(ephemeral, true)),
    viewTag,
    metadata: toHex(Uint8Array.of(viewTag)),
  };
}

// ---------------------------------------------------------------------------
// Recipient side
// ---------------------------------------------------------------------------

/**
 * Test one announcement against the local view key.
 *
 * Returns the derived address when this announcement was meant for us, or
 * `null` otherwise. Only the *view* private key is needed, so this is safe to
 * run without unlocking the spend key.
 *
 * The `viewTag` argument is a fast reject: comparing one byte avoids a point
 * addition plus a keccak for the ~255/256 of announcements addressed to
 * somebody else. Pass `undefined` when an announcement carries no metadata.
 */
export function checkAnnouncement(
  viewPrivateKey: string,
  spendPublicKey: string,
  ephemeralPublicKey: string,
  viewTag?: number,
): Address | null {
  let secretHash: Uint8Array;
  try {
    const viewScalar = bytesToBigInt(fromHex(viewPrivateKey));
    // S = v·R — the same point the sender computed as r·V.
    secretHash = sharedSecretHash(viewScalar, ephemeralPublicKey);
  } catch {
    // A malformed ephemeral key is somebody else's problem, not a scan failure.
    return null;
  }

  if (viewTag !== undefined && secretHash[0] !== viewTag) return null;

  const tweak = bytesToBigInt(secretHash) % CURVE_ORDER;
  if (tweak === 0n) return null;

  try {
    const spendPoint = secp256k1.ProjectivePoint.fromHex(
      spendPublicKey.startsWith("0x") ? spendPublicKey.slice(2) : spendPublicKey,
    );
    return pointToAddress(spendPoint.add(secp256k1.ProjectivePoint.BASE.multiply(tweak)));
  } catch {
    return null;
  }
}

/**
 * Private key controlling a stealth address: `k + h (mod n)`.
 *
 * Requires the spend key, which is the point of the spend/view split — a
 * compromised view key exposes the user's incoming payments but cannot move
 * them.
 */
export function deriveStealthPrivateKey(
  spendPrivateKey: string,
  viewPrivateKey: string,
  ephemeralPublicKey: string,
): Hex {
  const viewScalar = bytesToBigInt(fromHex(viewPrivateKey));
  const secretHash = sharedSecretHash(viewScalar, ephemeralPublicKey);
  const tweak = bytesToBigInt(secretHash) % CURVE_ORDER;

  const spendScalar = bytesToBigInt(fromHex(spendPrivateKey));
  const stealthScalar = (spendScalar + tweak) % CURVE_ORDER;

  if (stealthScalar === 0n) {
    throw new StealthError("Derived stealth key is zero; this announcement is unusable.");
  }

  return toHex(bigIntTo32Bytes(stealthScalar));
}

/**
 * Cross-check that a derived stealth key really controls the expected address.
 * Cheap, and it catches a key/announcement mismatch before funds are moved.
 */
export function stealthPrivateKeyMatches(stealthPrivateKey: string, expected: Address): boolean {
  try {
    const point = secp256k1.ProjectivePoint.fromHex(
      secp256k1.getPublicKey(fromHex(stealthPrivateKey), false),
    );
    return pointToAddress(point).toLowerCase() === expected.toLowerCase();
  } catch {
    return false;
  }
}

/** Read the view tag out of announcement metadata, if present. */
export function viewTagFromMetadata(metadata: string): number | undefined {
  const bytes = metadata && metadata !== "0x" ? fromHex(metadata) : new Uint8Array();
  return bytes.length > 0 ? bytes[0] : undefined;
}

/** Shorten a hex string for display: `0x1234…cdef`. */
export function truncateHex(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 2) return value;
  return `${value.slice(0, lead + 2)}…${value.slice(-tail)}`;
}
