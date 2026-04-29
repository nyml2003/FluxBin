/**
 * payload 懒解析读取器。
 *
 * 这个模块提供显式 lazy reader：
 * - object / tuple / object-array / scalar-array 都按需读取
 * - 访问过的值会缓存
 * - 扫描出的偏移也会缓存
 *
 * 这里不走 Proxy，不做属性劫持。
 * 调用方必须显式调用 `get()` / `length()` / `materialize()`。
 */
import { ERROR_CODES } from "../errors/error-codes.js";
import type { FluxBinError } from "../errors/error-types.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import type {
  CompiledNode,
  CompiledObjectArrayNode,
  CompiledPrimitiveNode,
  CompiledRootNode,
  CompiledScalarArrayNode,
  CompiledShape,
  CompiledTupleNode
} from "../shape/compiled-shape.js";
import { readBool } from "../scalar/bool.js";
import { readI16, readI32, readI8, readU16, readU32, readU8 } from "../scalar/read-scalars.js";
import { decodeUtf8String } from "../scalar/utf8.js";
import type { Result } from "../types/result.js";

export type LazyResolvedValue = LazyPayloadReader | boolean | number | string;

type PrimitiveReadValue = {
  nextOffset: number;
  value: boolean | number | string;
};

type CountReadValue = {
  nextOffset: number;
  value: number;
};

type ReaderContext = {
  options: FluxBinOptions;
  view: DataView;
};

type LazyReaderBase = {
  byteLength: number;
  kind: CompiledNode["kind"];
  materialize(): Result<unknown, FluxBinError>;
};

export type LazyShapeReader = LazyReaderBase & {
  get(key: string): Result<LazyResolvedValue, FluxBinError>;
  keys(): readonly string[];
  kind: "shape";
};

export type LazyTupleReader = LazyReaderBase & {
  get(index: number): Result<LazyResolvedValue, FluxBinError>;
  kind: "tuple";
  length(): number;
};

export type LazyObjectArrayReader = LazyReaderBase & {
  get(index: number): Result<LazyResolvedValue, FluxBinError>;
  kind: "object-array";
  length(): Result<number, FluxBinError>;
};

export type LazyScalarArrayReader = LazyReaderBase & {
  get(index: number): Result<boolean | number | string, FluxBinError>;
  kind: "scalar-array";
  length(): Result<number, FluxBinError>;
};

export type LazyPayloadReader =
  | LazyObjectArrayReader
  | LazyScalarArrayReader
  | LazyShapeReader
  | LazyTupleReader;

type BaseInternalReader = {
  _context: ReaderContext;
  _end: number;
  _start: number;
  byteLength: number;
  kind: CompiledNode["kind"];
  materialize(): Result<unknown, FluxBinError>;
};

type ShapeInternalReader = BaseInternalReader & {
  _fieldOffsets: Map<number, number>;
  _fieldValues: Map<number, LazyResolvedValue>;
  _node: CompiledShape;
  get(key: string): Result<LazyResolvedValue, FluxBinError>;
  keys(): readonly string[];
  kind: "shape";
};

type TupleInternalReader = BaseInternalReader & {
  _itemOffsets: Map<number, number>;
  _itemValues: Map<number, LazyResolvedValue>;
  _node: CompiledTupleNode;
  get(index: number): Result<LazyResolvedValue, FluxBinError>;
  kind: "tuple";
  length(): number;
};

type ObjectArrayInternalReader = BaseInternalReader & {
  _cachedLength: number | null;
  _itemOffsets: Map<number, number>;
  _itemValues: Map<number, LazyResolvedValue>;
  _node: CompiledObjectArrayNode;
  get(index: number): Result<LazyResolvedValue, FluxBinError>;
  kind: "object-array";
  length(): Result<number, FluxBinError>;
};

type ScalarArrayInternalReader = BaseInternalReader & {
  _cachedLength: number | null;
  _itemOffsets: Map<number, number>;
  _itemValues: Map<number, boolean | number | string>;
  _node: CompiledScalarArrayNode;
  get(index: number): Result<boolean | number | string, FluxBinError>;
  kind: "scalar-array";
  length(): Result<number, FluxBinError>;
};

