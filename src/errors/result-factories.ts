import { ERROR_CODES } from "./error-codes.js";
import type { FluxBinError, NeedMoreDataError, ProtocolError } from "./error-types.js";
import type { Result } from "../types/result.js";

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value, error: null };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, value: null, error };
}

export function protocolError(
  code: Exclude<typeof ERROR_CODES[keyof typeof ERROR_CODES], "NEED_MORE_DATA">,
  message: string,
  offset?: number | null,
  details?: unknown
): ProtocolError {
  const resolvedOffset = offset ?? null;

  return { kind: "protocol-error", code, message, offset: resolvedOffset, details };
}

export function needMoreData(
  message: string,
  expectedBytes: number,
  availableBytes: number,
  offset?: number | null,
  details?: unknown
): NeedMoreDataError {
  const resolvedOffset = offset ?? null;

  return {
    kind: "need-more-data",
    code: ERROR_CODES.NEED_MORE_DATA,
    message,
    offset: resolvedOffset,
    details,
    expectedBytes,
    availableBytes
  };
}

export function isNeedMoreDataError(error: FluxBinError): error is NeedMoreDataError {
  return error.kind === "need-more-data";
}
