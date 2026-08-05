/**
 * Build stub for `@base-org/account`.
 *
 * Why this exists
 * ---------------
 * `@wagmi/connectors` reaches `@base-org/account` from the Base wallet
 * connector, which RainbowKit re-exports from its package index. That package
 * depends on `@coinbase/cdp-sdk`, which in turn statically imports four
 * `@x402/*` packages declared as *optional* peer dependencies — so npm does not
 * install them, and the bundler cannot resolve them. The build fails on
 * fourteen unresolvable specifiers under a Solana payments code path.
 *
 * NullOwn is an EVM testnet privacy layer. It does not offer the Base wallet
 * (see the explicit `wallets` list in `lib/wagmi.ts`), so none of that subtree
 * is reachable at runtime. Aliasing the root here cuts it in one place instead
 * of stubbing every leaf.
 *
 * Safety
 * ------
 * The real module is loaded through a dynamic `import()` inside the connector's
 * `getProvider()`, which only runs if a user selects the Base wallet. Since the
 * wallet is not offered, that never happens. The throw below exists so that if
 * someone does add `baseAccount` to the wallet list later, they get this
 * explanation rather than a confusing undefined-is-not-a-function.
 */

const REASON =
  "The Base wallet is not enabled in NullOwn. @base-org/account is aliased to a " +
  "build stub in next.config.mjs because its optional @x402/* peer dependencies " +
  "are not installed. To enable it: install @x402/core, @x402/evm, @x402/extensions " +
  "and @x402/svm, remove the resolveAlias entry, and add baseAccount to the wallet " +
  "list in lib/wagmi.ts.";

export function createBaseAccountSDK(): never {
  throw new Error(REASON);
}

export default { createBaseAccountSDK };
