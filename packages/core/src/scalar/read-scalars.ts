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

function getBytes(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

export function readU8(view: DataView, offset: number): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 1);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  const value = bytes[offset];
  if (value === undefined) {
    return err(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Not enough bytes available for scalar read.", offset));
  }

  return ok({ nextOffset: ready.value, value });
}

export function readI8(view: DataView, offset: number): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 1);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  const value = bytes[offset];
  if (value === undefined) {
    return err(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Not enough bytes available for scalar read.", offset));
  }

  return ok({ nextOffset: ready.value, value: (value << 24) >> 24 });
}

export function readU16(view: DataView, offset: number, endian: Endian): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 2);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  const byte0 = bytes[offset];
  const byte1 = bytes[offset + 1];
  if (byte0 === undefined || byte1 === undefined) {
    return err(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Not enough bytes available for scalar read.", offset));
  }

  let value = 0;
  if (isLittleEndian(endian)) {
    value = byte0 | (byte1 << 8);
  } else {
    value = (byte0 << 8) | byte1;
  }

  return ok({ nextOffset: ready.value, value });
}

export function readI16(view: DataView, offset: number, endian: Endian): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 2);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  const byte0 = bytes[offset];
  const byte1 = bytes[offset + 1];
  if (byte0 === undefined || byte1 === undefined) {
    return err(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Not enough bytes available for scalar read.", offset));
  }

  let value = 0;
  if (isLittleEndian(endian)) {
    value = byte0 | (byte1 << 8);
  } else {
    value = (byte0 << 8) | byte1;
  }

  return ok({ nextOffset: ready.value, value: (value << 16) >> 16 });
}

export function readU32(view: DataView, offset: number, endian: Endian): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 4);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  const byte0 = bytes[offset];
  const byte1 = bytes[offset + 1];
  const byte2 = bytes[offset + 2];
  const byte3 = bytes[offset + 3];
  if (byte0 === undefined || byte1 === undefined || byte2 === undefined || byte3 === undefined) {
    return err(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Not enough bytes available for scalar read.", offset));
  }

  let value = 0;
  if (isLittleEndian(endian)) {
    value = (byte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24)) >>> 0;
  } else {
    value = ((byte3) | (byte2 << 8) | (byte1 << 16) | (byte0 << 24)) >>> 0;
  }

  return ok({ nextOffset: ready.value, value });
}

export function readI32(view: DataView, offset: number, endian: Endian): ScalarReadResult<number> {
  const ready = ensureReadable(view, offset, 4);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  const byte0 = bytes[offset];
  const byte1 = bytes[offset + 1];
  const byte2 = bytes[offset + 2];
  const byte3 = bytes[offset + 3];
  if (byte0 === undefined || byte1 === undefined || byte2 === undefined || byte3 === undefined) {
    return err(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Not enough bytes available for scalar read.", offset));
  }

  let value = 0;
  if (isLittleEndian(endian)) {
    value = byte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24);
  } else {
    value = byte3 | (byte2 << 8) | (byte1 << 16) | (byte0 << 24);
  }

  return ok({ nextOffset: ready.value, value });
}
