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

  it("rejects non-plain objects as shapes", () => {
    const dateResult = validateShape(new Date() as never);
    expect(dateResult.ok).toBe(false);

    const mapResult = validateShape(new Map() as never);
    expect(mapResult.ok).toBe(false);
  });

  it("rejects invalid keys, invalid nested nodes, and excessive depth", () => {
    const emptyKey = validateShape({ "": "u8" });
    expect(emptyKey.ok).toBe(false);

    const invalidNested = validateShape({ child: 1 as never });
    expect(invalidNested.ok).toBe(false);

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
  });
});
