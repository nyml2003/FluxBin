export type PrimitiveShapeNode = "u8" | "i8" | "u16" | "i16" | "u32" | "i32" | "bool" | "utf8-string";

export type Shape = {
  readonly [key: string]: ShapeNode;
};

export type ShapeNode = PrimitiveShapeNode | Shape;

const primitiveKinds = new Set<PrimitiveShapeNode>(["u8", "i8", "u16", "i16", "u32", "i32", "bool", "utf8-string"]);

export function isPrimitiveShapeNode(value: unknown): value is PrimitiveShapeNode {
  if (typeof value !== "string") {
    return false;
  }

  return primitiveKinds.has(value as PrimitiveShapeNode);
}

export function isShapeObject(value: unknown): value is Shape {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype === Object.prototype) {
    return true;
  }

  return prototype === null;
}
