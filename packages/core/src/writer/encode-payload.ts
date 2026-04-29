import { ERROR_CODES } from "../errors/error-codes.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import type { CompiledField, CompiledNode, CompiledPrimitiveNode, CompiledRootNode } from "../shape/compiled-shape.js";
import { writeBool } from "../scalar/bool.js";
import { writeI16, writeI32, writeI8, writeU16, writeU32, writeU8 } from "../scalar/write-scalars.js";

const textEncoder = new TextEncoder();

type GrowableWriter = {
  buffer: Uint8Array;
  offset: number;
  options: FluxBinOptions;
  view: DataView;
};

function createGrowableWriter(options: FluxBinOptions): GrowableWriter {
  const initialCapacity = Math.min(1024, options.limits.maxPayloadBytes);
  const buffer = new Uint8Array(initialCapacity);

  return {
    buffer,
    offset: 0,
    options,
    view: new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  };
}

function ensureCapacity(writer: GrowableWriter, additionalBytes: number): Result<void, FluxBinError> {
  const requiredLength = writer.offset + additionalBytes;
  if (requiredLength > writer.options.limits.maxPayloadBytes) {
    return err(
      protocolError(
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        `Payload length ${String(requiredLength)} exceeds maxPayloadBytes.`,
        null
      )
    );
  }

  if (requiredLength <= writer.buffer.byteLength) {
    return ok(undefined);
  }

  let nextCapacity = writer.buffer.byteLength;
  while (nextCapacity < requiredLength) {
    nextCapacity = Math.min(nextCapacity * 2, writer.options.limits.maxPayloadBytes);
    if (nextCapacity === writer.buffer.byteLength) {
      break;
    }
  }

  if (nextCapacity < requiredLength) {
    return err(
      protocolError(
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        `Payload length ${String(requiredLength)} exceeds maxPayloadBytes.`,
        null
      )
    );
  }

  const nextBuffer = new Uint8Array(nextCapacity);
  nextBuffer.set(writer.buffer.subarray(0, writer.offset), 0);
  writer.buffer = nextBuffer;
  writer.view = new DataView(nextBuffer.buffer, nextBuffer.byteOffset, nextBuffer.byteLength);
  return ok(undefined);
}

function finishWriter(writer: GrowableWriter): Uint8Array {
  return writer.buffer.slice(0, writer.offset);
}

