import { describe, expect, it } from "vitest";
import { createOptions } from "../../../src/limits/default-limits.js";
import { decodePayload } from "../../../src/reader/decode-payload.js";
import { compileShape } from "../../../src/shape/compile-shape.js";
import { encodePayload } from "../../../src/writer/encode-payload.js";

describe("payload encode/decode errors", () => {
  it("rejects missing or invalid field values during encode", () => {
    const compiled = compileShape({
      active: "bool",
      name: "utf8-string"
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const missingField = encodePayload(compiled.value, { active: true }, createOptions());
    expect(missingField.ok).toBe(false);

    const invalidField = encodePayload(compiled.value, { active: "yes", name: "flux" }, createOptions());
    expect(invalidField.ok).toBe(false);
  });

  it("rejects trailing bytes and invalid nested objects during decode/encode", () => {
    const compiled = compileShape({
      profile: {
        age: "u8"
      }
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const invalidObject = encodePayload(compiled.value, { profile: "bad" }, createOptions());
    expect(invalidObject.ok).toBe(false);

    const payload = new Uint8Array([7, 99]);
    const decoded = decodePayload(compiled.value, payload, createOptions());
    expect(decoded.ok).toBe(false);
  });
});
