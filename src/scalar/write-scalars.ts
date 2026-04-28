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

  view.setUint8(offset, value);
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

  view.setInt8(offset, value);
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

  view.setUint16(offset, value, isLittleEndian(endian));
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

  view.setInt16(offset, value, isLittleEndian(endian));
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

  view.setUint32(offset, value, isLittleEndian(endian));
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

  view.setInt32(offset, value, isLittleEndian(endian));
  return ok(ready.value);
}
