import type { PrimitiveShapeNode, Shape } from "./shape-node.js";

export type CompiledScalarField = {
  key: string;
  kind: PrimitiveShapeNode;
  fixedWidth: boolean;
  byteWidth: number | null;
};

export type CompiledNestedShapeField = {
  key: string;
  kind: "shape";
  fixedWidth: boolean;
  byteWidth: number | null;
  shape: CompiledShape;
};

export type CompiledField = CompiledScalarField | CompiledNestedShapeField;

export type CompiledShape = {
  fields: readonly CompiledField[];
  fixedWidth: boolean;
  staticByteLength: number | null;
  depth: number;
  sourceShape: Shape;
};
