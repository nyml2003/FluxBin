import { ERROR_CODES } from "../errors/error-codes.js";
import { DEFAULT_LIMITS, type FluxBinLimits } from "../limits/default-limits.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import {
  isObjectArrayShapeNode,
  isPrimitiveShapeNode,
  isShapeObject,
  isScalarArrayShapeNode,
  isTupleShapeNode,
  type SchemaNode,
  type TypedRootNode
} from "./shape-node.js";

function hasReservedNodeKey(value: object): boolean {
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return false;
  }

  const key = keys[0];
  if (key === "tuple" || key === "objectArray" || key === "scalarArray") {
    return true;
  }

  return false;
}

function validateShapeNode(
  key: string,
  node: SchemaNode,
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

  if (isTupleShapeNode(node)) {
    if (node.tuple.length === 0) {
      return err(protocolError(ERROR_CODES.INVALID_SHAPE, `Tuple "${key}" must not be empty.`, null));
    }

    for (const [index, item] of node.tuple.entries()) {
      const itemResult = validateShapeNode(`${key}[${String(index)}]`, item, depth + 1, limits);
      if (!itemResult.ok) {
        return itemResult;
      }
    }

    return ok(true);
  }

  if (isObjectArrayShapeNode(node)) {
    return validateShape(node.objectArray, limits, depth + 1);
  }

  if (isScalarArrayShapeNode(node)) {
    return ok(true);
  }

  if (typeof node === "object" && node !== null && !Array.isArray(node) && hasReservedNodeKey(node)) {
    return err(
      protocolError(
        ERROR_CODES.INVALID_NODE_TYPE,
        `Field "${key}" uses a reserved node key but does not match a supported node shape.`,
        null
      )
    );
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
  shape: TypedRootNode,
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

  if (isTupleShapeNode(shape)) {
    return validateShapeNode("tuple", shape, resolvedDepth, resolvedLimits);
  }

  if (isObjectArrayShapeNode(shape)) {
    return validateShapeNode("objectArray", shape, resolvedDepth, resolvedLimits);
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
