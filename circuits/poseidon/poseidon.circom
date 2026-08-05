pragma circom 2.0.0;

// Poseidon gadget adapter.
//
// Every NullOwn circuit imports Poseidon through this file rather than reaching
// into circomlib directly, so the hash implementation can be swapped in one
// place. The JS side must stay in lockstep: `frontend/lib/poseidon.ts` wraps
// circomlibjs, which is the same permutation with the same round constants.
//
// Resolved via circom's library path (`circom -l node_modules ...`), which
// `scripts/setup-zkeys.ts` passes automatically.
include "circomlib/circuits/poseidon.circom";
