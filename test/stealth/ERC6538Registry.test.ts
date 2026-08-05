import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const META_ADDRESS_LENGTH = 66;

function metaAddress(seed: number): string {
  const spend = new ethers.SigningKey(ethers.zeroPadValue(ethers.toBeHex(seed + 1), 32))
    .compressedPublicKey;
  const view = new ethers.SigningKey(ethers.zeroPadValue(ethers.toBeHex(seed + 1000), 32))
    .compressedPublicKey;
  return ethers.concat([spend, view]);
}

describe("ERC6538Registry", () => {
  async function deploy() {
    const [alice, bob] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory("ERC6538Registry")).deploy();
    await registry.waitForDeployment();
    return { registry, alice, bob };
  }

  it("stores a meta-address and emits StealthMetaAddressSet", async () => {
    const { registry, alice } = await loadFixture(deploy);
    const meta = metaAddress(1);

    await expect(registry.connect(alice).registerKeys(meta))
      .to.emit(registry, "StealthMetaAddressSet")
      .withArgs(alice.address, meta);

    expect(await registry.getStealthMetaAddress(alice.address)).to.equal(meta);
    expect(await registry.isRegistered(alice.address)).to.equal(true);
  });

  it("returns empty bytes and false for an unregistered account", async () => {
    const { registry, bob } = await loadFixture(deploy);

    expect(await registry.getStealthMetaAddress(bob.address)).to.equal("0x");
    expect(await registry.isRegistered(bob.address)).to.equal(false);
  });

  it("lets a registrant rotate their meta-address", async () => {
    const { registry, alice } = await loadFixture(deploy);
    const first = metaAddress(1);
    const second = metaAddress(2);

    await registry.connect(alice).registerKeys(first);
    await registry.connect(alice).registerKeys(second);

    expect(await registry.getStealthMetaAddress(alice.address)).to.equal(second);
  });

  it("keeps registrations isolated per account", async () => {
    const { registry, alice, bob } = await loadFixture(deploy);
    const aliceMeta = metaAddress(1);
    const bobMeta = metaAddress(2);

    await registry.connect(alice).registerKeys(aliceMeta);
    await registry.connect(bob).registerKeys(bobMeta);

    expect(await registry.getStealthMetaAddress(alice.address)).to.equal(aliceMeta);
    expect(await registry.getStealthMetaAddress(bob.address)).to.equal(bobMeta);
  });

  it("rejects a meta-address of the wrong length", async () => {
    const { registry, alice } = await loadFixture(deploy);
    const tooShort = ethers.hexlify(ethers.randomBytes(33));

    await expect(registry.connect(alice).registerKeys(tooShort))
      .to.be.revertedWithCustomError(registry, "InvalidMetaAddressLength")
      .withArgs(33, META_ADDRESS_LENGTH);
  });

  it("rejects an empty meta-address", async () => {
    const { registry, alice } = await loadFixture(deploy);

    await expect(registry.connect(alice).registerKeys("0x"))
      .to.be.revertedWithCustomError(registry, "InvalidMetaAddressLength")
      .withArgs(0, META_ADDRESS_LENGTH);
  });
});
