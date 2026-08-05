# NullOwn Implementation Report

Transformation of the `skydda-ai-sentinel` UI template into the NullOwn system
described in [ARCHITECTURE.md](./ARCHITECTURE.md).

**Verification status — all checks run and passing**

| Check | Result |
|---|---|
| `npm run compile` | 14 Solidity files compiled |
| `npm test` (contracts) | **35 / 35 passing** |
| `npm test` (frontend `lib/`) | **63 / 63 passing** |
| `npm run typecheck` (frontend, strict) | clean, exit 0 |
| `npm run build` (frontend) | **exit 0** — all 5 routes built |

No step was skipped and nothing is reported as working that was not actually
run. Details of the three build issues found and fixed are in
[Verification](#verification).

---

## Completed

### Repository structure

- ✅ Restructured to the ARCHITECTURE.md §7 layout — `contracts/`, `circuits/`,
  `scripts/`, `test/`, `frontend/`, `docs/`
- ✅ UI template moved `skydda-ai-sentinel/` → `frontend/` (all 96 files verified
  byte-identical after the move; no file contents changed by the move itself)
- ✅ Root npm workspace, `hardhat.config.ts`, `tsconfig.json`, `.env.example`,
  `.gitignore`

### Smart contracts

- ✅ `IStealthRegistry`, `IStealthAnnouncer`, `IOwnershipVerifier` — exactly the
  interfaces specified in ARCHITECTURE.md §8
- ✅ `IGroth16Verifier` — interface of the SnarkJS-generated verifier
- ✅ `ERC6538Registry` — stealth meta-address registry with length validation
- ✅ `ERC5564Announcer` — stateless announcement channel
- ✅ `OwnershipVerifier` — proof submission, `mapping(bytes32 => bool) public
  usedNullifiers`, revert on reuse, `VerifiedOwnership` event
- ✅ `ComplianceModule` — OpenZeppelin AccessControl v5, `REGULATOR_ROLE`,
  append-only audit log
- ✅ Custom errors throughout, NatSpec on all public/external functions, events
  on every state change (ARCHITECTURE.md §14)

### ZK circuits

- ✅ `ownership_proof.circom` — depth-20, three public signals in the fixed
  order `[merkleRoot, threshold, nullifier]`
- ✅ `merkle_inclusion.circom` — Poseidon Merkle inclusion with a constrained
  boolean path selector
- ✅ `nullifier.circom` — `Poseidon(spendKeyHash, tokenId)`
- ✅ `poseidon/poseidon.circom` — single-point Poseidon adapter
- ✅ Range checks on `quantity` and `threshold` before the comparator, without
  which `GreaterEqThan` is unsound

### Scripts and tests

- ✅ `scripts/deploy.ts` — deploys all five contracts, writes
  `deployments/<network>.json`, mirrors ABIs into the frontend, prints the
  `NEXT_PUBLIC_*` block
- ✅ `scripts/setup-zkeys.ts` — full circom → ptau → Groth16 → verifier pipeline
- ✅ `scripts/seed-registry.ts` — registers a development meta-address
- ✅ 35 contract tests across stealth, zk and compliance

### Frontend — foundation

- ✅ `lib/env.ts` — validated `NEXT_PUBLIC_*` access with per-contract gating
- ✅ `lib/chains.ts` — Sepolia + Mumbai, explorer URL helpers
- ✅ `lib/wagmi.ts` — wagmi v2 + RainbowKit, SSR with cookie storage
- ✅ `lib/contracts.ts` — typed wagmi descriptors plus a signer-less ethers v6
  contract for bulk log queries
- ✅ `lib/abis/*.ts` — four `as const` ABIs for full viem type inference
- ✅ `app/providers.tsx` — WagmiProvider → QueryClientProvider →
  RainbowKitProvider, themed to the existing palette
- ✅ `app/layout.tsx` — `cookieToInitialState` hydration

### Frontend — stealth module

- ✅ `lib/stealth.ts` — secp256k1 ECDH, key generation/import, meta-address
  encode/decode, sender-side derivation, view-tag filtered scanning, stealth
  private key derivation, key/address cross-check
- ✅ `lib/keystore.ts` — AES-256-GCM under PBKDF2-SHA256 (600k iterations),
  non-extractable derived key
- ✅ `hooks/useStealthKeys`, `useStealthRegistry`, `useStealthAnnouncer`,
  `useAnnouncementScanner` (chunked log queries with progress and cancellation)
- ✅ **25 unit tests** proving the ECDH round-trip: sender and recipient derive
  the same address, the recipient holds its private key, and a view key alone
  cannot spend

### Frontend — ZK module

- ✅ `lib/poseidon.ts` — circomlibjs wrapper with field reduction
- ✅ `lib/merkle.ts` — sparse Poseidon Merkle tree with precomputed zero hashes,
  inclusion proofs, local verification
- ✅ `lib/zkProver.ts` — browser-only proving, artifact probing, Solidity
  encoding including the G2 coordinate swap, off-chain verification
- ✅ `hooks/useOwnershipProof` — staged pipeline with on-chain nullifier
  pre-check
- ✅ **38 unit tests** over Merkle construction, proof/verification, tamper
  detection, nullifier derivation and calldata encoding

### Frontend — compliance module

- ✅ `hooks/useCompliance` — role reads, audit requests, fulfilment, role
  management, full audit log
- ✅ Uses `getAudit` rather than the `auditLog` mapping getter, which omits
  `encryptedResponse` (Solidity skips array members in struct getters)

### Frontend — UI

- ✅ Landing page content renamed to NullOwn throughout. **No design change**:
  palette, typography, spacing, layout hierarchy, framer-motion animations and
  responsive behaviour are untouched
- ✅ Real routes wired into the nav and CTAs
- ✅ `/stealth`, `/prove`, `/compliance` built from the template's own design
  tokens — `bg-zinc-900`, `border-zinc-700/30`, amber-500 accent, square corners
  (`--radius: 0px`), Host Grotesk, word-by-word blur-in headings
- ✅ Loading, error, empty and not-configured states on every async path
- ✅ Configuration banner naming the exact missing environment variable

---

## Partially Implemented

### ZK proof generation — code complete, artifacts absent

Everything on the proving path is written and type-safe: input derivation,
Merkle proof construction, witness assembly, `snarkjs.groth16.fullProve`,
calldata formatting, submission, replay checking.

It cannot run because `ownership_proof.wasm` and `ownership_proof_final.zkey`
do not exist. `circom` is not installed in this environment, so the circuit was
never compiled.

Rather than stub a proof, `lib/zkProver.ts` probes for the artifacts and throws
`ProverError` with `missingArtifacts: true`, and `/prove` renders the exact
command to fix it. Every step up to proving still runs, so the Merkle root and
derived inputs are inspectable.

**Unblock:** install circom, then `npm run circuits:setup`.

### Contract interaction — code complete, nothing deployed

All reads and writes are wired through wagmi hooks against real ABIs, but no
addresses are configured, so the actions are disabled with an explanation
instead of failing at the RPC layer.

**Unblock:** `npm run deploy:sepolia`, then paste the printed `NEXT_PUBLIC_*`
block into `frontend/.env.local`.

### Holdings entry is manual

`/prove` requires the user to type the token IDs and quantities that form the
Merkle tree. Deriving them automatically means enumerating ERC-721/ERC-1155
balances across every discovered stealth address, which needs an indexer or a
balance-scanning service. ARCHITECTURE.md specifies neither, so none was
invented.

---

## Not Implemented

| Item | Why |
|---|---|
| `contracts/zk/Groth16Verifier.sol` | Auto-generated by `snarkjs zkey export solidityverifier`. ARCHITECTURE.md §13 constraint 2 forbids hand-writing it. `circom` is unavailable here, so it cannot be generated. `scripts/deploy.ts` refuses to deploy without it. See `contracts/zk/README.md`. |
| `circuits/build/*` (`.wasm`, `.zkey`, `verification_key.json`) | Same cause. `scripts/setup-zkeys.ts` produces all of them. |
| Deployed contract addresses | No deployer key, RPC endpoint, or testnet funds in this environment. |
| Circuit unit tests (valid/invalid witness) | ARCHITECTURE.md §14 requires these. They need the compiled R1CS, which does not exist yet. |
| In-circuit stealth address binding | ARCHITECTURE.md §4 lists as assertion #1 that `spendKeyHash` derives the stealth address holding `tokenId`. This needs secp256k1 scalar multiplication inside the circuit — millions of constraints — and the document's own circuit sketch (§9) does not attempt it. Not implemented; see Technical Debt. |
| Web Worker for proving | Proving blocks the main thread. Affects responsiveness, not correctness. |
| Regulator-side decryption UI | ARCHITECTURE.md specifies the encrypted response is decryptable "only by the audit key" but does not define the encryption scheme or key distribution. Inventing one would be guesswork. The ciphertext is displayed; decryption is left to the regulator's own tooling. |

---

## Decisions That Deviate From a Literal Reading

Three places where following the document verbatim would have produced
something unsound or untruthful. Each is flagged so it can be overruled.

### 1. Merkle leaf is `Poseidon(tokenId, quantity)`, not `tokenId`

ARCHITECTURE.md §9 sketches `merkleCheck.leaf <== tokenId` and marks the
threshold constraint as "implementation depends on data model".

Committing only `tokenId` leaves `quantity` unconstrained, which makes
`quantity >= threshold` prove nothing — a prover could assert any amount. That
would be a constraint that looks real and is not.

Committing both keeps the specified constraint meaningful and covers both
supported standards: ERC-721 leaves carry quantity 1, ERC-1155 leaves carry the
balance. `frontend/lib/merkle.ts` builds leaves identically.

### 2. Testimonials section repurposed to open standards

The template shipped six testimonials from named people at named companies.
NullOwn has no customers, and inventing endorsements would be fabricated social
proof. The layout is preserved exactly — quote mark, body, avatar slot,
attribution — and now carries ERC-5564, ERC-6538, Groth16, Poseidon, BN254 and
the token standards, which a reader can verify.

### 3. Pricing section repurposed to the three layers; logo cloud to standards

The pricing table described a subscription business that does not exist for an
open-source testnet privacy layer. The three columns, the binary toggle, the
highlighted middle card and the checked lists are all preserved and now carry
the Stealth / Proof / Compliance layers, with the toggle switching between
capabilities and standards.

The logo cloud showed third-party company wordmarks under "Trusted by leading
security teams" — an endorsement claim that could not stand. The grid, borders
and plus-icon joins are unchanged; the cells name the specifications the system
is built from.

---

## Additions Beyond the Literal Page List

- **Send panel on `/stealth`.** ARCHITECTURE.md §10 lists `/stealth` as keys,
  scanning and received assets. The sender path is nonetheless specified — §11's
  stealth transfer diagram has the sender calling `announce`, and §10 assigns
  sender-side derivation to `lib/stealth.ts`. Without it the announcer contract
  has no caller in the app. It is explicit that the token transfer itself
  happens outside NullOwn.
- **`MockGroth16Verifier`.** A test double, clearly marked test-only and
  excluded from every deployment path, so `OwnershipVerifier`'s replay
  protection is testable before the real verifier exists.

---

## File Changes

### Created — contracts and circuits

```
contracts/interfaces/IStealthRegistry.sol
contracts/interfaces/IStealthAnnouncer.sol
contracts/interfaces/IOwnershipVerifier.sol
contracts/interfaces/IGroth16Verifier.sol
contracts/stealth/ERC6538Registry.sol
contracts/stealth/ERC5564Announcer.sol
contracts/zk/OwnershipVerifier.sol
contracts/zk/README.md
contracts/compliance/ComplianceModule.sol
contracts/mocks/MockGroth16Verifier.sol
circuits/ownership_proof.circom
circuits/merkle_inclusion.circom
circuits/nullifier.circom
circuits/poseidon/poseidon.circom
```

### Created — tooling

```
package.json                      (root workspace)
hardhat.config.ts
tsconfig.json                     (root)
.env.example
.gitignore
scripts/deploy.ts
scripts/setup-zkeys.ts
scripts/seed-registry.ts
test/stealth/ERC6538Registry.test.ts
test/stealth/ERC5564Announcer.test.ts
test/zk/OwnershipVerifier.test.ts
test/compliance/ComplianceModule.test.ts
docs/README.md
IMPLEMENTATION_REPORT.md
```

### Created — frontend

```
frontend/lib/env.ts
frontend/lib/chains.ts
frontend/lib/wagmi.ts              (client config)
frontend/lib/wagmi-config.ts       (server-safe config)
frontend/lib/contracts.ts
frontend/lib/stealth.ts
frontend/lib/keystore.ts
frontend/lib/poseidon.ts
frontend/lib/merkle.ts
frontend/lib/zkProver.ts
frontend/lib/abis/{stealthRegistry,stealthAnnouncer,ownershipVerifier,complianceModule}.ts
frontend/lib/stubs/base-account.ts
frontend/lib/__tests__/{stealth,merkle,zkProver}.test.ts
frontend/types/{circomlibjs,snarkjs}.d.ts
frontend/hooks/useStealthKeys.ts
frontend/hooks/useStealthRegistry.ts
frontend/hooks/useStealthAnnouncer.ts
frontend/hooks/useAnnouncementScanner.ts
frontend/hooks/useOwnershipProof.ts
frontend/hooks/useCompliance.ts
frontend/app/providers.tsx
frontend/app/stealth/page.tsx
frontend/app/prove/page.tsx
frontend/app/compliance/page.tsx
frontend/components/app/{app-shell,animated-heading,panel,config-banner}.tsx
frontend/components/stealth/{key-manager,registry-panel,scanner-panel,send-panel}.tsx
frontend/components/prove/holdings-editor.tsx
frontend/public/circuits/README.md
frontend/vitest.config.ts
```

### Modified

| File | Change |
|---|---|
| `frontend/app/layout.tsx` | NullOwn metadata; wagmi SSR hydration; removed unused font imports |
| `frontend/components/hero.tsx` | Content + real route links. Design untouched |
| `frontend/components/problem-section.tsx` | Content from ARCHITECTURE.md §2; section anchor |
| `frontend/components/solution-section.tsx` | Three-layer steps; section anchor |
| `frontend/components/features-section.tsx` | Six NullOwn capabilities; `ease` typing fix |
| `frontend/components/testimonials-section.tsx` | Repurposed to open standards (see above) |
| `frontend/components/pricing-section.tsx` | Repurposed to the three layers (see above) |
| `frontend/components/faq-section.tsx` | Six NullOwn Q&As |
| `frontend/components/cta-section.tsx` | Content + `/stealth` link |
| `frontend/components/footer.tsx` | NullOwn branding; app links |
| `frontend/components/logo-section.tsx` | Heading |
| `frontend/components/ui/logo-cloud-2.tsx` | Cells name standards instead of company logos |
| `frontend/package.json` | Renamed; web3/ZK/crypto deps; `--webpack` on dev/build; test + typecheck scripts |
| `frontend/tsconfig.json` | `target: ES6` → `ES2022` — BigInt literals are unavailable below ES2020 and every field element is one |
| `frontend/next.config.mjs` | Removed `ignoreBuildErrors`; Turbopack root; `@base-org/account` alias; bundler rationale |
| `README.md` | Full project README |

### Removed

| File | Why |
|---|---|
| `skydda-ai-sentinel/` | Moved to `frontend/` per ARCHITECTURE.md §7. Contents verified byte-identical before the original was deleted |
| `frontend/pnpm-lock.yaml` | Repository standardises on npm workspaces (§7). Leaving a stale pnpm lockfile alongside `package-lock.json` invites drift |

**Left alone:** `.serena/` (tooling cache, unrelated to this work),
`ARCHITECTURE.pdf`, `mcp.json`.

---

## Verification

```bash
npm run compile                    # 14 Solidity files
npm test                           # 35 passing
cd frontend && npm run typecheck   # clean
cd frontend && npm test            # 63 passing
cd frontend && npm run build       # exit 0, 5 routes
```

Final build output:

```
Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /compliance
├ ƒ /prove
└ ƒ /stealth
```

Four issues surfaced during verification, all originating in the template's
configuration or in third-party packaging rather than in NullOwn logic:

1. **`target: ES6` could not compile BigInt literals.** Every BN254 field
   element is one. Raised to ES2022.

2. **Next 16 defaults to Turbopack**, whose lockfile-based root inference walked
   past this repository and settled on a stray `pnpm-lock.yaml` in the user's
   home directory. `turbopack.root` pinned explicitly.

3. **RainbowKit's package index statically imports the Base wallet connector**,
   whose dependency chain ends at four *optional* `@x402/*` peer dependencies
   that npm does not install — fourteen unresolvable specifiers under a Solana
   payments code path. Fixed by aliasing `@base-org/account` to a stub; the real
   module is reached only through a dynamic import inside that connector's
   `getProvider()`, and the Base wallet is not offered.

   This forced the bundler choice. Turbopack's `resolveAlias` does not intercept
   imports originating inside `node_modules`, so `dev` and `build` pass
   `--webpack` explicitly. The alternatives — installing four unused Solana
   packages into an EVM privacy app, or stubbing all fourteen leaf specifiers —
   were worse. Revisit if Turbopack gains `node_modules` alias support.

4. **`getDefaultConfig` is client-only**, but the root layout is a Server
   Component and needs a `Config` for `cookieToInitialState`. Split into
   `lib/wagmi-config.ts` (server-safe, no RainbowKit import) and `lib/wagmi.ts`
   (client). Both draw chains, transports and storage from the shared module, so
   the connection cookie deserialises consistently across the boundary.

Remaining build warnings are benign optional-dependency notices from third
parties: `@react-native-async-storage/async-storage` (MetaMask SDK's React
Native path) and `pino-pretty` (WalletConnect's logger). Neither is reachable in
a browser build.

---

## Remaining Tasks

In order:

1. **Install circom** and run `npm run circuits:setup`. Unblocks the generated
   verifier, the browser proving artifacts, and deployment.
2. **Write circuit tests** — valid witness proves, invalid witness fails.
   Specifically: quantity below threshold, wrong Merkle path, mismatched
   nullifier. Required by ARCHITECTURE.md §14 and currently blocked on step 1.
3. **Deploy to Sepolia** (`npm run deploy:sepolia`) and populate
   `frontend/.env.local` from the printed block.
4. **Set `NEXT_PUBLIC_ANNOUNCEMENT_START_BLOCK`** to the announcer's deployment
   block. Scanning from 0 is rejected by most public RPC providers.
5. **Get a WalletConnect project id** and set
   `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. Injected wallets work without it.
6. **End-to-end test on testnet**: register → send → announce → scan → prove →
   verify → audit.
7. **Publish the proving key** to object storage or a release asset; it is too
   large for git.
8. **Move proving into a Web Worker.**
9. **Define the compliance encryption scheme** — cipher, key distribution,
   rotation — then build the regulator decryption UI.

---

## Technical Debt

**Cryptographic**

- *The circuit does not bind the spend key to the stealth address.*
  ARCHITECTURE.md §4 assertion #1 requires it; §9's circuit sketch does not
  implement it, and neither does this code. The link between key and holding is
  established when the tree is built, not proven in zero knowledge. A prover who
  knows a valid `(tokenId, quantity)` pair and its Merkle path can attest to it
  with any `spendKeyHash`. Closing this needs in-circuit secp256k1 scalar
  multiplication, which is a major undertaking.
- *Single-contributor trusted setup.* `setup-zkeys.ts` runs one local phase-2
  contribution. Fine for testnet; a contributor who keeps their toxic waste can
  forge proofs. Mainnet needs a multi-party ceremony.
- *Nullifiers make repeat attestations linkable.* `Poseidon(spendKeyHash,
  tokenId)` is deterministic by necessity — that is what enables replay
  protection. Proving the same token twice produces the same nullifier, linking
  the two attestations to each other, though still not to any wallet. An epoch
  input would break the linkage at the cost of weaker replay protection.
- *No contract audit.*

**Operational**

- The announcement scanner replays the full block range on every scan; there is
  no cursor persistence. Fine at testnet volume, poor beyond it.
- Merkle tree construction is sequential. At depth 20 with many holdings this is
  noticeable, though it is dwarfed by proving time.
- `chainId` is read from an environment variable rather than from the connected
  wallet. Mismatches are detected and surfaced, but the app targets one chain
  per build.

**Frontend**

- Proving blocks the main thread (see Remaining Tasks 8).
- `frontend/lib/abis/*.ts` are hand-maintained typed copies while
  `scripts/deploy.ts` exports generated JSON to
  `frontend/lib/abis/generated/`. The generated files exist to catch drift, but
  nothing enforces the comparison — a CI check should diff them.
- `@base-org/account` is aliased to a stub. If the Base wallet is ever wanted,
  install the four `@x402/*` packages and remove both the alias and the stub.
- The build is pinned to webpack because Turbopack cannot alias `node_modules`.
  This costs build speed and diverges from the Next 16 default. Recheck when
  Turbopack's alias support widens.
- Vitest covers `lib/` only. The hooks and components have no tests.
