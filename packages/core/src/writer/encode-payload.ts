import { ERROR_CODES } from "../errors/error-codes.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import type { CompiledField, CompiledNode, CompiledPrimitiveNode, CompiledRootNode } from "../shape/compiled-shape.js";
import { encodeUtf8String } from "../scalar/utf8.js";
import { writeBool } from "../scalar/bool.js";
import { writeI16, writeI32, writeI8, writeU16, writeU32, writeU8 } from "../scalar/write-scalars.js";

type ByteCollector = {
  chunks: Uint8Array[];
  totalByteLength: number;
};

function createByteCollector(): ByteCollector {
  return {
    chunks: [],
    totalByteLength: 0
  };
}

function pushChunk(collector: ByteCollector, chunk: Uint8Array) {
  collector.chunks.push(chunk);
  collector.totalByteLength += chunk.byteLength;
}

function materializeCollector(collector: ByteCollector): Uint8Array {
  const bytes = new Uint8Array(collector.totalByteLength);
  let offset = 0;

  for (const chunk of collector.chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

type FixedWidthScalarNode = CompiledPrimitiveNode & {
  kind: "u8" | "i8" | "u16" | "i16" | "u32" | "i32" | "bool";
};

function encodeFixedWidth(
  node: FixedWidthScalarNode,
  input: unknown,
  options: FluxBinOptions
): Result<Uint8Array, FluxBinError> {
  let byteWidth = 0;
  if (node.byteWidth !== null) {
    byteWidth = node.byteWidth;
  }

  const bytes = new Uint8Array(byteWidth);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  switch (node.kind) {
    case "bool":
      if (typeof input !== "boolean") {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Tuple/scalar bool node must be a boolean.", null));
      }
      return mapScalarWrite(writeBool(view, 0, input), bytes);
    case "i8":
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }

      return mapScalarWrite(writeI8(view, 0, input), bytes);
    case "i16":
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }

      return mapScalarWrite(writeI16(view, 0, input, options.endian), bytes);
    case "i32":
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }

      return mapScalarWrite(writeI32(view, 0, input, options.endian), bytes);
    case "u8":
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }

      return mapScalarWrite(writeU8(view, 0, input), bytes);
    case "u16":
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }

      return mapScalarWrite(writeU16(view, 0, input, options.endian), bytes);
    case "u32":
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }

      return mapScalarWrite(writeU32(view, 0, input, options.endian), bytes);
  }

  const unsupportedKind = String(node.kind);
  return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Unsupported fixed-width node "${unsupportedKind}".`, null));
}

function invalidNumber(nodeLabel: string): Result<Uint8Array, FluxBinError> {
  return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Node "${nodeLabel}" must be a number.`, null));
}

function mapScalarWrite(result: Result<number, FluxBinError>, bytes: Uint8Array): Result<Uint8Array, FluxBinError> {
  if (!result.ok) {
    return result;
  }

  return ok(bytes);
}

function encodeArrayCount(count: number, options: FluxBinOptions): Result<Uint8Array, FluxBinError> {
  if (!Number.isInteger(count) || count < 0) {
    return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Array count must be a non-negative integer.", null));
  }
  if (count > options.limits.maxArrayLength) {
    return err(
      protocolError(
        ERROR_CODES.INVALID_FIELD_VALUE,
        `Array count ${String(count)} exceeds maxArrayLength.`,
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

function encodeNode(node: CompiledNode, input: unknown, options: FluxBinOptions): Result<Uint8Array, FluxBinError> {
  if (node.kind === "shape") {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Shape node must be an object.", null));
    }

    const collector = createByteCollector();
    const objectInput = input as Record<string, unknown>;

    for (const field of node.fields) {
      if (!(field.key in objectInput)) {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Field "${field.key}" is required.`, null));
      }

      const encodedField = encodeField(field, objectInput[field.key], options);
      if (!encodedField.ok) {
        return encodedField;
      }

      pushChunk(collector, encodedField.value);
    }

    return ok(materializeCollector(collector));
  }

  if (node.kind === "tuple") {
    if (!Array.isArray(input)) {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Tuple node must be an array.", null));
    }
    if (input.length !== node.items.length) {
      return err(
        protocolError(
          ERROR_CODES.LENGTH_MISMATCH,
          "Tuple input length does not match tuple schema length.",
          null,
          { actualLength: input.length, expectedLength: node.items.length }
        )
      );
    }

    const collector = createByteCollector();
    for (const [index, item] of node.items.entries()) {
      const encodedItem = encodeNode(item, input[index], options);
      if (!encodedItem.ok) {
        return encodedItem;
      }

      pushChunk(collector, encodedItem.value);
    }

    return ok(materializeCollector(collector));
  }

  if (node.kind === "object-array") {
    if (!Array.isArray(input)) {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Object array node must be an array.", null));
    }

    const countBytes = encodeArrayCount(input.length, options);
    if (!countBytes.ok) {
      return countBytes;
    }

    const collector = createByteCollector();
    pushChunk(collector, countBytes.value);
    for (const item of input) {
      const encodedItem = encodeNode(node.item, item, options);
      if (!encodedItem.ok) {
        return encodedItem;
      }

      pushChunk(collector, encodedItem.value);
    }

    return ok(materializeCollector(collector));
  }

  if (node.kind === "scalar-array") {
    if (!Array.isArray(input)) {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Scalar array node must be an array.", null));
    }

    const countBytes = encodeArrayCount(input.length, options);
    if (!countBytes.ok) {
      return countBytes;
    }

    const collector = createByteCollector();
    pushChunk(collector, countBytes.value);
    for (const item of input) {
      const encodedItem = encodeNode(
        {
          kind: node.item,
          fixedWidth: node.item !== "utf8-string",
          byteWidth: node.item === "utf8-string" ? null : node.item === "u16" || node.item === "i16" ? 2 : node.item === "u32" || node.item === "i32" ? 4 : 1,
          staticByteLength: node.item === "utf8-string" ? null : node.item === "u16" || node.item === "i16" ? 2 : node.item === "u32" || node.item === "i32" ? 4 : 1,
          depth: 0
        },
        item,
        options
      );
      if (!encodedItem.ok) {
        return encodedItem;
      }

      pushChunk(collector, encodedItem.value);
    }

    return ok(materializeCollector(collector));
  }

  if (node.kind === "utf8-string") {
    if (typeof input !== "string") {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "utf8-string node must be a string.", null));
    }

    return encodeUtf8String(input, options.endian, options.limits);
  }

  return encodeFixedWidth(node as FixedWidthScalarNode, input, options);
}

function encodeField(field: CompiledField, input: unknown, options: FluxBinOptions): Result<Uint8Array, FluxBinError> {
  return encodeNode(field.node, input, options);
}

export function encodePayload(
  compiledShape: CompiledRootNode,
  input: unknown,
  options: FluxBinOptions
): Result<Uint8Array, FluxBinError> {
  return encodeNode(compiledShape, input, options);
}