class LazyReaderFailure extends Error {
  readonly inner: FluxBinError;

  constructor(inner: FluxBinError) {
    super(inner.message);
    this.inner = inner;
    this.name = "LazyReaderFailure";
  }
}

function fail(inner: FluxBinError): never {
  throw new LazyReaderFailure(inner);
}

function toFluxBinError(error: unknown): FluxBinError {
  if (error instanceof LazyReaderFailure) {
    return error.inner;
  }

  if (typeof error === "object" && error !== null && "kind" in error && "code" in error && "message" in error) {
    return error as FluxBinError;
  }

  return protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Unexpected lazy reader failure.", null, error);
}

function withResult<T>(fn: () => T): Result<T, FluxBinError> {
  try {
    return ok(fn());
  } catch (error) {
    return err(toFluxBinError(error));
  }
}

function readPrimitiveNodeUnsafe(node: CompiledPrimitiveNode, context: ReaderContext, offset: number): PrimitiveReadValue {
  switch (node.kind) {
    case "bool": {
      const result = readBool(context.view, offset);
      if (!result.ok) {
        fail(result.error);
      }
      return result.value;
    }
    case "i8": {
      const result = readI8(context.view, offset);
      if (!result.ok) {
        fail(result.error);
      }
      return result.value;
    }
    case "i16": {
      const result = readI16(context.view, offset, context.options.endian);
      if (!result.ok) {
        fail(result.error);
      }
      return result.value;
    }
    case "i32": {
      const result = readI32(context.view, offset, context.options.endian);
      if (!result.ok) {
        fail(result.error);
      }
      return result.value;
    }
    case "u8": {
      const result = readU8(context.view, offset);
      if (!result.ok) {
        fail(result.error);
      }
      return result.value;
    }
    case "u16": {
      const result = readU16(context.view, offset, context.options.endian);
      if (!result.ok) {
        fail(result.error);
      }
      return result.value;
    }
    case "u32": {
      const result = readU32(context.view, offset, context.options.endian);
      if (!result.ok) {
        fail(result.error);
      }
      return result.value;
    }
    case "utf8-string": {
      const result = decodeUtf8String(context.view, offset, context.options.endian, context.options.limits);
      if (!result.ok) {
        fail(result.error);
      }
      return result.value;
    }
  }
}

function readArrayLengthUnsafe(context: ReaderContext, offset: number): CountReadValue {
  const result = readU32(context.view, offset, context.options.endian);
  if (!result.ok) {
    fail(result.error);
  }
  if (result.value.value > context.options.limits.maxArrayLength) {
    fail(
      protocolError(
        ERROR_CODES.ARRAY_LENGTH_EXCEEDED,
        `Array length ${String(result.value.value)} exceeds maxArrayLength ${String(context.options.limits.maxArrayLength)}.`,
        offset
      )
    );
  }

  return result.value;
}

function scanNodeUnsafe(node: CompiledNode, context: ReaderContext, offset: number): number {
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
    return readPrimitiveNodeUnsafe(node, context, offset).nextOffset;
  }

  if (node.kind === "shape") {
    let nextOffset = offset;
    for (const field of node.fields) {
      nextOffset = scanNodeUnsafe(field.node, context, nextOffset);
    }
    return nextOffset;
  }

  if (node.kind === "tuple") {
    let nextOffset = offset;
    for (const item of node.items) {
      nextOffset = scanNodeUnsafe(item, context, nextOffset);
    }
    return nextOffset;
  }

  if (node.kind === "object-array") {
    const countResult = readArrayLengthUnsafe(context, offset);
    let nextOffset = countResult.nextOffset;
    for (let index = 0; index < countResult.value; index += 1) {
      nextOffset = scanNodeUnsafe(node.item, context, nextOffset);
    }
    return nextOffset;
  }

  if (node.kind === "scalar-array") {
    const countResult = readArrayLengthUnsafe(context, offset);
    let nextOffset = countResult.nextOffset;
    for (let index = 0; index < countResult.value; index += 1) {
      nextOffset = scanNodeUnsafe(node.itemNode, context, nextOffset);
    }
    return nextOffset;
  }

  fail(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Unsupported compiled node kind.", null));
}

