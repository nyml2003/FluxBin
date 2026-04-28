import { ERROR_CODES } from "../errors/error-codes.js";
import { err, needMoreData, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Endian } from "../types/common.js";
import type { Result } from "../types/result.js";
import { isLittleEndian } from "../types/common.js";

export type ScalarReadResult<T> = Result<{ nextOffset: number; value: T }, FluxBinError>;

function ensureReadable(view: DataView, offset: number, byteLength: number): Result<number, FluxBinError> {
  if (offset < 0) {
    return err(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Offset must not be negative.", offset));
  }

  const availableBytes = view.byteLength - offset;
  if (availableBytes < byteLength) {
    return err(
      needMoreData(
        "Not enough bytes available for scalar read.",
        byteLength,
        Math.max(availableBytes, 0),
        offset
      )
    );
  }

  return ok(offset + byteLength);
}

export function readU8(view: DataView, offset: number): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 1);
  if (!ready.ok) {
    return ready;
  }

  return ok({ nextOffset: ready.value, value: view.getUint8(offset) });
}

export function readI8(view: DataView, offset: number): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 1);
  if (!ready.ok) {
    return ready;
  }

  return ok({ nextOffset: ready.value, value: view.getInt8(offset) });
}

export function readU16(view: DataView, offset: number, endian: Endian): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 2);
  if (!ready.ok) {
    return ready;
  }

  return ok({ nextOffset: ready.value, value: view.getUint16(offset, isLittleEndian(endian)) });
}

export function readI16(view: DataView, offset: number, endian: Endian): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 2);
  if (!ready.ok) {
    return ready;
  }

  return ok({ nextOffset: ready.value, value: view.getInt16(offset, isLittleEndian(endian)) });
}

export function readU32(view: DataView, offset: number, endian: Endian): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 4);
  if (!ready.ok) {
    return ready;
  }

  return ok({ nextOffset: ready.value, value: view.getUint32(offset, isLittleEndian(endian)) });
}

export function readI32(view: DataView, offset: number, endian: Endian): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 4);
  if (!ready.ok) {
    return ready;
  }

  return ok({ nextOffset: ready.value, value: view.getInt32(offset, isLittleEndian(endian)) });
}
