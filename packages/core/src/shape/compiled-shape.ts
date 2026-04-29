import type { PrimitiveShapeNode, SchemaNode, Shape } from "./shape-node.js";

export type CompiledPrimitiveNode = {
  kind: PrimitiveShapeNode;
  fixedWidth: boolean;
  byteWidth: number | null;
  staticByteLength: number | null;
  depth: number;
};

export type CompiledField = {
  fixedOffset: number | null;
  key: string;
  node: CompiledNode;
};

export type CompiledShape = {
  fieldIndexByKey: Readonly<Record<string, number>>;
  kind: "shape";
  fields: readonly CompiledField[];
  fixedWidth: boolean;
  staticByteLength: number | null;
  depth: number;
  sourceShape: Shape;
};

export type CompiledTupleNode = {
  kind: "tuple";
  itemFixedOffsets: readonly (number | null)[];
  items: readonly CompiledNode[];
  fixedWidth: boolean;
  staticByteLength: number | null;
  depth: number;
  sourceTuple: readonly SchemaNode[];
};

export type CompiledObjectArrayNode = {
  fixedItemByteWidth: number | null;
  kind: "object-array";
  item: CompiledShape;
  fixedWidth: false;
  staticByteLength: null;
  depth: number;
  sourceShape: Shape;
};

export type CompiledScalarArrayNode = {
  fixedItemByteWidth: number | null;
  kind: "scalar-array";
  item: PrimitiveShapeNode;
  itemNode: CompiledPrimitiveNode;
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
