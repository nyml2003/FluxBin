import { describe, expect, it } from "vitest";
import { readBool, writeBool } from "../../../src/scalar/bool.js";
import { readI16, readI32, readU16, readU32 } from "../../../src/scalar/read-scalars.js";
import { decodeUtf8String, encodeUtf8String } from "../../../src/scalar/utf8.js";
import { writeI16, writeI32, writeU16, writeU32 } from "../../../src/scalar/write-scalars.js";

describe("scalar codecs", () => {
  it("roundtrips u32 and i16 values", () => {
    const bytes = new Uint8Array(6);
    const view = new DataView(bytes.buffer);

    const writeU32Result = writeU32(view, 0, 0x1234_5678, "little");
    expect(writeU32Result.ok).toBe(true);
    const writeI16Result = writeI16(view, 4, -42, "little");
    expect(writeI16Result.ok).toBe(true);

    const readU32Result = readU32(view, 0, "little");
    expect(readU32Result).toEqual({ ok: true, value: { nextOffset: 4, value: 0x1234_5678 }, error: null });

    const readI16Result = readI16(view, 4, "little");
    expect(readI16Result).toEqual({ ok: true, value: { nextOffset: 6, value: -42 }, error: null });
  });

  it("roundtrips big-endian unsigned and signed boundary values", () => {
    const bytes = new Uint8Array(6);
    const view = new DataView(bytes.buffer);

    expect(writeU16(view, 0, 0xabcd, "big")).toEqual({ ok: true, value: 2, error: null });
    expect(writeI32(view, 2, -0x1234_5678, "big")).toEqual({ ok: true, value: 6, error: null });

    expect(Array.from(bytes)).toEqual([0xab, 0xcd, 0xed, 0xcb, 0xa9, 0x88]);
    expect(readU16(view, 0, "big")).toEqual({ ok: true, value: { nextOffset: 2, value: 0xabcd }, error: null });
    expect(readI32(view, 2, "big")).toEqual({
      ok: true,
      value: { nextOffset: 6, value: -0x1234_5678 },
      error: null
    });
  });

  it("roundtrips bool values", () => {
    const bytes = new Uint8Array(1);
    const view = new DataView(bytes.buffer);

    expect(writeBool(view, 0, true).ok).toBe(true);
    expect(readBool(view, 0)).toEqual({ ok: true, value: { nextOffset: 1, value: true }, error: null });
  });

  it("rejects invalid bool values", () => {
    const bytes = new Uint8Array([2]);
    const view = new DataView(bytes.buffer);
    const result = readBool(view, 0);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BOOL_VALUE_INVALID");
    }
  });

  it("roundtrips UTF-8 strings with multibyte content", () => {
    const encoded = encodeUtf8String("你好, FluxBin", "little");
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const view = new DataView(encoded.value.buffer, encoded.value.byteOffset, encoded.value.byteLength);
    const decoded = decodeUtf8String(view, 0, "little");
    expect(decoded).toEqual({
      ok: true,
      value: { nextOffset: encoded.value.byteLength, value: "你好, FluxBin" },
      error: null
    });
  });
});
