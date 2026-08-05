import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";
import type { Abi, Address } from "viem";

import { stealthRegistryAbi } from "./abis/stealthRegistry";
import { stealthAnnouncerAbi } from "./abis/stealthAnnouncer";
import { ownershipVerifierAbi } from "./abis/ownershipVerifier";
import { complianceModuleAbi } from "./abis/complianceModule";
import {
  chainId,
  contractAddresses,
  requireContract,
  rpcUrl,
  type ContractName,
} from "./env";
import { defaultRpcUrl } from "./chains";

/**
 * Central contract registry.
 *
 * Two access styles coexist deliberately:
 *
 *   `contractConfig(name)` — an `{ address, abi }` descriptor for wagmi hooks.
 *     Everything touching the user's wallet goes through here, per the
 *     convention that wallet interaction never bypasses wagmi.
 *
 *   `readOnlyContract(name)` — an ethers.js `Contract` bound to a plain RPC
 *     provider. Used for bulk historical log queries (the announcement
 *     scanner), where ethers' `queryFilter` over an explicit block range is a
 *     better fit than the hook-shaped wagmi API. No signer is ever attached.
 */

export const abis = {
  stealthRegistry: stealthRegistryAbi,
  stealthAnnouncer: stealthAnnouncerAbi,
  ownershipVerifier: ownershipVerifierAbi,
  complianceModule: complianceModuleAbi,
} as const;

export type ContractConfig<TName extends ContractName> = {
  address: Address;
  abi: (typeof abis)[TName];
  chainId: number;
};

/**
 * Descriptor for wagmi's `useReadContract` / `useWriteContract`.
 * Throws when the address is unset — gate on `isContractConfigured` first.
 */
export function contractConfig<TName extends ContractName>(name: TName): ContractConfig<TName> {
  return {
    address: requireContract(name),
    abi: abis[name],
    chainId,
  };
}

/**
 * Same as `contractConfig` but yields `undefined` instead of throwing, so a
 * component can pass it straight into a disabled query.
 */
export function optionalContractConfig<TName extends ContractName>(
  name: TName,
): ContractConfig<TName> | undefined {
  return contractAddresses[name] ? contractConfig(name) : undefined;
}

let cachedProvider: JsonRpcProvider | undefined;

/** Read-only ethers provider, memoised across calls. */
export function readOnlyProvider(): JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new JsonRpcProvider(rpcUrl ?? defaultRpcUrl(chainId), chainId, {
      staticNetwork: true,
    });
  }
  return cachedProvider;
}

/** An ethers `Contract` with no signer. Writes through this will fail by design. */
export function readOnlyContract(name: ContractName): Contract {
  return new Contract(
    requireContract(name),
    abis[name] as unknown as InterfaceAbi,
    readOnlyProvider(),
  );
}

/** Widened ABI for helpers that decode errors generically. */
export const allAbis: Abi = [
  ...stealthRegistryAbi,
  ...stealthAnnouncerAbi,
  ...ownershipVerifierAbi,
  ...complianceModuleAbi,
] as unknown as Abi;
