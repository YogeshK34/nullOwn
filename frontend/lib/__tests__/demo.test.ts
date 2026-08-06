import { describe, expect, it } from "vitest";

import { demoKeysFor, demoMetaAddressFor, DEMO_RECIPIENT, DEMO_PROOF_POINTS } from "@/lib/demo";
import {
  computeStealthAddress,
  deriveStealthPrivateKey,
  metaAddressFromKeys,
  stealthPrivateKeyMatches,
  generateStealthKeys,
} from "@/lib/stealth";
import { BN254_FIELD_MODULUS } from "@/lib/poseidon";

describe("demo fixtures", () => {
  it("derives a decodable meta-address for any account", () => {
    const meta = demoMetaAddressFor(DEMO_RECIPIENT);
    expect(meta.encoded).toMatch(/^0x[0-9a-f]{132}$/i);
    expect(demoMetaAddressFor(DEMO_RECIPIENT).encoded).toBe(meta.encoded);
  });

  it("gives different accounts different meta-addresses", () => {
    expect(demoMetaAddressFor(DEMO_RECIPIENT).encoded).not.toBe(
      demoMetaAddressFor("0x1111111111111111111111111111111111111111").encoded,
    );
  });

  it("demo keys are usable as real stealth keys", () => {
    const keys = demoKeysFor(DEMO_RECIPIENT);
    const payment = computeStealthAddress(metaAddressFromKeys(keys).encoded);
    const derived = deriveStealthPrivateKey(
      keys.spend.privateKey,
      keys.view.privateKey,
      payment.ephemeralPublicKey,
    );
    expect(stealthPrivateKeyMatches(derived, payment.stealthAddress)).toBe(true);
  });

  it("the scanner's synthesised payments really belong to the user's keys", () => {
    const keys = generateStealthKeys();
    const encoded = metaAddressFromKeys(keys).encoded;
    for (let i = 0; i < 3; i++) {
      const payment = computeStealthAddress(encoded);
      const derived = deriveStealthPrivateKey(
        keys.spend.privateKey,
        keys.view.privateKey,
        payment.ephemeralPublicKey,
      );
      expect(stealthPrivateKeyMatches(derived, payment.stealthAddress)).toBe(true);
    }
  });

  it("fabricated proof points are inside the BN254 scalar field", () => {
    expect(DEMO_PROOF_POINTS).toHaveLength(8);
    for (const point of DEMO_PROOF_POINTS) {
      expect(point).toBeGreaterThan(0n);
      expect(point).toBeLessThan(BN254_FIELD_MODULUS);
    }
  });
});
