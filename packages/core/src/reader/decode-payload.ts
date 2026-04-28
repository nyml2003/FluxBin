import { ERROR_CODES } from "../errors/error-codes.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import type { CompiledField, CompiledNode, CompiledRootNode } from "../shape/compiled-shape.js";
import { readBool } from "../scalar/bool.js";
import { readI16, readI32, readI8, readU16, readU32, readU8 } from "../scalar/read-scalars.js";
import { decodeUtf8String } from "../scalar/utf8.js";

function decodePrimitiveNode(
  node: Extract<CompiledNode, { kind: "bool" | "i8" | "i16" | "i32" | "u8" | "u16" | "u32" | "utf8-string" }>,
  view: DataView,
  offset: number,
  options: FluxBinOptions
): Result<{ nextOffset: number; value: unknown }, FluxBinError> {
  switch (node.kind) {
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

function decodeNode(
  node: CompiledNode,
  view: DataView,
  offset: number,
  options: FluxBinOptions
): Result<{ nextOffset: number; value: unknown }, FluxBinError> {
  switch (node.kind) {
    case "bool":
    case "i8":
    case "i16":
    case "i32":
    case "u8":
    case "u16":
    case "u32":
    case "utf8-string":
      return decodePrimitiveNode(node, view, offset, options);
    case "shape": {
      const value: Record<string, unknown> = {};
      let nextOffset = offset;

      for (const field of node.fields) {
        const decodedField = decodeField(field, view, nextOffset, options);
        if (!decodedField.ok) {
          return decodedField;
        }

        value[field.key] = decodedField.value.value;
        nextOffset = decodedField.value.nextOffset;
      }

      return ok({ nextOffset, value });
    }
    case "tuple": {
      const value: unknown[] = [];
      let nextOffset = offset;

      for (const item of node.items) {
        const decodedItem = decodeNode(item, view, nextOffset, options);
        if (!decodedItem.ok) {
          return decodedItem;
        }

        value.push(decodedItem.value.value);
        nextOffset = decodedItem.value.nextOffset;
      }

      return ok({ nextOffset, value });
    }
    case "object-array": {
      const countResult = readU32(view, offset, options.endian);
      if (!countResult.ok) {
        return countResult;
      }
      if (countResult.value.value > options.limits.maxArrayLength) {
        return err(
          protocolError(
            ERROR_CODES.INVALID_FIELD_VALUE,
            `Object array length ${String(countResult.value.value)} exceeds maxArrayLength.`,
            offset
          )
        );
      }

      const value: unknown[] = [];
      let nextOffset = countResult.value.nextOffset;

      for (let index = 0; index < countResult.value.value; index += 1) {
        const decodedItem = decodeNode(node.item, view, nextOffset, options);
        if (!decodedItem.ok) {
          return decodedItem;
        }

        value.push(decodedItem.value.value);
        nextOffset = decodedItem.value.nextOffset;
      }

      return ok({ nextOffset, value });
    }
    case "scalar-array": {
      const countResult = readU32(view, offset, options.endian);
      if (!countResult.ok) {
        return countResult;
      }
      if (countResult.value.value > options.limits.maxArrayLength) {
        return err(
          protocolError(
            ERROR_CODES.INVALID_FIELD_VALUE,
            `Scalar array length ${String(countResult.value.value)} exceeds maxArrayLength.`,
            offset
          )
        );
      }

      const value: unknown[] = [];
      let nextOffset = countResult.value.nextOffset;

      for (let index = 0; index < countResult.value.value; index += 1) {
        const decodedItem = decodePrimitiveNode(
          {
            kind: node.item,
            fixedWidth: node.item !== "utf8-string",
            byteWidth: node.item === "utf8-string" ? null : node.item === "u16" || node.item === "i16" ? 2 : node.item === "u32" || node.item === "i32" ? 4 : 1,
            staticByteLength: node.item === "utf8-string" ? null : node.item === "u16" || node.item === "i16" ? 2 : node.item === "u32" || node.item === "i32" ? 4 : 1,
            depth: 0
          },
          view,
          nextOffset,
          options
        );
        if (!decodedItem.ok) {
          return decodedItem;
        }

        value.push(decodedItem.value.value);
        nextOffset = decodedItem.value.nextOffset;
      }

      return ok({ nextOffset, value });
    }
  }
}

function decodeField(
  field: CompiledField,
  view: DataView,
  offset: number,
  options: FluxBinOptions
): Result<{ nextOffset: number; value: unknown }, FluxBinError> {
  return decodeNode(field.node, view, offset, options);
}

export function decodePayload(
  compiledShape: CompiledRootNode,
  payload: Uint8Array,
  options: FluxBinOptions
): Result<{ nextOffset: number; value: unknown }, FluxBinError> {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const decoded = decodeNode(compiledShape, view, 0, options);
  if (!decoded.ok) {
    return decoded;
  }

  if (decoded.value.nextOffset !== payload.byteLength) {
    return err(
      protocolError(
        ERROR_CODES.LENGTH_MISMATCH,
        "Decoded payload did not consume the expected number of bytes.",
        decoded.value.nextOffset,
        { actualBytes: payload.byteLength, consumedBytes: decoded.value.nextOffset }
      )
    );
  }

  return ok(decoded.value);
}
