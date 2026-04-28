import type { Endian } from "../types/common.js";

export type FluxBinLimits = {
  maxArrayLength: number;
  maxBufferedBytes: number;
  maxDepth: number;
  maxFrameBytes: number;
  maxPayloadBytes: number;
  maxStringBytes: number;
};

export type FluxBinOptions = {
  endian: Endian;
  limits: FluxBinLimits;
};

export const DEFAULT_LIMITS: Readonly<FluxBinLimits> = Object.freeze({
  maxArrayLength: 100_000,
  maxBufferedBytes: 8 * 1024 * 1024,
  maxDepth: 32,
  maxFrameBytes: 8 * 1024 * 1024,
  maxPayloadBytes: 8 * 1024 * 1024,
  maxStringBytes: 1 * 1024 * 1024
});

export const DEFAULT_OPTIONS: Readonly<FluxBinOptions> = Object.freeze({
  endian: "little",
  limits: DEFAULT_LIMITS
});

export function cloneLimits(overrides?: Partial<FluxBinLimits>): FluxBinLimits {
  let resolvedOverrides: Partial<FluxBinLimits> = {};
  if (overrides !== undefined) {
    resolvedOverrides = overrides;
  }

  return {
    ...DEFAULT_LIMITS,
    ...resolvedOverrides
  };
}

export function createOptions(
  overrides?: {
    endian?: Endian;
    limits?: Partial<FluxBinLimits>;
  }
): FluxBinOptions {
  let resolvedOverrides: {
    endian?: Endian;
    limits?: Partial<FluxBinLimits>;
  } = {};
  if (overrides !== undefined) {
    resolvedOverrides = overrides;
  }

  let resolvedEndian = DEFAULT_OPTIONS.endian;
  if (resolvedOverrides.endian !== undefined) {
    resolvedEndian = resolvedOverrides.endian;
  }
  const resolvedLimits = cloneLimits(resolvedOverrides.limits);

  return {
    endian: resolvedEndian,
    limits: resolvedLimits
  };
}
