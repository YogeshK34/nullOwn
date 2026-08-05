# `docs/`

Reserved for architecture diagrams and the research writeup, per
ARCHITECTURE.md §7.

The authoritative system design lives in [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
at the repository root — including the data-flow diagrams, contract interfaces,
circuit design, and the hard constraints that govern this codebase. Start there.

Related documents:

- [`../IMPLEMENTATION_REPORT.md`](../IMPLEMENTATION_REPORT.md) — what is built,
  what is partial, what is missing and why.
- [`../contracts/zk/README.md`](../contracts/zk/README.md) — why
  `Groth16Verifier.sol` is a build artifact rather than a source file.
- [`../frontend/public/circuits/README.md`](../frontend/public/circuits/README.md)
  — the circuit artifacts the browser prover needs.
