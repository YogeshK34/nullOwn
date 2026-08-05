/**
 * Minimal ambient types for `circomlibjs`, which ships no declarations.
 *
 * Only the Poseidon surface NullOwn actually uses is declared. Anything broader
 * would be guesswork, and `any` is banned by the project conventions.
 */
declare module "circomlibjs" {
  /** Field arithmetic helper attached to the Poseidon instance. */
  export interface PoseidonField {
    /** Canonical decimal string for a field element. */
    toString(value: unknown, radix?: number): string;
    /** Normalise a value into the field's internal representation. */
    e(value: string | number | bigint): unknown;
    /** Additive identity. */
    zero: unknown;
  }

  export interface Poseidon {
    (inputs: Array<string | number | bigint>): unknown;
    F: PoseidonField;
  }

  export function buildPoseidon(): Promise<Poseidon>;
}