function createReaderFromRange(node: CompiledNode, context: ReaderContext, startOffset: number, endOffset: number): LazyPayloadReader {
  const byteLength = endOffset - startOffset;

  if (node.kind === "shape") {
    const reader: ShapeInternalReader = {
      _context: context,
      _end: endOffset,
      _fieldOffsets: new Map([[0, startOffset]]),
      _fieldValues: new Map(),
      _node: node,
      _start: startOffset,
      byteLength,
      get: shapeGet,
      keys: shapeKeys,
      kind: "shape",
      materialize: shapeMaterialize
    };
    return reader;
  }

  if (node.kind === "tuple") {
    const reader: TupleInternalReader = {
      _context: context,
      _end: endOffset,
      _itemOffsets: new Map([[0, startOffset]]),
      _itemValues: new Map(),
      _node: node,
      _start: startOffset,
      byteLength,
      get: tupleGet,
      kind: "tuple",
      length: tupleLength,
      materialize: tupleMaterialize
    };
    return reader;
  }

  if (node.kind === "object-array") {
    const reader: ObjectArrayInternalReader = {
      _cachedLength: null,
      _context: context,
      _end: endOffset,
      _itemOffsets: new Map(),
      _itemValues: new Map(),
      _node: node,
      _start: startOffset,
      byteLength,
      get: objectArrayGet,
      kind: "object-array",
      length: objectArrayLength,
      materialize: objectArrayMaterialize
    };
    return reader;
  }

  if (node.kind !== "scalar-array") {
    fail(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "Unsupported compiled node kind.", null));
  }

  const scalarArrayNode: CompiledScalarArrayNode = node;
  const reader: ScalarArrayInternalReader = {
    _cachedLength: null,
    _context: context,
    _end: endOffset,
    _itemOffsets: new Map(),
    _itemValues: new Map(),
    _node: scalarArrayNode,
    _start: startOffset,
    byteLength,
    get: scalarArrayGet,
    kind: "scalar-array",
    length: scalarArrayLength,
    materialize: scalarArrayMaterialize
  };
  return reader;
}

function createSubValue(node: CompiledNode, context: ReaderContext, startOffset: number, endOffset: number): LazyResolvedValue {
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
    return readPrimitiveNodeUnsafe(node, context, startOffset).value;
  }

  return createReaderFromRange(node, context, startOffset, endOffset);
}

