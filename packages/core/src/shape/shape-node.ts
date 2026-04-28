export type PrimitiveShapeNode = "u8" | "i8" | "u16" | "i16" | "u32" | "i32" | "bool" | "utf8-string";

export type Shape = {
  readonly [key: string]: SchemaNode;
};

export type TupleShapeNode = {
  tuple: readonly SchemaNode[];
};

export type ObjectArrayShapeNode = {
  objectArray: Shape;
};

export type ScalarArrayShapeNode = {
  scalarArray: PrimitiveShapeNode;
};

export type SchemaNode = PrimitiveShapeNode | Shape | TupleShapeNode | ObjectArrayShapeNode | ScalarArrayShapeNode;

export type TypedRootNode = Shape | TupleShapeNode | ObjectArrayShapeNode;

const primitiveKinds = new Set<PrimitiveShapeNode>(["u8", "i8", "u16", "i16", "u32", "i32", "bool", "utf8-string"]);

export function isPrimitiveShapeNode(value: unknown): value is PrimitiveShapeNode {
  if (typeof value !== "string") {
    return false;
  }

  return primitiveKinds.has(value as PrimitiveShapeNode);
}

export function isTupleShapeNode(value: unknown): value is TupleShapeNode {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "tuple") {
    return false;
  }

  return Array.isArray((value as { tuple?: unknown }).tuple);
}

export function isObjectArrayShapeNode(value: unknown): value is ObjectArrayShapeNode {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "objectArray") {
    return false;
  }

  return isShapeObject((value as { objectArray?: unknown }).objectArray);
}

export function isScalarArrayShapeNode(value: unknown): value is ScalarArrayShapeNode {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "scalarArray") {
    return false;
  }

  return isPrimitiveShapeNode((value as { scalarArray?: unknown }).scalarArray);
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
