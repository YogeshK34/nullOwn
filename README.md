# NullOwn

A privacy layer for tokenized Real-World Assets (RWA) on EVM chains.

NullOwn lets an investor receive RWA tokens privately, hold them invisibly,
prove ownership when required, and remain auditable by regulators — without a
single public disclosure. It is a **privacy overlay**: it issues no tokens and
modifies no existing ERC-721 or ERC-1155 contract, and it is non-custodial
throughout.

> **Testnet only.** Sepolia and Polygon Mumbai. The contracts are unaudited and
> the Groth16 setup currently uses a single-contributor ceremony. Do not put real
> value behind this.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design — it is the
source of truth for this repository.

---

## The three layers

| Layer | Mechanism | Where |
|---|---|---|
| Receive privately | ERC-5564 / ERC-6538 stealth addresses over secp256k1 ECDH | `contracts/stealth/`, `frontend/lib/stealth.ts` |
| Prove ownership | Circom + Groth16 over BN254, proved in the browser | `circuits/`, `frontend/lib/zkProver.ts` |
| Stay auditable | RBAC-gated, append-only audit log | `contracts/compliance/` |

---

## Repository layout

```
nullOwn/
├── contracts/          Solidity sources (Hardhat)
│   ├── stealth/        ERC5564Announcer, ERC6538Registry
│   ├── zk/             OwnershipVerifier (+ generated Groth16Verifier)
│   ├── compliance/     ComplianceModule
│   ├── interfaces/     Shared interfaces
│   └── mocks/          Test doubles — never deployed
├── circuits/           Circom circuits and build output
├── scripts/            deploy, setup-zkeys, seed-registry
├── test/               Hardhat contract tests
├── frontend/           Next.js App Router application
├── docs/
├── hardhat.config.ts
└── ARCHITECTURE.md
```

---

## Run the demo

To see the whole system working without deploying anything or installing
`circom`:

```bash
npm install
npm run demo          # writes frontend/.env.local, then starts the dev server
```

Open <http://localhost:3000>. A mock wallet connects on load and all three
layers are usable end to end: register a meta-address, scan for incoming
payments and reveal the key controlling one, derive a one-time address for
someone else, generate an ownership proof, and open or answer an audit request.

Demo mode fabricates everything that would otherwise need a chain — contract
addresses, block numbers, transaction hashes, the audit log, role assignments,
and the Groth16 proof bytes. Everything cryptographic is real: stealth keys,
ECDH derivation, the Poseidon Merkle tree and the nullifier run the same code
they would against Sepolia, so a revealed stealth key genuinely controls the
address it is shown against. A banner says all of this on every page.

The fixtures live in [`frontend/lib/demo.ts`](./frontend/lib/demo.ts) and the
mutable demo state in [`frontend/lib/demo-store.ts`](./frontend/lib/demo-store.ts).
Any `NEXT_PUBLIC_*` value you set explicitly overrides its demo fallback, so a
partial real deployment can be mixed in. To leave demo mode, set
`NEXT_PUBLIC_DEMO_MODE=false` in `frontend/.env.local` and follow the steps
below.

---

## Getting started

### 1. Install

```bash
npm install          # installs root + frontend workspace
cp .env.example .env
```

### 2. Compile and test the contracts

```bash
npm run compile
npm test             # 35 contract tests
```

### 3. Build the circuit artifacts

Requires [circom](https://docs.circom.io/getting-started/installation/) on
`PATH`. This step downloads a ~300 MB Powers of Tau file on first run, then
emits the generated Solidity verifier and the browser proving artifacts.

```bash
npm run circuits:setup
```

Until this runs, `contracts/zk/Groth16Verifier.sol` does not exist,
`scripts/deploy.ts` refuses to deploy, and the `/prove` page states plainly that
proving is unavailable. Nothing falls back to a fake proof.

### 4. Deploy

```bash
npm run node                       # terminal 1: local chain
npm run deploy:local               # terminal 2
# or
npm run deploy:sepolia
```

`deploy.ts` writes `deployments/<network>.json`, mirrors the compiled ABIs into
`frontend/lib/abis/generated/`, and prints the exact `NEXT_PUBLIC_*` block to
paste into `frontend/.env.local`.

### 5. Run the app

```bash
npm run frontend:dev
```

---

## Frontend

```bash
cd frontend
npm run dev
npm run typecheck    # must stay clean; build-time type checking is enabled
npm test             # 63 unit tests over lib/
```

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/stealth` | Key management, registry, announcement scanning, private sends |
| `/prove` | Client-side ZK proof generation and submission |
| `/compliance` | Roles, audit requests, public audit log |

### Non-custodial guarantees

- Spend and view keys are generated in the browser and never transmitted.
- Persistence is AES-256-GCM under a key derived by PBKDF2-SHA256 (600k iterations).
- Proof generation runs client-side. The witness — token id, quantity, spend key
  hash, Merkle path — never leaves the tab.
- There is no backend. The app talks only to an RPC endpoint.

---

## Current status

Implemented, tested and building. Two things gate a full end-to-end run
*against a real chain*: the circuit artifacts (step 3, needs `circom`) and a
deployment (step 4). Neither is needed to exercise the interface — see
[Run the demo](#run-the-demo).

See [IMPLEMENTATION_REPORT.md](./IMPLEMENTATION_REPORT.md) for what is complete,
what is partial, what is not implemented and why, and the ordered list of
remaining work.

## License

MIT
