import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const REGULATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("REGULATOR_ROLE"));
const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

const SCOPE_EU = ethers.encodeBytes32String("EU-MiCA");
const SCOPE_US = ethers.encodeBytes32String("US-SEC");

const ENCRYPTED = "0xdeadbeefcafe";

describe("ComplianceModule", () => {
  async function deploy() {
    const [admin, regulator, outsider] = await ethers.getSigners();

    const compliance = await (
      await ethers.getContractFactory("ComplianceModule")
    ).deploy(admin.address);
    await compliance.waitForDeployment();

    await compliance.connect(admin).grantRole(REGULATOR_ROLE, regulator.address);

    return { compliance, admin, regulator, outsider };
  }

  describe("roles", () => {
    it("grants the deployer-designated admin DEFAULT_ADMIN_ROLE", async () => {
      const { compliance, admin } = await loadFixture(deploy);
      expect(await compliance.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
    });

    it("reports regulator status", async () => {
      const { compliance, regulator, outsider } = await loadFixture(deploy);
      expect(await compliance.isRegulator(regulator.address)).to.equal(true);
      expect(await compliance.isRegulator(outsider.address)).to.equal(false);
    });

    it("lets the admin revoke a regulator", async () => {
      const { compliance, admin, regulator } = await loadFixture(deploy);
      await compliance.connect(admin).revokeRole(REGULATOR_ROLE, regulator.address);

      expect(await compliance.isRegulator(regulator.address)).to.equal(false);
      await expect(compliance.connect(regulator).requestAudit(SCOPE_EU)).to.be.reverted;
    });

    it("stops a non-admin from granting the regulator role", async () => {
      const { compliance, outsider } = await loadFixture(deploy);
      await expect(compliance.connect(outsider).grantRole(REGULATOR_ROLE, outsider.address)).to.be
        .reverted;
    });
  });

  describe("requestAudit", () => {
    it("logs the request publicly and returns sequential ids", async () => {
      const { compliance, regulator } = await loadFixture(deploy);

      await expect(compliance.connect(regulator).requestAudit(SCOPE_EU))
        .to.emit(compliance, "AuditRequested")
        .withArgs(0, regulator.address, SCOPE_EU);

      await expect(compliance.connect(regulator).requestAudit(SCOPE_US))
        .to.emit(compliance, "AuditRequested")
        .withArgs(1, regulator.address, SCOPE_US);

      expect(await compliance.auditCount()).to.equal(2n);
    });

    it("records the requesting regulator, scope and timestamp", async () => {
      const { compliance, regulator } = await loadFixture(deploy);
      await compliance.connect(regulator).requestAudit(SCOPE_EU);

      const audit = await compliance.getAudit(0);
      expect(audit.regulator).to.equal(regulator.address);
      expect(audit.scope).to.equal(SCOPE_EU);
      expect(audit.timestamp).to.be.greaterThan(0n);
      expect(audit.fulfilled).to.equal(false);
      expect(audit.encryptedResponse).to.equal("0x");
    });

    it("rejects a caller without REGULATOR_ROLE", async () => {
      const { compliance, outsider } = await loadFixture(deploy);
      await expect(compliance.connect(outsider).requestAudit(SCOPE_EU)).to.be.reverted;
    });

    it("rejects even the admin unless they also hold REGULATOR_ROLE", async () => {
      const { compliance, admin } = await loadFixture(deploy);
      await expect(compliance.connect(admin).requestAudit(SCOPE_EU)).to.be.reverted;
    });
  });

  describe("fulfillAudit", () => {
    it("stores the ciphertext and emits AuditFulfilled", async () => {
      const { compliance, admin, regulator } = await loadFixture(deploy);
      await compliance.connect(regulator).requestAudit(SCOPE_EU);

      await expect(compliance.connect(admin).fulfillAudit(0, ENCRYPTED))
        .to.emit(compliance, "AuditFulfilled")
        .withArgs(0, (t: bigint) => t > 0n);

      const audit = await compliance.getAudit(0);
      expect(audit.encryptedResponse).to.equal(ENCRYPTED);
      expect(audit.fulfilled).to.equal(true);
    });

    it("rejects a non-admin caller", async () => {
      const { compliance, regulator } = await loadFixture(deploy);
      await compliance.connect(regulator).requestAudit(SCOPE_EU);

      await expect(compliance.connect(regulator).fulfillAudit(0, ENCRYPTED)).to.be.reverted;
    });

    it("rejects an unknown audit id", async () => {
      const { compliance, admin } = await loadFixture(deploy);

      await expect(compliance.connect(admin).fulfillAudit(0, ENCRYPTED))
        .to.be.revertedWithCustomError(compliance, "UnknownAudit")
        .withArgs(0);
    });

    it("rejects an empty response", async () => {
      const { compliance, admin, regulator } = await loadFixture(deploy);
      await compliance.connect(regulator).requestAudit(SCOPE_EU);

      await expect(
        compliance.connect(admin).fulfillAudit(0, "0x"),
      ).to.be.revertedWithCustomError(compliance, "EmptyResponse");
    });

    it("keeps audit records immutable once fulfilled", async () => {
      const { compliance, admin, regulator } = await loadFixture(deploy);
      await compliance.connect(regulator).requestAudit(SCOPE_EU);
      await compliance.connect(admin).fulfillAudit(0, ENCRYPTED);

      await expect(compliance.connect(admin).fulfillAudit(0, "0xfeed"))
        .to.be.revertedWithCustomError(compliance, "AuditAlreadyFulfilled")
        .withArgs(0);

      expect((await compliance.getAudit(0)).encryptedResponse).to.equal(ENCRYPTED);
    });
  });

  describe("getAudit", () => {
    it("reverts for an id that was never opened", async () => {
      const { compliance } = await loadFixture(deploy);
      await expect(compliance.getAudit(7))
        .to.be.revertedWithCustomError(compliance, "UnknownAudit")
        .withArgs(7);
    });
  });
});
