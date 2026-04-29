import { ERROR_CODES } from "../errors/error-codes.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Endian } from "../types/common.js";
import type { Result } from "../types/result.js";
import { isLittleEndian } from "../types/common.js";

export type ScalarWriteResult = Result<number, FluxBinError>;

function ensureWritable(view: DataView, offset: number, byteLength: number): Result<number, FluxBinError> {
  if (offset < 0) {
    return err(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Offset must not be negative.", offset));
  }

  if (offset + byteLength > view.byteLength) {
    return err(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Not enough bytes available for scalar write.", offset));
  }

  return ok(offset + byteLength);
}

function getBytes(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

function ensureIntegerRange(value: number, min: number, max: number, offset: number): Result<number, FluxBinError> {
  if (!Number.isInteger(value) || value < min || value > max) {
    return err(
      protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Value ${String(value)} is outside the supported range.`, offset)
    );
  }

  return ok(value);
}

export function writeU8(view: DataView, offset: number, value: number): ScalarWriteResult {
  const checked = ensureIntegerRange(value, 0, 0xff, offset);
  if (!checked.ok) {
    return checked;
  }

  const ready = ensureWritable(view, offset, 1);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  bytes[offset] = value;
  return ok(ready.value);
}

export function writeI8(view: DataView, offset: number, value: number): ScalarWriteResult {
  const checked = ensureIntegerRange(value, -0x80, 0x7f, offset);
  if (!checked.ok) {
    return checked;
  }

  const ready = ensureWritable(view, offset, 1);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  bytes[offset] = value & 0xff;
  return ok(ready.value);
}

export function writeU16(view: DataView, offset: number, value: number, endian: Endian): ScalarWriteResult {
  const checked = ensureIntegerRange(value, 0, 0xffff, offset);
  if (!checked.ok) {
    return checked;
  }

  const ready = ensureWritable(view, offset, 2);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  if (isLittleEndian(endian)) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
  } else {
    bytes[offset] = (value >>> 8) & 0xff;
    bytes[offset + 1] = value & 0xff;
  }
  return ok(ready.value);
}

export function writeI16(view: DataView, offset: number, value: number, endian: Endian): ScalarWriteResult {
  const checked = ensureIntegerRange(value, -0x8000, 0x7fff, offset);
  if (!checked.ok) {
    return checked;
  }

  const ready = ensureWritable(view, offset, 2);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  const normalizedValue = value & 0xffff;
  if (isLittleEndian(endian)) {
    bytes[offset] = normalizedValue & 0xff;
    bytes[offset + 1] = (normalizedValue >>> 8) & 0xff;
  } else {
    bytes[offset] = (normalizedValue >>> 8) & 0xff;
    bytes[offset + 1] = normalizedValue & 0xff;
  }
  return ok(ready.value);
}

export function writeU32(view: DataView, offset: number, value: number, endian: Endian): ScalarWriteResult {
  const checked = ensureIntegerRange(value, 0, 0xffff_ffff, offset);
  if (!checked.ok) {
    return checked;
  }

  const ready = ensureWritable(view, offset, 4);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  if (isLittleEndian(endian)) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
  } else {
    bytes[offset] = (value >>> 24) & 0xff;
    bytes[offset + 1] = (value >>> 16) & 0xff;
    bytes[offset + 2] = (value >>> 8) & 0xff;
    bytes[offset + 3] = value & 0xff;
  }
  return ok(ready.value);
}

export function writeI32(view: DataView, offset: number, value: number, endian: Endian): ScalarWriteResult {
  const checked = ensureIntegerRange(value, -0x8000_0000, 0x7fff_ffff, offset);
  if (!checked.ok) {
    return checked;
  }

  const ready = ensureWritable(view, offset, 4);
  if (!ready.ok) {
    return ready;
  }

  const bytes = getBytes(view);
  if (isLittleEndian(endian)) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
  } else {
    bytes[offset] = (value >>> 24) & 0xff;
    bytes[offset + 1] = (value >>> 16) & 0xff;
    bytes[offset + 2] = (value >>> 8) & 0xff;
    bytes[offset + 3] = value & 0xff;
  }
  return ok(ready.value);
}
