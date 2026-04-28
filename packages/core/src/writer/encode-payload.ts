import { ERROR_CODES } from "../errors/error-codes.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import type { CompiledField, CompiledScalarField, CompiledShape } from "../shape/compiled-shape.js";
import { encodeUtf8String } from "../scalar/utf8.js";
import { writeBool } from "../scalar/bool.js";
import { writeI16, writeI32, writeI8, writeU16, writeU32, writeU8 } from "../scalar/write-scalars.js";

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

type FixedWidthScalarField = CompiledScalarField & {
  kind: "u8" | "i8" | "u16" | "i16" | "u32" | "i32" | "bool";
};

function encodeFixedWidth(
  field: FixedWidthScalarField,
  input: unknown,
  options: FluxBinOptions
): Result<Uint8Array, FluxBinError> {
  const bytes = new Uint8Array(field.byteWidth ?? 0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  switch (field.kind) {
    case "bool":
      if (typeof input !== "boolean") {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Field "${field.key}" must be a boolean.`, null));
      }
      return mapScalarWrite(writeBool(view, 0, input), bytes);
    case "i8":
      if (typeof input !== "number") {
        return invalidNumber(field.key);
      }

      return mapScalarWrite(writeI8(view, 0, input), bytes);
    case "i16":
      if (typeof input !== "number") {
        return invalidNumber(field.key);
      }

      return mapScalarWrite(writeI16(view, 0, input, options.endian), bytes);
    case "i32":
      if (typeof input !== "number") {
        return invalidNumber(field.key);
      }

      return mapScalarWrite(writeI32(view, 0, input, options.endian), bytes);
    case "u8":
      if (typeof input !== "number") {
        return invalidNumber(field.key);
      }

      return mapScalarWrite(writeU8(view, 0, input), bytes);
    case "u16":
      if (typeof input !== "number") {
        return invalidNumber(field.key);
      }

      return mapScalarWrite(writeU16(view, 0, input, options.endian), bytes);
    case "u32":
      if (typeof input !== "number") {
        return invalidNumber(field.key);
      }

      return mapScalarWrite(writeU32(view, 0, input, options.endian), bytes);
  }

  return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Unsupported fixed-width field "${field.key}".`, null));
}

function invalidNumber(fieldKey: string): Result<Uint8Array, FluxBinError> {
  return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Field "${fieldKey}" must be a number.`, null));
}

function mapScalarWrite(result: Result<number, FluxBinError>, bytes: Uint8Array): Result<Uint8Array, FluxBinError> {
  if (!result.ok) {
    return result;
  }

  return ok(bytes);
}

function encodeField(field: CompiledField, input: unknown, options: FluxBinOptions): Result<Uint8Array, FluxBinError> {
  if (field.kind === "shape") {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Field "${field.key}" must be an object.`, null));
    }

    return encodePayload(field.shape, input as Record<string, unknown>, options);
  }

  if (field.kind === "utf8-string") {
    if (typeof input !== "string") {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Field "${field.key}" must be a string.`, null));
    }

    return encodeUtf8String(input, options.endian, options.limits);
  }

  return encodeFixedWidth(field as FixedWidthScalarField, input, options);
}

export function encodePayload(
  compiledShape: CompiledShape,
  input: Record<string, unknown>,
  options: FluxBinOptions
): Result<Uint8Array, FluxBinError> {
  const chunks: Uint8Array[] = [];

  for (const field of compiledShape.fields) {
    if (!(field.key in input)) {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Field "${field.key}" is required.`, null));
    }

    const encoded = encodeField(field, input[field.key], options);
    if (!encoded.ok) {
      return encoded;
    }

    chunks.push(encoded.value);
  }

  return ok(concatBytes(chunks));
}
