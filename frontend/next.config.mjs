import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));

// The monorepo root. npm workspaces hoists `next` into the root
// `node_modules/`, so a bundler rooted at `frontend/` cannot resolve it.
const workspaceRoot = path.resolve(projectDir, "..");

const baseAccountStub = path.join(projectDir, "lib", "stubs", "base-account.ts");

/*
 * BUNDLER: webpack, not Turbopack
 * -------------------------------
 * `dev` and `build` pass `--webpack` explicitly (see package.json). Next 16
 * defaults to Turbopack, and everything here works under it *except* one thing:
 * Turbopack's `resolveAlias` does not intercept imports originating inside
 * `node_modules`, and this build needs exactly that.
 *
 * The chain is: RainbowKit's package index statically imports the Base wallet
 * connector from @wagmi/connectors, which imports @base-org/account, which
 * depends on @coinbase/cdp-sdk, which statically imports four @x402/* packages
 * declared as *optional* peer dependencies — so npm does not install them and
 * the build fails on fourteen unresolvable specifiers under a Solana payments
 * code path.
 *
 * webpack's `resolve.alias` does intercept it, so a single alias to a stub cuts
 * the whole subtree. See lib/stubs/base-account.ts for why that is safe.
 *
 * The alternatives were worse: installing four unused Solana packages into an
 * EVM privacy app, or stubbing all fourteen leaf specifiers individually.
 * Revisit if Turbopack gains node_modules alias support.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The template shipped with `typescript.ignoreBuildErrors: true`. It is
  // removed deliberately: this codebase handles private keys and proof
  // calldata, where a silently ignored type error is the kind of bug that
  // costs funds. `npm run typecheck` must stay clean.
  images: {
    unoptimized: true,
  },

  turbopack: {
    // Not the active bundler (see above), but Next requires a `turbopack` key
    // alongside a `webpack` key, and pinning the root stops Turbopack's
    // lockfile-based inference from walking past this repository entirely.
    root: workspaceRoot,
  },

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@base-org/account": baseAccountStub,
    };

    if (!isServer) {
      // snarkjs serves Node and the browser from one entry point, so a bundler
      // resolves its Node-only imports even though the browser code path never
      // reaches them. Stubbing them keeps the client bundle building.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        readline: false,
        worker_threads: false,
      };
    }

    return config;
  },
};

export default nextConfig;
