import { describe, expect, it } from "vitest";
import { decodeUtf8String, encodeUtf8String } from "../../src/scalar/utf8.js";

describe("browser/node baseline", () => {
  it("uses standard UTF-8 APIs available in browser and node runtimes", () => {
    expect(typeof TextEncoder).toBe("function");
    expect(typeof TextDecoder).toBe("function");

    const encoded = encodeUtf8String("baseline", "little");
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const decoded = decodeUtf8String(
      new DataView(encoded.value.buffer, encoded.value.byteOffset, encoded.value.byteLength),
      0,
      "little"
    );
    expect(decoded).toEqual({
      ok: true,
      value: { nextOffset: encoded.value.byteLength, value: "baseline" },
      error: null
    });
  });
});
