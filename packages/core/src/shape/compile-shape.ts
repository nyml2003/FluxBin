import { DEFAULT_LIMITS, type FluxBinLimits } from "../limits/default-limits.js";
import { ok } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import { isPrimitiveShapeNode, type PrimitiveShapeNode, type Shape } from "./shape-node.js";
import type { CompiledField, CompiledShape } from "./compiled-shape.js";
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

function compileShapeInternal(shape: Shape): CompiledShape {
  const fields: CompiledField[] = [];
  let fixedWidth = true;
  let staticByteLength = 0;
  let maxDepth = 1;

  for (const [key, node] of Object.entries(shape)) {
    if (isPrimitiveShapeNode(node)) {
      const byteWidth = fixedWidthByPrimitive[node];
      const field = {
        key,
        kind: node,
        fixedWidth: byteWidth !== null,
        byteWidth
      } satisfies CompiledField;
      fields.push(field);

      if (byteWidth === null) {
        fixedWidth = false;
        staticByteLength = 0;
      } else if (fixedWidth) {
        staticByteLength += byteWidth;
      }

      continue;
    }

    const nestedShape = compileShapeInternal(node);
    const field = {
      key,
      kind: "shape",
      fixedWidth: nestedShape.fixedWidth,
      byteWidth: nestedShape.staticByteLength,
      shape: nestedShape
    } satisfies CompiledField;
    fields.push(field);

    maxDepth = Math.max(maxDepth, nestedShape.depth + 1);

    if (!nestedShape.fixedWidth) {
      fixedWidth = false;
      staticByteLength = 0;
    } else if (fixedWidth) {
      if (nestedShape.staticByteLength !== null) {
        staticByteLength += nestedShape.staticByteLength;
      }
    }
  }

  return {
    fields,
    fixedWidth,
    staticByteLength: fixedWidth ? staticByteLength : null,
    depth: maxDepth,
    sourceShape: shape
  };
}

export function compileShape(shape: Shape, limits?: FluxBinLimits): Result<CompiledShape, FluxBinError> {
  let resolvedLimits = DEFAULT_LIMITS;
  if (limits !== undefined) {
    resolvedLimits = limits;
  }
  const validated = validateShape(shape, resolvedLimits);
  if (!validated.ok) {
    return validated;
  }

  return ok(compileShapeInternal(shape));
}
