import { describe, expect, it } from "vitest";
import { createOptions, DEFAULT_OPTIONS } from "../../../src/limits/default-limits.js";
import { decodeRawArrayValue, decodeRawValue, encodeRawArrayValue, encodeRawValue } from "../../../src/raw/raw-codec.js";

/**
 * raw codec 单元测试。
 *
 * 这里刻意把每一种 raw 标量都走一遍 encode + decode，
 * 这样可以把 raw mode 的分支覆盖率真正拉到可用水平。
 */
describe("raw codec", () => {
  it("roundtrips every supported raw scalar type", () => {
    const cases = [
      { rawType: "bool", value: true },
      { rawType: "i8", value: -8 },
      { rawType: "u8", value: 8 },
      { rawType: "i16", value: -16 },
      { rawType: "u16", value: 16 },
      { rawType: "i32", value: -32 },
      { rawType: "u32", value: 32 },
      { rawType: "utf8-string", value: "上海" }
    ] as const;

    for (const testCase of cases) {
      const encoded = encodeRawValue(testCase.rawType, testCase.value, DEFAULT_OPTIONS);
      expect(encoded.ok).toBe(true);
      if (!encoded.ok) {
        return;
      }

      const decoded = decodeRawValue(testCase.rawType, encoded.value, DEFAULT_OPTIONS);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) {
        return;
      }

      expect(decoded.value).toBe(testCase.value);
    }
  });

  it("rejects mismatched raw value types and string limit overflow", () => {
    const invalidBool = encodeRawValue("bool", 1, DEFAULT_OPTIONS);
    expect(invalidBool.ok).toBe(false);

    const numericTypes = ["i8", "u8", "i16", "u16", "i32", "u32"] as const;
    for (const rawType of numericTypes) {
      const invalidNumber = encodeRawValue(rawType, "bad", DEFAULT_OPTIONS);
      expect(invalidNumber.ok).toBe(false);
    }

    const invalidString = encodeRawValue("utf8-string", 9, DEFAULT_OPTIONS);
    expect(invalidString.ok).toBe(false);

    const limitedOptions = createOptions({
      limits: {
        maxStringBytes: 1
      }
    });
    const oversizedString = encodeRawValue("utf8-string", "ab", limitedOptions);
    expect(oversizedString.ok).toBe(false);
  });

  it("rejects truncated raw payloads during decode", () => {
    const truncatedBool = decodeRawValue("bool", new Uint8Array([]), DEFAULT_OPTIONS);
    expect(truncatedBool.ok).toBe(false);

    const truncatedI8 = decodeRawValue("i8", new Uint8Array([]), DEFAULT_OPTIONS);
    expect(truncatedI8.ok).toBe(false);

    const truncatedU8 = decodeRawValue("u8", new Uint8Array([]), DEFAULT_OPTIONS);
    expect(truncatedU8.ok).toBe(false);

    const truncatedI16 = decodeRawValue("i16", new Uint8Array([1]), DEFAULT_OPTIONS);
    expect(truncatedI16.ok).toBe(false);

    const truncatedU16 = decodeRawValue("u16", new Uint8Array([1]), DEFAULT_OPTIONS);
    expect(truncatedU16.ok).toBe(false);

    const truncatedI32 = decodeRawValue("i32", new Uint8Array([1, 2]), DEFAULT_OPTIONS);
    expect(truncatedI32.ok).toBe(false);

    const truncatedU32 = decodeRawValue("u32", new Uint8Array([1, 2]), DEFAULT_OPTIONS);
    expect(truncatedU32.ok).toBe(false);

    const truncatedString = decodeRawValue("utf8-string", new Uint8Array([3, 0, 0]), DEFAULT_OPTIONS);
    expect(truncatedString.ok).toBe(false);
  });

  it("roundtrips raw scalar arrays for fixed and variable width items", () => {
    const encodedNumbers = encodeRawArrayValue("u32", [1, 2, 3], DEFAULT_OPTIONS);
    expect(encodedNumbers.ok).toBe(true);
    if (!encodedNumbers.ok) {
      return;
    }

    const decodedNumbers = decodeRawArrayValue("u32", encodedNumbers.value, DEFAULT_OPTIONS);
    expect(decodedNumbers).toEqual({ ok: true, value: [1, 2, 3], error: null });

    const encodedStrings = encodeRawArrayValue("utf8-string", ["a", "上海"], DEFAULT_OPTIONS);
    expect(encodedStrings.ok).toBe(true);
    if (!encodedStrings.ok) {
      return;
    }

    const decodedStrings = decodeRawArrayValue("utf8-string", encodedStrings.value, DEFAULT_OPTIONS);
    expect(decodedStrings).toEqual({ ok: true, value: ["a", "上海"], error: null });
  });

  it("rejects invalid raw scalar arrays and truncated tails", () => {
    const invalidArrayValue = encodeRawArrayValue("u32", "bad" as never, DEFAULT_OPTIONS);
    expect(invalidArrayValue.ok).toBe(false);

    const limitedOptions = createOptions({
      limits: {
        maxArrayLength: 1
      }
    });
    const oversizedArray = encodeRawArrayValue("u32", [1, 2], limitedOptions);
    expect(oversizedArray.ok).toBe(false);

    const truncatedCount = decodeRawArrayValue("u32", new Uint8Array([1, 0]), DEFAULT_OPTIONS);
    expect(truncatedCount.ok).toBe(false);

    const encoded = encodeRawArrayValue("bool", [true, false], DEFAULT_OPTIONS);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const truncatedTail = decodeRawArrayValue("bool", encoded.value.slice(0, encoded.value.byteLength - 1), DEFAULT_OPTIONS);
    expect(truncatedTail.ok).toBe(false);
  });
});
