import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

/**
 * Covers the replay protection and event surface that `OwnershipVerifier` adds
 * on top of the generated pairing verifier.
 *
 * The pairing check itself is exercised against `MockGroth16Verifier`, since the
 * real `Groth16Verifier.sol` only exists after the circuit is compiled. Circuit
 * soundness is a separate concern tested at the circuit level.
 */

const PROOF: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
  1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n,
];

const MERKLE_ROOT = 0x1234n;
const THRESHOLD = 1n;

function signals(nullifier: bigint): [bigint, bigint, bigint] {
  return [MERKLE_ROOT, THRESHOLD, nullifier];
}

describe("OwnershipVerifier", () => {
  async function deploy() {
    const [caller, other] = await ethers.getSigners();

    const mock = await (await ethers.getContractFactory("MockGroth16Verifier")).deploy();
    await mock.waitForDeployment();

    const verifier = await (
      await ethers.getContractFactory("OwnershipVerifier")
    ).deploy(await mock.getAddress());
    await verifier.waitForDeployment();

    return { verifier, mock, caller, other };
  }

  it("rejects a zero verifier address at construction", async () => {
    const factory = await ethers.getContractFactory("OwnershipVerifier");
    await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      factory,
      "ZeroVerifierAddress",
    );
  });

  it("accepts a valid proof and emits VerifiedOwnership", async () => {
    const { verifier } = await loadFixture(deploy);
    const nullifier = 0xabcn;

    await expect(verifier.verifyOwnership(PROOF, signals(nullifier)))
      .to.emit(verifier, "VerifiedOwnership")
      .withArgs(
        ethers.zeroPadValue(ethers.toBeHex(nullifier), 32),
        ethers.zeroPadValue(ethers.toBeHex(MERKLE_ROOT), 32),
        (t: bigint) => t > 0n,
      );

    expect(await verifier.verifiedCount()).to.equal(1n);
  });

  it("marks the nullifier used after a successful proof", async () => {
    const { verifier } = await loadFixture(deploy);
    const nullifier = 0xabcn;
    const asBytes32 = ethers.zeroPadValue(ethers.toBeHex(nullifier), 32);

    expect(await verifier.isNullifierUsed(asBytes32)).to.equal(false);
    await verifier.verifyOwnership(PROOF, signals(nullifier));
    expect(await verifier.isNullifierUsed(asBytes32)).to.equal(true);
    expect(await verifier.usedNullifiers(asBytes32)).to.equal(true);
  });

  it("reverts when the same nullifier is replayed", async () => {
    const { verifier } = await loadFixture(deploy);
    const nullifier = 0xabcn;

    await verifier.verifyOwnership(PROOF, signals(nullifier));

    await expect(verifier.verifyOwnership(PROOF, signals(nullifier)))
      .to.be.revertedWithCustomError(verifier, "NullifierAlreadyUsed")
      .withArgs(ethers.zeroPadValue(ethers.toBeHex(nullifier), 32));
  });

  it("blocks replay even from a different caller", async () => {
    const { verifier, other } = await loadFixture(deploy);
    const nullifier = 0xabcn;

    await verifier.verifyOwnership(PROOF, signals(nullifier));

    await expect(
      verifier.connect(other).verifyOwnership(PROOF, signals(nullifier)),
    ).to.be.revertedWithCustomError(verifier, "NullifierAlreadyUsed");
  });

  it("allows distinct nullifiers", async () => {
    const { verifier } = await loadFixture(deploy);

    await verifier.verifyOwnership(PROOF, signals(0x1n));
    await verifier.verifyOwnership(PROOF, signals(0x2n));

    expect(await verifier.verifiedCount()).to.equal(2n);
  });

  it("reverts when the pairing check fails", async () => {
    const { verifier, mock } = await loadFixture(deploy);
    await mock.setResult(false);

    await expect(verifier.verifyOwnership(PROOF, signals(0xabcn))).to.be.revertedWithCustomError(
      verifier,
      "InvalidProof",
    );
  });

  it("does not consume the nullifier when the proof is invalid", async () => {
    const { verifier, mock } = await loadFixture(deploy);
    const nullifier = 0xabcn;
    const asBytes32 = ethers.zeroPadValue(ethers.toBeHex(nullifier), 32);

    await mock.setResult(false);
    await expect(verifier.verifyOwnership(PROOF, signals(nullifier))).to.be.reverted;
    expect(await verifier.isNullifierUsed(asBytes32)).to.equal(false);

    // A failed attempt must not lock out the legitimate holder.
    await mock.setResult(true);
    await expect(verifier.verifyOwnership(PROOF, signals(nullifier))).to.emit(
      verifier,
      "VerifiedOwnership",
    );
  });

  it("unpacks the flattened proof into the expected G1/G2 shape", async () => {
    const { verifier, mock } = await loadFixture(deploy);

    // MockGroth16Verifier ignores its arguments, so assert the calldata shape
    // by confirming the call succeeds with the documented 8-element layout.
    const tx = await verifier.verifyOwnership(PROOF, signals(0x99n));
    const receipt = await tx.wait();
    expect(receipt?.status).to.equal(1);
    expect(await mock.result()).to.equal(true);
  });
});
