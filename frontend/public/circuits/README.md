# `frontend/public/circuits/`

The browser prover loads its artifacts from this directory at runtime:

| File | Purpose | Committed? |
|---|---|---|
| `ownership_proof.wasm` | Witness generator | yes, once built |
| `ownership_proof_final.zkey` | Groth16 proving key | **no** — tens of MB |
| `verification_key.json` | Off-chain verification | yes, once built |

None of them are in the repository yet. They are build outputs of the circom
toolchain, which is not a runtime dependency. Generate them with:

```bash
npm run circuits:setup      # from the repository root; requires circom on PATH
```

`scripts/setup-zkeys.ts` compiles `circuits/ownership_proof.circom`, runs the
Groth16 setup, and copies the results here.

## Behaviour while they are missing

`frontend/lib/zkProver.ts` probes for the wasm and zkey with HEAD requests
before proving. When they are absent it throws a `ProverError` carrying
`missingArtifacts: true`, and `/prove` renders an explanation with the command
to run.

It never returns a synthetic proof. A fake proof that the UI presented as real
would be worse than no proof at all.

## Distribution

The proving key is too large for git. For a real deployment, publish it to
object storage or a CDN and serve it from this path, or attach it to a GitHub
release and document the download step. Do not commit it with Git LFS without
first checking your LFS bandwidth quota — every visitor downloads this file.
