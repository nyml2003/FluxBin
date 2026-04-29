/**
 * raw 顶层值编解码。
 *
 * 这个文件把 FluxBin 已支持的基础标量映射成 `raw` 顶层负载字节。
 * 它不经过 registry，也不依赖 shape。
 */
import { ERROR_CODES } from "../errors/error-codes.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import { readBool } from "../scalar/bool.js";
import { readI16, readI32, readI8, readU16, readU32, readU8 } from "../scalar/read-scalars.js";
import { decodeUtf8String, encodeUtf8String } from "../scalar/utf8.js";
import { writeBool } from "../scalar/bool.js";
import { writeI16, writeI32, writeI8, writeU16, writeU32, writeU8 } from "../scalar/write-scalars.js";
import type { Result } from "../types/result.js";
import type { RawScalarArrayTypeValue, RawScalarArrayValue, RawScalarType, RawScalarValue } from "./raw-types.js";

function createFixedWidthBuffer(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return { bytes, view };
}

function encodeArrayCount(count: number, options: FluxBinOptions): Result<Uint8Array, FluxBinError> {
  if (!Number.isInteger(count) || count < 0) {
    return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Raw array count must be a non-negative integer.", null));
  }
  if (count > options.limits.maxArrayLength) {
    return err(
      protocolError(
        ERROR_CODES.ARRAY_LENGTH_EXCEEDED,
        `Raw array count ${String(count)} exceeds maxArrayLength ${String(options.limits.maxArrayLength)}.`,
        null
      )
    );
  }

  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const writeResult = writeU32(view, 0, count, options.endian);
  if (!writeResult.ok) {
    return writeResult;
  }

  return ok(bytes);
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

export function encodeRawValue(
  rawType: RawScalarType,
  value: RawScalarValue,
  options: FluxBinOptions
): Result<Uint8Array, FluxBinError> {
  switch (rawType) {
    case "bool": {
      if (typeof value !== "boolean") {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Raw bool value must be boolean.", null));
      }
      const buffer = createFixedWidthBuffer(1);
      const writeResult = writeBool(buffer.view, 0, value);
      if (!writeResult.ok) {
        return writeResult;
      }
      return ok(buffer.bytes);
    }
    case "i8": {
      if (typeof value !== "number") {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Raw i8 value must be number.", null));
      }
      const buffer = createFixedWidthBuffer(1);
      const writeResult = writeI8(buffer.view, 0, value);
      if (!writeResult.ok) {
        return writeResult;
      }
      return ok(buffer.bytes);
    }
    case "u8": {
      if (typeof value !== "number") {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Raw u8 value must be number.", null));
      }
      const buffer = createFixedWidthBuffer(1);
      const writeResult = writeU8(buffer.view, 0, value);
      if (!writeResult.ok) {
        return writeResult;
      }
      return ok(buffer.bytes);
    }
    case "i16": {
      if (typeof value !== "number") {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Raw i16 value must be number.", null));
      }
      const buffer = createFixedWidthBuffer(2);
      const writeResult = writeI16(buffer.view, 0, value, options.endian);
      if (!writeResult.ok) {
        return writeResult;
      }
      return ok(buffer.bytes);
    }
    case "u16": {
      if (typeof value !== "number") {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Raw u16 value must be number.", null));
      }
      const buffer = createFixedWidthBuffer(2);
      const writeResult = writeU16(buffer.view, 0, value, options.endian);
      if (!writeResult.ok) {
        return writeResult;
      }
      return ok(buffer.bytes);
    }
    case "i32": {
      if (typeof value !== "number") {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Raw i32 value must be number.", null));
      }
      const buffer = createFixedWidthBuffer(4);
      const writeResult = writeI32(buffer.view, 0, value, options.endian);
      if (!writeResult.ok) {
        return writeResult;
      }
      return ok(buffer.bytes);
    }
    case "u32": {
      if (typeof value !== "number") {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Raw u32 value must be number.", null));
      }
      const buffer = createFixedWidthBuffer(4);
      const writeResult = writeU32(buffer.view, 0, value, options.endian);
      if (!writeResult.ok) {
        return writeResult;
      }
      return ok(buffer.bytes);
    }
    case "utf8-string": {
      if (typeof value !== "string") {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Raw utf8-string value must be string.", null));
      }
      return encodeUtf8String(value, options.endian, options.limits);
    }
  }
}

export function decodeRawValue(
  rawType: RawScalarType,
  payload: Uint8Array,
  options: FluxBinOptions
): Result<RawScalarValue, FluxBinError> {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  let decoded: Result<{ nextOffset: number; value: RawScalarValue }, FluxBinError>;

  switch (rawType) {
    case "bool": {
      decoded = readBool(view, 0);
      break;
    }
    case "i8": {
      decoded = readI8(view, 0);
      break;
    }
    case "u8": {
      decoded = readU8(view, 0);
      break;
    }
    case "i16": {
      decoded = readI16(view, 0, options.endian);
      break;
    }
    case "u16": {
      decoded = readU16(view, 0, options.endian);
      break;
    }
    case "i32": {
      decoded = readI32(view, 0, options.endian);
      break;
    }
    case "u32": {
      decoded = readU32(view, 0, options.endian);
      break;
    }
    case "utf8-string": {
      decoded = decodeUtf8String(view, 0, options.endian, options.limits);
      break;
    }
  }

  if (!decoded.ok) {
    return decoded;
  }

  if (decoded.value.nextOffset !== payload.byteLength) {
    return err(
      protocolError(
        ERROR_CODES.LENGTH_MISMATCH,
        "Decoded raw value did not consume the expected number of bytes.",
        decoded.value.nextOffset,
        { actualBytes: payload.byteLength, consumedBytes: decoded.value.nextOffset }
      )
    );
  }

  return ok(decoded.value.value);
}

export function encodeRawArrayValue<TRawType extends RawScalarType>(
  rawType: TRawType,
  value: RawScalarArrayTypeValue<TRawType>,
  options: FluxBinOptions
): Result<Uint8Array, FluxBinError> {
  if (!Array.isArray(value)) {
    return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Raw array value must be an array.", null));
  }

  const countBytes = encodeArrayCount(value.length, options);
  if (!countBytes.ok) {
    return countBytes;
  }

  const chunks: Uint8Array[] = [countBytes.value];
  for (const item of value) {
    const encodedItem = encodeRawValue(rawType, item, options);
    if (!encodedItem.ok) {
      return encodedItem;
    }

    chunks.push(encodedItem.value);
  }

  return ok(concatBytes(chunks));
}

export function decodeRawArrayValue(
  rawType: RawScalarType,
  payload: Uint8Array,
  options: FluxBinOptions
): Result<RawScalarArrayValue, FluxBinError> {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const countResult = readU32(view, 0, options.endian);
  if (!countResult.ok) {
    return countResult;
  }
  if (countResult.value.value > options.limits.maxArrayLength) {
    return err(
      protocolError(
        ERROR_CODES.ARRAY_LENGTH_EXCEEDED,
        `Raw array count ${String(countResult.value.value)} exceeds maxArrayLength ${String(options.limits.maxArrayLength)}.`,
        0
      )
    );
  }

  const value: RawScalarValue[] = [];
  let nextOffset = countResult.value.nextOffset;
  const itemView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  for (let index = 0; index < countResult.value.value; index += 1) {
    let decodedItem: Result<{ nextOffset: number; value: RawScalarValue }, FluxBinError>;
    switch (rawType) {
      case "bool":
        decodedItem = readBool(itemView, nextOffset);
        break;
      case "i8":
        decodedItem = readI8(itemView, nextOffset);
        break;
      case "u8":
        decodedItem = readU8(itemView, nextOffset);
        break;
      case "i16":
        decodedItem = readI16(itemView, nextOffset, options.endian);
        break;
      case "u16":
        decodedItem = readU16(itemView, nextOffset, options.endian);
        break;
      case "i32":
        decodedItem = readI32(itemView, nextOffset, options.endian);
        break;
      case "u32":
        decodedItem = readU32(itemView, nextOffset, options.endian);
        break;
      case "utf8-string":
        decodedItem = decodeUtf8String(itemView, nextOffset, options.endian, options.limits);
        break;
    }
    if (!decodedItem.ok) {
      return decodedItem;
    }

    value.push(decodedItem.value.value);
    nextOffset = decodedItem.value.nextOffset;
  }

  if (nextOffset !== payload.byteLength) {
    return err(
      protocolError(
        ERROR_CODES.LENGTH_MISMATCH,
        "Decoded raw array did not consume the expected number of bytes.",
        nextOffset,
        { actualBytes: payload.byteLength, consumedBytes: nextOffset }
      )
    );
  }

  return ok(value as RawScalarArrayValue);
}