function invalidNumber(nodeLabel: string): Result<void, FluxBinError> {
  return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Node "${nodeLabel}" must be a number.`, null));
}

function validateArrayCount(count: number, options: FluxBinOptions): Result<void, FluxBinError> {
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

  return ok(undefined);
}

function writeArrayCount(writer: GrowableWriter, count: number): Result<void, FluxBinError> {
  const countValidation = validateArrayCount(count, writer.options);
  if (!countValidation.ok) {
    return countValidation;
  }

  const capacity = ensureCapacity(writer, 4);
  if (!capacity.ok) {
    return capacity;
  }

  const writeResult = writeU32(writer.view, writer.offset, count, writer.options.endian);
  if (!writeResult.ok) {
    return writeResult;
  }

  writer.offset = writeResult.value;
  return ok(undefined);
}

function writePrimitiveNode(
  writer: GrowableWriter,
  node: CompiledPrimitiveNode,
  input: unknown
): Result<void, FluxBinError> {
  if (node.kind === "utf8-string") {
    if (typeof input !== "string") {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "utf8-string node must be a string.", null));
    }

    const encoded = textEncoder.encode(input);
    if (encoded.byteLength > writer.options.limits.maxStringBytes) {
      return err(
        protocolError(
          ERROR_CODES.INVALID_FIELD_VALUE,
          `String byte length ${String(encoded.byteLength)} exceeds maxStringBytes.`,
          null
        )
      );
    }

    const capacity = ensureCapacity(writer, encoded.byteLength + 4);
    if (!capacity.ok) {
      return capacity;
    }

    const lengthWrite = writeU32(writer.view, writer.offset, encoded.byteLength, writer.options.endian);
    if (!lengthWrite.ok) {
      return lengthWrite;
    }
    writer.offset = lengthWrite.value;
    writer.buffer.set(encoded, writer.offset);
    writer.offset += encoded.byteLength;
    return ok(undefined);
  }

  const byteWidth = node.byteWidth ?? 0;
  const capacity = ensureCapacity(writer, byteWidth);
  if (!capacity.ok) {
    return capacity;
  }

  switch (node.kind) {
    case "bool": {
      if (typeof input !== "boolean") {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Tuple/scalar bool node must be a boolean.", null));
      }

      const writeResult = writeBool(writer.view, writer.offset, input);
      if (!writeResult.ok) {
        return writeResult;
      }
      writer.offset = writeResult.value;
      return ok(undefined);
    }
    case "i8": {
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }
      const writeResult = writeI8(writer.view, writer.offset, input);
      if (!writeResult.ok) {
        return writeResult;
      }
      writer.offset = writeResult.value;
      return ok(undefined);
    }
    case "i16": {
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }
      const writeResult = writeI16(writer.view, writer.offset, input, writer.options.endian);
      if (!writeResult.ok) {
        return writeResult;
      }
      writer.offset = writeResult.value;
      return ok(undefined);
    }
    case "i32": {
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }
      const writeResult = writeI32(writer.view, writer.offset, input, writer.options.endian);
      if (!writeResult.ok) {
        return writeResult;
      }
      writer.offset = writeResult.value;
      return ok(undefined);
    }
    case "u8": {
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }
      const writeResult = writeU8(writer.view, writer.offset, input);
      if (!writeResult.ok) {
        return writeResult;
      }
      writer.offset = writeResult.value;
      return ok(undefined);
    }
    case "u16": {
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }
      const writeResult = writeU16(writer.view, writer.offset, input, writer.options.endian);
      if (!writeResult.ok) {
        return writeResult;
      }
      writer.offset = writeResult.value;
      return ok(undefined);
    }
    case "u32": {
      if (typeof input !== "number") {
        return invalidNumber(node.kind);
      }
      const writeResult = writeU32(writer.view, writer.offset, input, writer.options.endian);
      if (!writeResult.ok) {
        return writeResult;
      }
      writer.offset = writeResult.value;
      return ok(undefined);
    }
  }
}

function createCompiledPrimitiveNode(kind: CompiledPrimitiveNode["kind"]): CompiledPrimitiveNode {
  switch (kind) {
    case "bool":
      return { kind, fixedWidth: true, byteWidth: 1, staticByteLength: 1, depth: 0 };
    case "i8":
    case "u8":
      return { kind, fixedWidth: true, byteWidth: 1, staticByteLength: 1, depth: 0 };
    case "i16":
    case "u16":
      return { kind, fixedWidth: true, byteWidth: 2, staticByteLength: 2, depth: 0 };
    case "i32":
    case "u32":
      return { kind, fixedWidth: true, byteWidth: 4, staticByteLength: 4, depth: 0 };
    case "utf8-string":
      return { kind, fixedWidth: false, byteWidth: null, staticByteLength: null, depth: 0 };
  }

  return { kind: "u8", fixedWidth: true, byteWidth: 1, staticByteLength: 1, depth: 0 };
}

function writeNode(writer: GrowableWriter, node: CompiledNode, input: unknown): Result<void, FluxBinError> {
  if (
    node.kind === "bool" ||
    node.kind === "i8" ||
    node.kind === "i16" ||
    node.kind === "i32" ||
    node.kind === "u8" ||
    node.kind === "u16" ||
    node.kind === "u32" ||
    node.kind === "utf8-string"
  ) {
    return writePrimitiveNode(writer, node, input);
  }

  if (node.kind === "shape") {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Shape node must be an object.", null));
    }

    const objectInput = input as Record<string, unknown>;
    for (const field of node.fields) {
      if (!(field.key in objectInput)) {
        return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, `Field "${field.key}" is required.`, null));
      }

      const encodedField = writeField(writer, field, objectInput[field.key]);
      if (!encodedField.ok) {
        return encodedField;
      }
    }

    return ok(undefined);
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

    for (const [index, item] of node.items.entries()) {
      const encodedItem = writeNode(writer, item, input[index]);
      if (!encodedItem.ok) {
        return encodedItem;
      }
    }

    return ok(undefined);
  }

  if (node.kind === "object-array") {
    if (!Array.isArray(input)) {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Object array node must be an array.", null));
    }

    const countResult = writeArrayCount(writer, input.length);
    if (!countResult.ok) {
      return countResult;
    }

    for (const item of input) {
      const encodedItem = writeNode(writer, node.item, item);
      if (!encodedItem.ok) {
        return encodedItem;
      }
    }

    return ok(undefined);
  }

  if (node.kind === "scalar-array") {
    if (!Array.isArray(input)) {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Scalar array node must be an array.", null));
    }

    const countResult = writeArrayCount(writer, input.length);
    if (!countResult.ok) {
      return countResult;
    }

    const primitiveNode = createCompiledPrimitiveNode(node.item);
    for (const item of input) {
      const encodedItem = writePrimitiveNode(writer, primitiveNode, item);
      if (!encodedItem.ok) {
        return encodedItem;
      }
    }

    return ok(undefined);
  }

  return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Unsupported compiled node kind.", null));
}

function writeField(writer: GrowableWriter, field: CompiledField, input: unknown): Result<void, FluxBinError> {
  return writeNode(writer, field.node, input);
}

export function encodePayload(
  compiledShape: CompiledRootNode,
  input: unknown,
  options: FluxBinOptions
): Result<Uint8Array, FluxBinError> {
  const writer = createGrowableWriter(options);
  const encoded = writeNode(writer, compiledShape, input);
  if (!encoded.ok) {
    return encoded;
  }

  return ok(finishWriter(writer));
}
