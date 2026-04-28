import { DEFAULT_LIMITS, type FluxBinLimits } from "../limits/default-limits.js";
import { ok } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import {
  isObjectArrayShapeNode,
  isPrimitiveShapeNode,
  isScalarArrayShapeNode,
  isTupleShapeNode,
  type PrimitiveShapeNode,
  type SchemaNode,
  type Shape,
  type TypedRootNode
} from "./shape-node.js";
import type {
  CompiledField,
  CompiledNode,
  CompiledObjectArrayNode,
  CompiledPrimitiveNode,
  CompiledRootNode,
  CompiledScalarArrayNode,
  CompiledShape,
  CompiledTupleNode
} from "./compiled-shape.js";
import { validateShape } from "./validate-shape.js";

const fixedWidthByPrimitive: Record<PrimitiveShapeNode, number | null> = {
  bool: 1,
  i16: 2,
  i32: 4,
  i8: 1,
  u16: 2,
  u32: 4,
  u8: 1,
  "utf8-string": null
};

function createCompiledPrimitiveNode(node: PrimitiveShapeNode): CompiledPrimitiveNode {
  const byteWidth = fixedWidthByPrimitive[node];
  return {
    kind: node,
    fixedWidth: byteWidth !== null,
    byteWidth,
    staticByteLength: byteWidth,
    depth: 0
  };
}

function getCompiledNodeByteLength(node: CompiledNode): number | null {
  if (node.kind === "shape" || node.kind === "tuple") {
    return node.staticByteLength;
  }

  if (node.kind === "object-array" || node.kind === "scalar-array") {
    return null;
  }

  return node.byteWidth;
}

function compileObjectShape(shape: Shape): CompiledShape {
  const fields: CompiledField[] = [];
  let fixedWidth = true;
  let staticByteLength = 0;
  let maxDepth = 1;

  for (const [key, node] of Object.entries(shape)) {
    const compiledNode = compileNodeInternal(node);
    fields.push({
      key,
      node: compiledNode
    });

    maxDepth = Math.max(maxDepth, compiledNode.depth + 1);

    if (!compiledNode.fixedWidth) {
      fixedWidth = false;
      staticByteLength = 0;
    } else if (fixedWidth) {
      const byteWidth = getCompiledNodeByteLength(compiledNode);
      if (byteWidth !== null) {
        staticByteLength += byteWidth;
      }
    }
  }

  return {
    kind: "shape",
    fields,
    fixedWidth,
    staticByteLength: fixedWidth ? staticByteLength : null,
    depth: maxDepth,
    sourceShape: shape
  };
}

function compileTupleNode(tupleNode: { tuple: readonly SchemaNode[] }): CompiledTupleNode {
  const items: CompiledNode[] = [];
  let fixedWidth = true;
  let staticByteLength = 0;
  let maxDepth = 1;

  for (const item of tupleNode.tuple) {
    const compiledNode = compileNodeInternal(item);
    items.push(compiledNode);
    maxDepth = Math.max(maxDepth, compiledNode.depth + 1);

    if (!compiledNode.fixedWidth) {
      fixedWidth = false;
      staticByteLength = 0;
    } else if (fixedWidth) {
      const byteWidth = getCompiledNodeByteLength(compiledNode);
      if (byteWidth !== null) {
        staticByteLength += byteWidth;
      }
    }
  }

  return {
    kind: "tuple",
    items,
    fixedWidth,
    staticByteLength: fixedWidth ? staticByteLength : null,
    depth: maxDepth,
    sourceTuple: tupleNode.tuple
  };
}

function compileObjectArrayNode(node: { objectArray: Shape }): CompiledObjectArrayNode {
  const compiledShape = compileObjectShape(node.objectArray);
  return {
    kind: "object-array",
    item: compiledShape,
    fixedWidth: false,
    staticByteLength: null,
    depth: compiledShape.depth + 1,
    sourceShape: node.objectArray
  };
}

function compileScalarArrayNode(node: { scalarArray: PrimitiveShapeNode }): CompiledScalarArrayNode {
  return {
    kind: "scalar-array",
    item: node.scalarArray,
    fixedWidth: false,
    staticByteLength: null,
    depth: 1
  };
}

function compileNodeInternal(node: SchemaNode): CompiledNode {
  if (isPrimitiveShapeNode(node)) {
    return createCompiledPrimitiveNode(node);
  }

  if (isTupleShapeNode(node)) {
    return compileTupleNode(node);
  }

  if (isObjectArrayShapeNode(node)) {
    return compileObjectArrayNode(node);
  }

  if (isScalarArrayShapeNode(node)) {
    return compileScalarArrayNode(node);
  }

  return compileObjectShape(node);
}

export function compileShape(shape: TypedRootNode, limits?: FluxBinLimits): Result<CompiledRootNode, FluxBinError> {
  let resolvedLimits = DEFAULT_LIMITS;
  if (limits !== undefined) {
    resolvedLimits = limits;
  }
  const validated = validateShape(shape, resolvedLimits);
  if (!validated.ok) {
    return validated;
  }

  return ok(compileNodeInternal(shape) as CompiledRootNode);
}
