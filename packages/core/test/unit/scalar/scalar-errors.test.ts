import { describe, expect, it } from "vitest";
import { readBool } from "../../../src/scalar/bool.js";
import { readI16, readI32, readI8, readU16, readU32, readU8 } from "../../../src/scalar/read-scalars.js";
import { decodeUtf8String, encodeUtf8String } from "../../../src/scalar/utf8.js";
import { isOk } from "../../../src/types/result.js";
import { writeI16, writeI32, writeI8, writeU16, writeU32, writeU8 } from "../../../src/scalar/write-scalars.js";

describe("scalar error handling", () => {
  it("returns structured errors for out-of-bounds reads", () => {
    const view = new DataView(new Uint8Array(1).buffer);

    const readU16Result = readU16(view, 0, "little");
    expect(readU16Result.ok).toBe(false);

    const readI32Result = readI32(view, -1, "little");
    expect(readI32Result.ok).toBe(false);

    const readU8NegativeOffset = readU8(view, -1);
    expect(readU8NegativeOffset.ok).toBe(false);

    const readI8Result = readI8(view, 0);
    expect(readI8Result.ok).toBe(true);

    const readI16Result = readI16(new DataView(new Uint8Array([0xff, 0x7f]).buffer), 0, "little");
    expect(readI16Result.ok).toBe(true);

    const readU32Result = readU32(new DataView(new Uint8Array([1, 2]).buffer), 0, "little");
    expect(readU32Result.ok).toBe(false);

    const readI16Short = readI16(new DataView(new Uint8Array([1]).buffer), 0, "little");
    expect(readI16Short.ok).toBe(false);

    const readI32Valid = readI32(new DataView(new Uint8Array([1, 0, 0, 0]).buffer), 0, "little");
    expect(readI32Valid.ok).toBe(true);
  });

  it("returns structured errors for invalid scalar writes", () => {
    const view = new DataView(new Uint8Array(2).buffer);

    const invalidRange = writeU16(view, 0, 0x1_0000, "little");
    expect(invalidRange.ok).toBe(false);

    const invalidU8Offset = writeU8(view, -1, 1);
    expect(invalidU8Offset.ok).toBe(false);

    const invalidOffset = writeU32(view, 0, 1, "little");
    expect(invalidOffset.ok).toBe(false);

    const invalidSignedRange = writeI8(view, 0, 200);
    expect(invalidSignedRange.ok).toBe(false);

    const validSigned = writeI32(new DataView(new Uint8Array(4).buffer), 0, -10, "little");
    expect(validSigned.ok).toBe(true);

    const invalidI16 = writeI16(new DataView(new Uint8Array(2).buffer), 0, 0x8000, "little");
    expect(invalidI16.ok).toBe(false);

    const shortU16 = writeU16(new DataView(new Uint8Array(1).buffer), 0, 1, "little");
    expect(shortU16.ok).toBe(false);

    const shortI32 = writeI32(new DataView(new Uint8Array(2).buffer), 0, 1, "little");
    expect(shortI32.ok).toBe(false);
  });

  it("exposes the result type guard and preserves bool failure shape", () => {
    const readResult = readBool(new DataView(new Uint8Array([9]).buffer), 0);
    expect(isOk(readResult)).toBe(false);
    expect(readResult.ok).toBe(false);
    if (!readResult.ok) {
      expect(readResult.error.code).toBe("BOOL_VALUE_INVALID");
    }

    const missingBytes = readBool(new DataView(new Uint8Array(0).buffer), 0);
    expect(missingBytes.ok).toBe(false);
  });

  it("returns structured UTF-8 decode failures", () => {
    const encoded = encodeUtf8String("ab", "little");
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const truncated = encoded.value.slice(0, encoded.value.byteLength - 1);
    const truncatedResult = decodeUtf8String(new DataView(truncated.buffer, truncated.byteOffset, truncated.byteLength), 0, "little");
    expect(truncatedResult.ok).toBe(false);

    const invalidUtf8 = new Uint8Array([1, 0, 0, 0, 0xff]);
    const invalidResult = decodeUtf8String(new DataView(invalidUtf8.buffer), 0, "little");
    expect(invalidResult.ok).toBe(false);
  });
});
