import { ERROR_CODES } from "../errors/error-codes.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import type { CompiledField, CompiledShape } from "../shape/compiled-shape.js";
import { readBool } from "../scalar/bool.js";
import { readI16, readI32, readI8, readU16, readU32, readU8 } from "../scalar/read-scalars.js";
import { decodeUtf8String } from "../scalar/utf8.js";

function decodeField(
  field: CompiledField,
  view: DataView,
  offset: number,
  options: FluxBinOptions
): Result<{ nextOffset: number; value: unknown }, FluxBinError> {
  if (field.kind === "shape") {
    const nestedResult = decodePayload(
      field.shape,
      new Uint8Array(view.buffer, view.byteOffset + offset, view.byteLength - offset),
      options
    );
    if (!nestedResult.ok) {
      return nestedResult;
    }

    return ok({
      nextOffset: offset + nestedResult.value.nextOffset,
      value: nestedResult.value.value
    });
  }

  switch (field.kind) {
    case "bool":
      return readBool(view, offset);
    case "i8":
      return readI8(view, offset);
    case "i16":
      return readI16(view, offset, options.endian);
    case "i32":
      return readI32(view, offset, options.endian);
    case "u8":
      return readU8(view, offset);
    case "u16":
      return readU16(view, offset, options.endian);
    case "u32":
      return readU32(view, offset, options.endian);
    case "utf8-string":
      return decodeUtf8String(view, offset, options.endian, options.limits);
  }
}

export function decodePayload(
  compiledShape: CompiledShape,
  payload: Uint8Array,
  options: FluxBinOptions
): Result<{ nextOffset: number; value: Record<string, unknown> }, FluxBinError> {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const value: Record<string, unknown> = {};
  let offset = 0;

  for (const field of compiledShape.fields) {
    const decoded = decodeField(field, view, offset, options);
    if (!decoded.ok) {
      return decoded;
    }

    value[field.key] = decoded.value.value;
    offset = decoded.value.nextOffset;
  }

  if (offset !== payload.byteLength) {
    return err(
      protocolError(
        ERROR_CODES.LENGTH_MISMATCH,
        "Decoded payload did not consume the expected number of bytes.",
        offset,
        { actualBytes: payload.byteLength, consumedBytes: offset }
      )
    );
  }

  return ok({ nextOffset: offset, value });
}
