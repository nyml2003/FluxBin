import { ERROR_CODES } from "../errors/error-codes.js";
import { DEFAULT_LIMITS, type FluxBinLimits } from "../limits/default-limits.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import { isPrimitiveShapeNode, isShapeObject, type Shape, type ShapeNode } from "./shape-node.js";

function validateShapeNode(
  key: string,
  node: ShapeNode,
  depth: number,
  limits: FluxBinLimits
): Result<true, FluxBinError> {
  if (depth > limits.maxDepth) {
    return err(
      protocolError(
        ERROR_CODES.DEPTH_LIMIT_EXCEEDED,
        `Shape depth ${String(depth)} exceeds maxDepth ${String(limits.maxDepth)}.`,
        null
      )
    );
  }

  if (isPrimitiveShapeNode(node)) {
    return ok(true);
  }

  if (!isShapeObject(node)) {
    return err(
      protocolError(
        ERROR_CODES.INVALID_NODE_TYPE,
        `Field "${key}" must be a primitive shape node or nested shape.`,
        null
      )
    );
  }

  return validateShape(node, limits, depth + 1);
}

export function validateShape(
  shape: Shape,
  limits?: FluxBinLimits,
  depth?: number
): Result<true, FluxBinError> {
  let resolvedLimits = DEFAULT_LIMITS;
  if (limits !== undefined) {
    resolvedLimits = limits;
  }

  let resolvedDepth = 1;
  if (depth !== undefined) {
    resolvedDepth = depth;
  }

  if (!isShapeObject(shape)) {
    return err(protocolError(ERROR_CODES.INVALID_SHAPE, "Shape must be a plain object.", null));
  }

  const entries = Object.entries(shape);
  for (const [key, node] of entries) {
    if (key.length === 0) {
      return err(protocolError(ERROR_CODES.INVALID_SHAPE, "Shape keys must not be empty.", null));
    }

    const nodeResult = validateShapeNode(key, node, resolvedDepth, resolvedLimits);
    if (!nodeResult.ok) {
      return nodeResult;
    }
  }

  return ok(true);
}
