/**
 * Minimal ambient types for `snarkjs`, which ships no declarations.
 *
 * Covers only the Groth16 prove/verify path used by `lib/zkProver.ts`.
 */
declare module "snarkjs" {
  /** A Groth16 proof in SnarkJS' native JSON shape. */
  export interface Groth16Proof {
    /** G1 point, 3 coordinates (the third is the projective 1). */
    pi_a: [string, string, string];
    /** G2 point. Note the inner pairs are emitted in reversed order. */
    pi_b: [[string, string], [string, string], [string, string]];
    /** G1 point. */
    pi_c: [string, string, string];
    protocol: string;
    curve: string;
  }

  /** Public signals, as decimal strings, in circuit declaration order. */
  export type PublicSignals = string[];

  export interface FullProveResult {
    proof: Groth16Proof;
    publicSignals: PublicSignals;
  }

  /** Circuit inputs keyed by signal name. */
  export type CircuitSignals = Record<
    string,
    string | number | bigint | Array<string | number | bigint>
  >;

  export interface VerificationKey {
    protocol: string;
    curve: string;
    nPublic: number;
    [key: string]: unknown;
  }

  export namespace groth16 {
    function fullProve(
      input: CircuitSignals,
      wasmPath: string | Uint8Array,
      zkeyPath: string | Uint8Array,
      logger?: unknown,
    ): Promise<FullProveResult>;

    function verify(
      verificationKey: VerificationKey,
      publicSignals: PublicSignals,
      proof: Groth16Proof,
      logger?: unknown,
    ): Promise<boolean>;

    function exportSolidityCallData(
      proof: Groth16Proof,
      publicSignals: PublicSignals,
    ): Promise<string>;
  }
}
