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
        ERROR_CODES.INVALID_FIELD_VALUE,
        `Raw array count ${String(count)} exceeds maxArrayLength.`,
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

  switch (rawType) {
    case "bool": {
      const result = readBool(view, 0);
      if (!result.ok) {
        return result;
      }
      return ok(result.value.value);
    }
    case "i8": {
      const result = readI8(view, 0);
      if (!result.ok) {
        return result;
      }
      return ok(result.value.value);
    }
    case "u8": {
      const result = readU8(view, 0);
      if (!result.ok) {
        return result;
      }
      return ok(result.value.value);
    }
    case "i16": {
      const result = readI16(view, 0, options.endian);
      if (!result.ok) {
        return result;
      }
      return ok(result.value.value);
    }
    case "u16": {
      const result = readU16(view, 0, options.endian);
      if (!result.ok) {
        return result;
      }
      return ok(result.value.value);
    }
    case "i32": {
      const result = readI32(view, 0, options.endian);
      if (!result.ok) {
        return result;
      }
      return ok(result.value.value);
    }
    case "u32": {
      const result = readU32(view, 0, options.endian);
      if (!result.ok) {
        return result;
      }
      return ok(result.value.value);
    }
    case "utf8-string": {
      const result = decodeUtf8String(view, 0, options.endian, options.limits);
      if (!result.ok) {
        return result;
      }
      return ok(result.value.value);
    }
  }
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
        ERROR_CODES.INVALID_FIELD_VALUE,
        `Raw array count ${String(countResult.value.value)} exceeds maxArrayLength.`,
        0
      )
    );
  }

  const value: RawScalarValue[] = [];
  let nextOffset = countResult.value.nextOffset;
  for (let index = 0; index < countResult.value.value; index += 1) {
    const decodedItem = decodeRawValue(
      rawType,
      payload.subarray(nextOffset),
      options
    );
    if (!decodedItem.ok) {
      return decodedItem;
    }

    value.push(decodedItem.value);

    if (rawType === "utf8-string") {
      const nextString = decodeUtf8String(view, nextOffset, options.endian, options.limits);
      if (!nextString.ok) {
        return nextString;
      }
      nextOffset = nextString.value.nextOffset;
    } else {
      nextOffset += rawType === "u16" || rawType === "i16" ? 2 : rawType === "u32" || rawType === "i32" ? 4 : 1;
    }
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
