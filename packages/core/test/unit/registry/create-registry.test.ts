import { describe, expect, it } from "vitest";
import { createRegistry } from "../../../src/registry/create-registry.js";

describe("createRegistry", () => {
  it("registers and stores compiled shapes", () => {
    const registry = createRegistry();
    const result = registry.register(1001, { id: "u32", name: "utf8-string" }, { name: "user.v1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(registry.has(1001)).toBe(true);
    expect(result.value.compiledNode.kind).toBe("shape");
    if (result.value.compiledNode.kind === "shape") {
      expect(result.value.compiledNode.fields).toHaveLength(2);
    }
  });

  it("rejects duplicate type ids", () => {
    const registry = createRegistry();
    expect(registry.register(1001, { id: "u32" }).ok).toBe(true);

    const duplicate = registry.register(1001, { id: "u32" });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe("DUPLICATE_TYPE_ID");
    }
  });

  it("rejects invalid type ids before compilation", () => {
    const registry = createRegistry();

    const negativeTypeId = registry.register(-1, { id: "u32" });
    expect(negativeTypeId.ok).toBe(false);
    if (!negativeTypeId.ok) {
      expect(negativeTypeId.error.code).toBe("INVALID_TYPE_ID");
    }
  });

  it("isolates options across registry instances", () => {
    const first = createRegistry();
    const second = createRegistry();

    expect(first.options).not.toBe(second.options);
    expect(first.options.limits).not.toBe(second.options.limits);
    expect(Object.isFrozen(first.options)).toBe(true);
    expect(Object.isFrozen(first.options.limits)).toBe(true);
  });
});
