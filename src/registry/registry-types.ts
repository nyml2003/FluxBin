import type { FluxBinLimits } from "../limits/default-limits.js";
import type { Endian } from "../types/common.js";
import type { CompiledShape } from "../shape/compiled-shape.js";
import type { Shape } from "../shape/shape-node.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";

export type RegistryMeta = {
  name?: string;
};

export type RegisteredShape<S extends Shape = Shape> = {
  compiledShape: CompiledShape;
  meta?: RegistryMeta;
  shape: S;
  typeId: number;
};

export type RegistryOptions = {
  endian: Endian;
  limits: FluxBinLimits;
};

export type RegistryOptionsInput = {
  endian?: Endian;
  limits?: Partial<FluxBinLimits>;
};

export type Registry = {
  get(typeId: number): RegisteredShape | undefined;
  has(typeId: number): boolean;
  options: RegistryOptions;
  register<const S extends Shape>(typeId: number, shape: S, meta?: RegistryMeta): Result<RegisteredShape<S>, FluxBinError>;
};
