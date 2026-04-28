import { ERROR_CODES } from "../errors/error-codes.js";
import { DEFAULT_LIMITS, type FluxBinLimits } from "../limits/default-limits.js";
import { err, needMoreData, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Endian } from "../types/common.js";
import type { Result } from "../types/result.js";
import { readU32 } from "./read-scalars.js";
import { writeU32 } from "./write-scalars.js";

const encoder = new TextEncoder();

export type Utf8DecodeResult = Result<{ nextOffset: number; value: string }, FluxBinError>;

export function encodeUtf8String(
  value: string,
  endian: Endian,
  limits?: FluxBinLimits
): Result<Uint8Array, FluxBinError> {
  const resolvedLimits = limits ?? DEFAULT_LIMITS;
  const encoded = encoder.encode(value);
  if (encoded.byteLength > resolvedLimits.maxStringBytes) {
    return err(
      protocolError(
        ERROR_CODES.INVALID_FIELD_VALUE,
        `String byte length ${String(encoded.byteLength)} exceeds maxStringBytes.`,
        null
      )
    );
  }

  const bytes = new Uint8Array(encoded.byteLength + 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lengthWrite = writeU32(view, 0, encoded.byteLength, endian);
  if (!lengthWrite.ok) {
    return lengthWrite;
  }

  bytes.set(encoded, 4);
  return ok(bytes);
}

export function decodeUtf8String(
  view: DataView,
  offset: number,
  endian: Endian,
  limits?: FluxBinLimits
): Utf8DecodeResult {
  const resolvedLimits = limits ?? DEFAULT_LIMITS;
  const lengthResult = readU32(view, offset, endian);
  if (!lengthResult.ok) {
    return lengthResult;
  }

  const byteLength = lengthResult.value.value;
  if (byteLength > resolvedLimits.maxStringBytes) {
    return err(
      protocolError(
        ERROR_CODES.INVALID_FIELD_VALUE,
        `String byte length ${String(byteLength)} exceeds maxStringBytes.`,
        offset
      )
    );
  }

  const contentOffset = lengthResult.value.nextOffset;
  const availableBytes = view.byteLength - contentOffset;
  if (availableBytes < byteLength) {
    return err(
      needMoreData(
        "Not enough bytes available for UTF-8 string body.",
        byteLength,
        Math.max(availableBytes, 0),
        contentOffset
      )
    );
  }

  const bytes = new Uint8Array(view.buffer, view.byteOffset + contentOffset, byteLength);

  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const value = decoder.decode(bytes);
    return ok({ nextOffset: contentOffset + byteLength, value });
  } catch {
    return err(protocolError(ERROR_CODES.UTF8_INVALID, "Invalid UTF-8 byte sequence.", contentOffset));
  }
}