function shapeResolveFieldIndexUnsafe(reader: ShapeInternalReader, targetIndex: number): number {
  if (reader._node.fixedWidth) {
    const field = reader._node.fields[targetIndex];
    if (field === undefined || field.fixedOffset === null) {
      fail(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Shape field index is out of bounds.", null));
    }

    return reader._start + field.fixedOffset;
  }

  let scanIndex = 0;
  let currentOffset = reader._start;

  for (let index = targetIndex; index >= 0; index -= 1) {
    const cachedOffset = reader._fieldOffsets.get(index);
    if (cachedOffset !== undefined) {
      scanIndex = index;
      currentOffset = cachedOffset;
      break;
    }
  }

  for (let index = scanIndex; index < targetIndex; index += 1) {
    const field = reader._node.fields[index];
    if (field === undefined) {
      fail(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Shape field index is out of bounds.", null));
    }

    currentOffset = scanNodeUnsafe(field.node, reader._context, currentOffset);
    reader._fieldOffsets.set(index + 1, currentOffset);
  }

  return currentOffset;
}

function shapeGetUnsafe(reader: ShapeInternalReader, key: string): LazyResolvedValue {
  const fieldIndex = reader._node.fieldIndexByKey[key];
  if (fieldIndex === undefined) {
    fail(protocolError(ERROR_CODES.UNKNOWN_FIELD, `Unknown shape field "${key}".`, null));
  }

  const cachedValue = reader._fieldValues.get(fieldIndex);
  if (cachedValue !== undefined) {
    return cachedValue;
  }

  const field = reader._node.fields[fieldIndex];
  if (field === undefined) {
    fail(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Shape field index is out of bounds.", null));
  }

  const startOffset = shapeResolveFieldIndexUnsafe(reader, fieldIndex);
  const endOffset = scanNodeUnsafe(field.node, reader._context, startOffset);
  reader._fieldOffsets.set(fieldIndex + 1, endOffset);

  const resolvedValue = createSubValue(field.node, reader._context, startOffset, endOffset);
  reader._fieldValues.set(fieldIndex, resolvedValue);
  return resolvedValue;
}

function shapeGet(this: ShapeInternalReader, key: string): Result<LazyResolvedValue, FluxBinError> {
  return withResult(() => shapeGetUnsafe(this, key));
}

function shapeKeys(this: ShapeInternalReader): readonly string[] {
  return this._node.fields.map((field) => field.key);
}

function shapeMaterialize(this: ShapeInternalReader): Result<Record<string, unknown>, FluxBinError> {
  return withResult(() => {
    const value: Record<string, unknown> = {};
    for (const field of this._node.fields) {
      const nextValue = shapeGetUnsafe(this, field.key);
      if (typeof nextValue === "object" && nextValue !== null && "materialize" in nextValue) {
        const materialized = nextValue.materialize();
        if (!materialized.ok) {
          fail(materialized.error);
        }
        value[field.key] = materialized.value;
      } else {
        value[field.key] = nextValue;
      }
    }

    return value;
  });
}

function tupleResolveItemIndexUnsafe(reader: TupleInternalReader, targetIndex: number): number {
  if (reader._node.fixedWidth) {
    const fixedOffset = reader._node.itemFixedOffsets[targetIndex];
    if (fixedOffset === undefined || fixedOffset === null) {
      fail(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Tuple index is out of bounds.", null));
    }

    return reader._start + fixedOffset;
  }

  let scanIndex = 0;
  let currentOffset = reader._start;

  for (let index = targetIndex; index >= 0; index -= 1) {
    const cachedOffset = reader._itemOffsets.get(index);
    if (cachedOffset !== undefined) {
      scanIndex = index;
      currentOffset = cachedOffset;
      break;
    }
  }

  for (let index = scanIndex; index < targetIndex; index += 1) {
    const item = reader._node.items[index];
    if (item === undefined) {
      fail(protocolError(ERROR_CODES.OUT_OF_BOUNDS, "Tuple index is out of bounds.", null));
    }

    currentOffset = scanNodeUnsafe(item, reader._context, currentOffset);
    reader._itemOffsets.set(index + 1, currentOffset);
  }

  return currentOffset;
}

function tupleGetUnsafe(reader: TupleInternalReader, index: number): LazyResolvedValue {
  if (!Number.isInteger(index) || index < 0 || index >= reader._node.items.length) {
    fail(protocolError(ERROR_CODES.OUT_OF_BOUNDS, `Tuple index ${String(index)} is out of bounds.`, null));
  }

  const cachedValue = reader._itemValues.get(index);
  if (cachedValue !== undefined) {
    return cachedValue;
  }

  const item = reader._node.items[index];
  if (item === undefined) {
    fail(protocolError(ERROR_CODES.OUT_OF_BOUNDS, `Tuple index ${String(index)} is out of bounds.`, null));
  }

  const startOffset = tupleResolveItemIndexUnsafe(reader, index);
  const endOffset = scanNodeUnsafe(item, reader._context, startOffset);
  reader._itemOffsets.set(index + 1, endOffset);

  const resolvedValue = createSubValue(item, reader._context, startOffset, endOffset);
  reader._itemValues.set(index, resolvedValue);
  return resolvedValue;
}

function tupleGet(this: TupleInternalReader, index: number): Result<LazyResolvedValue, FluxBinError> {
  return withResult(() => tupleGetUnsafe(this, index));
}

function tupleLength(this: TupleInternalReader): number {
  return this._node.items.length;
}

function tupleMaterialize(this: TupleInternalReader): Result<unknown[], FluxBinError> {
  return withResult(() => {
    const value: unknown[] = [];
    for (let index = 0; index < this._node.items.length; index += 1) {
      const nextValue = tupleGetUnsafe(this, index);
      if (typeof nextValue === "object" && nextValue !== null && "materialize" in nextValue) {
        const materialized = nextValue.materialize();
        if (!materialized.ok) {
          fail(materialized.error);
        }
        value.push(materialized.value);
      } else {
        value.push(nextValue);
      }
    }

    return value;
  });
}

function objectArrayResolveLengthUnsafe(reader: ObjectArrayInternalReader): number {
  if (reader._cachedLength !== null) {
    return reader._cachedLength;
  }

  const countResult = readArrayLengthUnsafe(reader._context, reader._start);
  reader._cachedLength = countResult.value;
  reader._itemOffsets.set(0, countResult.nextOffset);
  return reader._cachedLength;
}

function objectArrayResolveItemIndexUnsafe(reader: ObjectArrayInternalReader, targetIndex: number): number {
  const length = objectArrayResolveLengthUnsafe(reader);
  if (targetIndex >= length) {
    fail(protocolError(ERROR_CODES.OUT_OF_BOUNDS, `Object array index ${String(targetIndex)} is out of bounds.`, null));
  }

  if (reader._node.fixedItemByteWidth !== null) {
    const itemStart = reader._itemOffsets.get(0) ?? reader._start;
    return itemStart + targetIndex * reader._node.fixedItemByteWidth;
  }

  let scanIndex = 0;
  let currentOffset = reader._itemOffsets.get(0) ?? reader._start;

  for (let index = targetIndex; index >= 0; index -= 1) {
    const cachedOffset = reader._itemOffsets.get(index);
    if (cachedOffset !== undefined) {
      scanIndex = index;
      currentOffset = cachedOffset;
      break;
    }
  }

  for (let index = scanIndex; index < targetIndex; index += 1) {
    currentOffset = scanNodeUnsafe(reader._node.item, reader._context, currentOffset);
    reader._itemOffsets.set(index + 1, currentOffset);
  }

  return currentOffset;
}

function objectArrayGetUnsafe(reader: ObjectArrayInternalReader, index: number): LazyResolvedValue {
  if (!Number.isInteger(index) || index < 0) {
    fail(protocolError(ERROR_CODES.OUT_OF_BOUNDS, `Object array index ${String(index)} is out of bounds.`, null));
  }

  const cachedValue = reader._itemValues.get(index);
  if (cachedValue !== undefined) {
    return cachedValue;
  }

  const startOffset = objectArrayResolveItemIndexUnsafe(reader, index);
  const endOffset = scanNodeUnsafe(reader._node.item, reader._context, startOffset);
  reader._itemOffsets.set(index + 1, endOffset);

  const resolvedValue = createSubValue(reader._node.item, reader._context, startOffset, endOffset);
  reader._itemValues.set(index, resolvedValue);
  return resolvedValue;
}

function objectArrayGet(this: ObjectArrayInternalReader, index: number): Result<LazyResolvedValue, FluxBinError> {
  return withResult(() => objectArrayGetUnsafe(this, index));
}

function objectArrayLength(this: ObjectArrayInternalReader): Result<number, FluxBinError> {
  return withResult(() => objectArrayResolveLengthUnsafe(this));
}

function objectArrayMaterialize(this: ObjectArrayInternalReader): Result<unknown[], FluxBinError> {
  return withResult(() => {
    const length = objectArrayResolveLengthUnsafe(this);
    const value: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const nextValue = objectArrayGetUnsafe(this, index);
      if (typeof nextValue === "object" && nextValue !== null && "materialize" in nextValue) {
        const materialized = nextValue.materialize();
        if (!materialized.ok) {
          fail(materialized.error);
        }
        value.push(materialized.value);
      } else {
        value.push(nextValue);
      }
    }

    return value;
  });
}

function scalarArrayResolveLengthUnsafe(reader: ScalarArrayInternalReader): number {
  if (reader._cachedLength !== null) {
    return reader._cachedLength;
  }

  const countResult = readArrayLengthUnsafe(reader._context, reader._start);
  reader._cachedLength = countResult.value;
  reader._itemOffsets.set(0, countResult.nextOffset);
  return reader._cachedLength;
}

function scalarArrayResolveItemIndexUnsafe(reader: ScalarArrayInternalReader, targetIndex: number): number {
  const length = scalarArrayResolveLengthUnsafe(reader);
  if (targetIndex >= length) {
    fail(protocolError(ERROR_CODES.OUT_OF_BOUNDS, `Scalar array index ${String(targetIndex)} is out of bounds.`, null));
  }

  if (reader._node.fixedItemByteWidth !== null) {
    const itemStart = reader._itemOffsets.get(0) ?? reader._start;
    return itemStart + targetIndex * reader._node.fixedItemByteWidth;
  }

  let scanIndex = 0;
  let currentOffset = reader._itemOffsets.get(0) ?? reader._start;

  for (let index = targetIndex; index >= 0; index -= 1) {
    const cachedOffset = reader._itemOffsets.get(index);
    if (cachedOffset !== undefined) {
      scanIndex = index;
      currentOffset = cachedOffset;
      break;
    }
  }

  for (let index = scanIndex; index < targetIndex; index += 1) {
    currentOffset = scanNodeUnsafe(reader._node.itemNode, reader._context, currentOffset);
    reader._itemOffsets.set(index + 1, currentOffset);
  }

  return currentOffset;
}

function scalarArrayGetUnsafe(reader: ScalarArrayInternalReader, index: number): boolean | number | string {
  if (!Number.isInteger(index) || index < 0) {
    fail(protocolError(ERROR_CODES.OUT_OF_BOUNDS, `Scalar array index ${String(index)} is out of bounds.`, null));
  }

  const cachedValue = reader._itemValues.get(index);
  if (cachedValue !== undefined) {
    return cachedValue;
  }

  const startOffset = scalarArrayResolveItemIndexUnsafe(reader, index);
  const resolvedValue = readPrimitiveNodeUnsafe(reader._node.itemNode, reader._context, startOffset);
  reader._itemOffsets.set(index + 1, resolvedValue.nextOffset);
  reader._itemValues.set(index, resolvedValue.value);
  return resolvedValue.value;
}

function scalarArrayGet(this: ScalarArrayInternalReader, index: number): Result<boolean | number | string, FluxBinError> {
  return withResult(() => scalarArrayGetUnsafe(this, index));
}

function scalarArrayLength(this: ScalarArrayInternalReader): Result<number, FluxBinError> {
  return withResult(() => scalarArrayResolveLengthUnsafe(this));
}

function scalarArrayMaterialize(this: ScalarArrayInternalReader): Result<Array<boolean | number | string>, FluxBinError> {
  return withResult(() => {
    const length = scalarArrayResolveLengthUnsafe(this);
    const value: Array<boolean | number | string> = [];
    for (let index = 0; index < length; index += 1) {
      value.push(scalarArrayGetUnsafe(this, index));
    }

    return value;
  });
}

function createLazyNodeReader(
  compiledShape: CompiledNode,
  payload: Uint8Array,
  options: FluxBinOptions
): LazyPayloadReader {
  const context: ReaderContext = {
    options,
    view: new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  };

  return createReaderFromRange(compiledShape, context, 0, payload.byteLength);
}

export function createLazyPayloadReader(
  compiledShape: CompiledRootNode,
  payload: Uint8Array,
  options: FluxBinOptions
): LazyPayloadReader {
  return createLazyNodeReader(compiledShape, payload, options);
}
