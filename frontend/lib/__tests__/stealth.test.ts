import { describe, it, expect } from "vitest";

import {
  generateStealthKeys,
  importStealthKeys,
  importKeyPair,
  metaAddressFromKeys,
  encodeMetaAddress,
  decodeMetaAddress,
  computeStealthAddress,
  checkAnnouncement,
  deriveStealthPrivateKey,
  stealthPrivateKeyMatches,
  viewTagFromMetadata,
  truncateHex,
  StealthError,
  COMPRESSED_PUBKEY_BYTES,
  META_ADDRESS_BYTES,
} from "../stealth";

/**
 * These tests exercise the actual elliptic curve math, not mocks. The central
 * property is the Diffie–Hellman agreement: the sender's `r·V` and the
 * recipient's `v·R` must produce the same stealth address, and the recipient
 * must end up holding its private key.
 */

describe("key generation", () => {
  it("produces distinct spend and view keys", () => {
    const keys = generateStealthKeys();

    expect(keys.spend.privateKey).not.toBe(keys.view.privateKey);
    expect(keys.spend.publicKey).not.toBe(keys.view.publicKey);
  });

  it("produces 32-byte scalars and 33-byte compressed points", () => {
    const keys = generateStealthKeys();

    expect(keys.spend.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(keys.spend.publicKey).toMatch(/^0x[0-9a-f]{66}$/);
    expect((keys.view.publicKey.length - 2) / 2).toBe(COMPRESSED_PUBKEY_BYTES);
  });

  it("is not deterministic across calls", () => {
    expect(generateStealthKeys().spend.privateKey).not.toBe(
      generateStealthKeys().spend.privateKey,
    );
  });

  it("round-trips through import", () => {
    const keys = generateStealthKeys();
    const imported = importStealthKeys(keys.spend.privateKey, keys.view.privateKey);

    expect(imported.spend.publicKey).toBe(keys.spend.publicKey);
    expect(imported.view.publicKey).toBe(keys.view.publicKey);
  });

  it("rejects a key of the wrong length", () => {
    expect(() => importKeyPair("0x1234")).toThrow(StealthError);
  });

  it("rejects the zero scalar", () => {
    expect(() => importKeyPair(`0x${"00".repeat(32)}`)).toThrow(StealthError);
  });

  it("rejects a scalar at or above the curve order", () => {
    const order = "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141";
    expect(() => importKeyPair(`0x${order}`)).toThrow(StealthError);
  });
});

describe("meta-address encoding", () => {
  it("concatenates spend and view keys to 66 bytes", () => {
    const keys = generateStealthKeys();
    const meta = metaAddressFromKeys(keys);

    expect((meta.encoded.length - 2) / 2).toBe(META_ADDRESS_BYTES);
    expect(meta.encoded.startsWith(keys.spend.publicKey)).toBe(true);
    expect(meta.encoded.endsWith(keys.view.publicKey.slice(2))).toBe(true);
  });

  it("round-trips through decode", () => {
    const keys = generateStealthKeys();
    const decoded = decodeMetaAddress(metaAddressFromKeys(keys).encoded);

    expect(decoded.spendPublicKey).toBe(keys.spend.publicKey);
    expect(decoded.viewPublicKey).toBe(keys.view.publicKey);
  });

  it("rejects a meta-address of the wrong length", () => {
    expect(() => decodeMetaAddress("0xdeadbeef")).toThrow(StealthError);
  });

  it("rejects a well-sized meta-address that is not on the curve", () => {
    expect(() => decodeMetaAddress(`0x${"11".repeat(META_ADDRESS_BYTES)}`)).toThrow(StealthError);
  });

  it("rejects public keys that are not compressed points", () => {
    expect(() => encodeMetaAddress("0x1234", "0x5678")).toThrow(StealthError);
  });
});

describe("stealth address derivation", () => {
  it("lets the recipient recover the sender's address (ECDH agreement)", () => {
    const recipient = generateStealthKeys();
    const meta = metaAddressFromKeys(recipient);

    const payment = computeStealthAddress(meta.encoded);

    const recovered = checkAnnouncement(
      recipient.view.privateKey,
      recipient.spend.publicKey,
      payment.ephemeralPublicKey,
      payment.viewTag,
    );

    expect(recovered).toBe(payment.stealthAddress);
  });

  it("gives the recipient the private key for that address", () => {
    const recipient = generateStealthKeys();
    const payment = computeStealthAddress(metaAddressFromKeys(recipient).encoded);

    const stealthPrivateKey = deriveStealthPrivateKey(
      recipient.spend.privateKey,
      recipient.view.privateKey,
      payment.ephemeralPublicKey,
    );

    expect(stealthPrivateKeyMatches(stealthPrivateKey, payment.stealthAddress)).toBe(true);
  });

  it("produces a different address for every payment", () => {
    const recipient = generateStealthKeys();
    const meta = metaAddressFromKeys(recipient).encoded;

    const addresses = new Set(
      Array.from({ length: 10 }, () => computeStealthAddress(meta).stealthAddress),
    );

    expect(addresses.size).toBe(10);
  });

  it("never reveals the recipient's own address", () => {
    const recipient = generateStealthKeys();
    const payment = computeStealthAddress(metaAddressFromKeys(recipient).encoded);

    expect(payment.stealthAddress).not.toBe(recipient.spend.publicKey);
    expect(payment.ephemeralPublicKey).not.toBe(recipient.view.publicKey);
  });

  it("is deterministic given a fixed ephemeral key", () => {
    const recipient = generateStealthKeys();
    const meta = metaAddressFromKeys(recipient).encoded;
    const ephemeral = generateStealthKeys().spend.privateKey;

    const first = computeStealthAddress(meta, ephemeral);
    const second = computeStealthAddress(meta, ephemeral);

    expect(first.stealthAddress).toBe(second.stealthAddress);
    expect(first.viewTag).toBe(second.viewTag);
  });
});

describe("scanning", () => {
  it("ignores an announcement addressed to somebody else", () => {
    const me = generateStealthKeys();
    const someoneElse = generateStealthKeys();

    const payment = computeStealthAddress(metaAddressFromKeys(someoneElse).encoded);

    const recovered = checkAnnouncement(
      me.view.privateKey,
      me.spend.publicKey,
      payment.ephemeralPublicKey,
      payment.viewTag,
    );

    // Either the view tag rejects it outright, or the derived address differs.
    expect(recovered).not.toBe(payment.stealthAddress);
  });

  it("still matches when no view tag is supplied", () => {
    const recipient = generateStealthKeys();
    const payment = computeStealthAddress(metaAddressFromKeys(recipient).encoded);

    const recovered = checkAnnouncement(
      recipient.view.privateKey,
      recipient.spend.publicKey,
      payment.ephemeralPublicKey,
      undefined,
    );

    expect(recovered).toBe(payment.stealthAddress);
  });

  it("rejects on a mismatched view tag without doing the full derivation", () => {
    const recipient = generateStealthKeys();
    const payment = computeStealthAddress(metaAddressFromKeys(recipient).encoded);

    const wrongTag = (payment.viewTag + 1) % 256;
    const recovered = checkAnnouncement(
      recipient.view.privateKey,
      recipient.spend.publicKey,
      payment.ephemeralPublicKey,
      wrongTag,
    );

    expect(recovered).toBeNull();
  });

  it("returns null for a malformed ephemeral key rather than throwing", () => {
    const recipient = generateStealthKeys();

    expect(
      checkAnnouncement(recipient.view.privateKey, recipient.spend.publicKey, "0xdead", 0),
    ).toBeNull();
  });

  it("cannot spend with the view key alone", () => {
    const recipient = generateStealthKeys();
    const decoy = generateStealthKeys();
    const payment = computeStealthAddress(metaAddressFromKeys(recipient).encoded);

    // Correct view key, wrong spend key: detection succeeds, spending does not.
    const wrongKey = deriveStealthPrivateKey(
      decoy.spend.privateKey,
      recipient.view.privateKey,
      payment.ephemeralPublicKey,
    );

    expect(stealthPrivateKeyMatches(wrongKey, payment.stealthAddress)).toBe(false);
  });
});

describe("helpers", () => {
  it("reads the view tag out of metadata", () => {
    expect(viewTagFromMetadata("0x2a")).toBe(0x2a);
    expect(viewTagFromMetadata("0x")).toBeUndefined();
    expect(viewTagFromMetadata("")).toBeUndefined();
  });

  it("emits metadata whose first byte is the view tag", () => {
    const recipient = generateStealthKeys();
    const payment = computeStealthAddress(metaAddressFromKeys(recipient).encoded);

    expect(viewTagFromMetadata(payment.metadata)).toBe(payment.viewTag);
  });

  it("truncates long hex and leaves short hex alone", () => {
    expect(truncateHex(`0x${"ab".repeat(20)}`)).toBe("0xababab…abab");
    expect(truncateHex("0x1234")).toBe("0x1234");
  });
});
