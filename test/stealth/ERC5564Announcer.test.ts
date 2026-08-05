import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const EPHEMERAL_PUBKEY_LENGTH = 33;
const SCHEME_ID = 0n;

function ephemeralPubKey(seed: number): string {
  return new ethers.SigningKey(ethers.zeroPadValue(ethers.toBeHex(seed + 1), 32))
    .compressedPublicKey;
}

describe("ERC5564Announcer", () => {
  async function deploy() {
    const [sender, other] = await ethers.getSigners();
    const announcer = await (await ethers.getContractFactory("ERC5564Announcer")).deploy();
    await announcer.waitForDeployment();
    return { announcer, sender, other };
  }

  it("emits Announcement with the caller and payload", async () => {
    const { announcer, sender } = await loadFixture(deploy);
    const stealthAddress = ethers.Wallet.createRandom().address;
    const pubKey = ephemeralPubKey(1);
    const metadata = "0x2a"; // view tag

    await expect(announcer.connect(sender).announce(SCHEME_ID, stealthAddress, pubKey, metadata))
      .to.emit(announcer, "Announcement")
      .withArgs(SCHEME_ID, stealthAddress, sender.address, pubKey, metadata);
  });

  it("accepts empty metadata", async () => {
    const { announcer, sender } = await loadFixture(deploy);
    const stealthAddress = ethers.Wallet.createRandom().address;

    await expect(
      announcer.connect(sender).announce(SCHEME_ID, stealthAddress, ephemeralPubKey(2), "0x"),
    ).to.emit(announcer, "Announcement");
  });

  it("stores nothing on-chain", async () => {
    const { announcer, sender } = await loadFixture(deploy);
    await announcer
      .connect(sender)
      .announce(SCHEME_ID, ethers.Wallet.createRandom().address, ephemeralPubKey(3), "0x");

    // Slot 0 is the only slot any storage would land in for this contract.
    const slot = await ethers.provider.getStorage(await announcer.getAddress(), 0);
    expect(slot).to.equal(ethers.ZeroHash);
  });

  it("is permissionless — any caller may announce", async () => {
    const { announcer, other } = await loadFixture(deploy);

    await expect(
      announcer
        .connect(other)
        .announce(SCHEME_ID, ethers.Wallet.createRandom().address, ephemeralPubKey(4), "0x"),
    )
      .to.emit(announcer, "Announcement")
      .withArgs(SCHEME_ID, ethers.isAddress, other.address, ephemeralPubKey(4), "0x");
  });

  it("rejects an ephemeral public key that is not a compressed point", async () => {
    const { announcer, sender } = await loadFixture(deploy);
    const uncompressed = ethers.hexlify(ethers.randomBytes(65));

    await expect(
      announcer
        .connect(sender)
        .announce(SCHEME_ID, ethers.Wallet.createRandom().address, uncompressed, "0x"),
    )
      .to.be.revertedWithCustomError(announcer, "InvalidEphemeralPubKeyLength")
      .withArgs(65, EPHEMERAL_PUBKEY_LENGTH);
  });

  it("filters announcements by stealth address", async () => {
    const { announcer, sender } = await loadFixture(deploy);
    const mine = ethers.Wallet.createRandom().address;
    const theirs = ethers.Wallet.createRandom().address;

    await announcer.connect(sender).announce(SCHEME_ID, theirs, ephemeralPubKey(5), "0x");
    await announcer.connect(sender).announce(SCHEME_ID, mine, ephemeralPubKey(6), "0x");
    await announcer.connect(sender).announce(SCHEME_ID, theirs, ephemeralPubKey(7), "0x");

    const logs = await announcer.queryFilter(announcer.filters.Announcement(undefined, mine));
    expect(logs).to.have.lengthOf(1);
    expect(logs[0]!.args.ephemeralPubKey).to.equal(ephemeralPubKey(6));
  });
});
