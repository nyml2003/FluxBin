import type { PrimitiveShapeNode, SchemaNode, Shape } from "./shape-node.js";

export type CompiledPrimitiveNode = {
  kind: PrimitiveShapeNode;
  fixedWidth: boolean;
  byteWidth: number | null;
  staticByteLength: number | null;
  depth: number;
};

export type CompiledField = {
  key: string;
  node: CompiledNode;
};

export type CompiledShape = {
  kind: "shape";
  fields: readonly CompiledField[];
  fixedWidth: boolean;
  staticByteLength: number | null;
  depth: number;
  sourceShape: Shape;
};

export type CompiledTupleNode = {
  kind: "tuple";
  items: readonly CompiledNode[];
  fixedWidth: boolean;
  staticByteLength: number | null;
  depth: number;
  sourceTuple: readonly SchemaNode[];
};

export type CompiledObjectArrayNode = {
  kind: "object-array";
  item: CompiledShape;
  fixedWidth: false;
  staticByteLength: null;
  depth: number;
  sourceShape: Shape;
};

export type CompiledScalarArrayNode = {
  kind: "scalar-array";
  item: PrimitiveShapeNode;
  fixedWidth: false;
  staticByteLength: null;
  depth: number;
};

export type CompiledNode =
  | CompiledPrimitiveNode
  | CompiledShape
  | CompiledTupleNode
  | CompiledObjectArrayNode
  | CompiledScalarArrayNode;

export type CompiledRootNode = CompiledShape | CompiledTupleNode | CompiledObjectArrayNode;
