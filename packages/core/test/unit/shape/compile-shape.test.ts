import { describe, expect, it } from "vitest";
import { compileShape } from "../../../src/shape/compile-shape.js";
import { validateShape } from "../../../src/shape/validate-shape.js";
import { createOptions } from "../../../src/limits/default-limits.js";

describe("compileShape", () => {
  it("marks a fixed-width shape correctly", () => {
    const result = compileShape({
      active: "bool",
      id: "u32",
      score: "i16"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.fixedWidth).toBe(true);
    expect(result.value.staticByteLength).toBe(7);
  });

  it("marks a variable-width shape correctly", () => {
    const result = compileShape({
      id: "u32",
      profile: {
        nickname: "utf8-string"
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.fixedWidth).toBe(false);
    expect(result.value.staticByteLength).toBeNull();
    expect(result.value.depth).toBe(2);
  });

  it("compiles tuple roots and nested tuples", () => {
    const result = compileShape({
      tuple: ["u32", "utf8-string", { tuple: ["bool", "i16"] }]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.kind).toBe("tuple");
    expect(result.value.fixedWidth).toBe(false);
    expect(result.value.depth).toBe(2);
    if (result.value.kind === "tuple") {
      expect(result.value.items).toHaveLength(3);
      expect(result.value.items[2]?.kind).toBe("tuple");
    }
  });

  it("compiles objectArray, scalarArray, and objectArray roots", () => {
    const typedFieldArrays = compileShape({
      ids: { scalarArray: "u32" },
      users: {
        objectArray: {
          active: "bool",
          name: "utf8-string"
        }
      }
    });

    expect(typedFieldArrays.ok).toBe(true);
    if (!typedFieldArrays.ok) {
      return;
    }

    expect(typedFieldArrays.value.kind).toBe("shape");
    expect(typedFieldArrays.value.fixedWidth).toBe(false);

    const objectArrayRoot = compileShape({
      objectArray: {
        id: "u32",
        label: "utf8-string"
      }
    });

    expect(objectArrayRoot.ok).toBe(true);
    if (!objectArrayRoot.ok) {
      return;
    }

    expect(objectArrayRoot.value.kind).toBe("object-array");
  });

  it("rejects non-plain objects as shapes", () => {
    const dateResult = validateShape(new Date() as never);
    expect(dateResult.ok).toBe(false);

    const mapResult = validateShape(new Map() as never);
    expect(mapResult.ok).toBe(false);
  });

  it("rejects invalid keys, invalid nested nodes, and excessive depth", () => {
    const emptyKey = validateShape({ "": "u8" });
    expect(emptyKey.ok).toBe(false);
    if (!emptyKey.ok) {
      expect(emptyKey.error.code).toBe("INVALID_SHAPE");
    }

    const invalidNested = validateShape({ child: 1 as never });
    expect(invalidNested.ok).toBe(false);
    if (!invalidNested.ok) {
      expect(invalidNested.error.code).toBe("INVALID_NODE_TYPE");
    }

    const emptyTuple = validateShape({ tuple: [] });
    expect(emptyTuple.ok).toBe(false);
    if (!emptyTuple.ok) {
      expect(emptyTuple.error.code).toBe("INVALID_SHAPE");
    }

    const invalidScalarArray = validateShape({ values: { scalarArray: { id: "u32" } as never } });
    expect(invalidScalarArray.ok).toBe(false);
    if (!invalidScalarArray.ok) {
      expect(invalidScalarArray.error.code).toBe("INVALID_NODE_TYPE");
    }

    const options = createOptions({
      limits: {
        maxDepth: 1
      }
    });
    const excessiveDepth = validateShape(
      {
        child: {
          value: "u8"
        }
      },
      options.limits
    );
    expect(excessiveDepth.ok).toBe(false);
    if (!excessiveDepth.ok) {
      expect(excessiveDepth.error.code).toBe("DEPTH_LIMIT_EXCEEDED");
    }
  });
});
