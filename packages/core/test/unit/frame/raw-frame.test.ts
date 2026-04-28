import { describe, expect, it } from "vitest";
import { decodeFrame } from "../../../src/frame/decode-frame.js";
import { encodeFramedPayload, encodeRawArrayFrame } from "../../../src/frame/encode-frame.js";
import { FRAME_FLAG_RAW_ARRAY, FRAME_VERSION } from "../../../src/frame/frame-types.js";
import { DEFAULT_OPTIONS } from "../../../src/limits/default-limits.js";
import { decodeRawArrayValue, decodeRawValue, encodeRawArrayValue, encodeRawValue } from "../../../src/raw/raw-codec.js";

describe("raw frame mode", () => {
  it("roundtrips a raw u32 frame", () => {
    const payload = encodeRawValue("u32", 7, DEFAULT_OPTIONS);
    expect(payload.ok).toBe(true);
    if (!payload.ok) {
      return;
    }

    const frame = encodeFramedPayload("raw", 5, payload.value, DEFAULT_OPTIONS);
    expect(frame.ok).toBe(true);
    if (!frame.ok) {
      return;
    }

    const decoded = decodeFrame(frame.value, DEFAULT_OPTIONS);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }

    expect(decoded.value.frame.payloadKind).toBe("raw");
    expect(decoded.value.frame.version).toBe(FRAME_VERSION);
    expect(decoded.value.frame.typeTag).toBe(5);

    const rawValue = decodeRawValue("u32", decoded.value.frame.payload, DEFAULT_OPTIONS);
    expect(rawValue).toEqual({ ok: true, value: 7, error: null });
  });

  it("roundtrips a raw utf8-string frame", () => {
    const payload = encodeRawValue("utf8-string", "上海", DEFAULT_OPTIONS);
    expect(payload.ok).toBe(true);
    if (!payload.ok) {
      return;
    }

    const frame = encodeFramedPayload("raw", 8, payload.value, DEFAULT_OPTIONS);
    expect(frame.ok).toBe(true);
    if (!frame.ok) {
      return;
    }

    const decoded = decodeFrame(frame.value, DEFAULT_OPTIONS);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }

    expect(decoded.value.frame.version).toBe(FRAME_VERSION);
    const rawValue = decodeRawValue("utf8-string", decoded.value.frame.payload, DEFAULT_OPTIONS);
    expect(rawValue).toEqual({ ok: true, value: "上海", error: null });
  });

  it("roundtrips a raw u32 array frame", () => {
    const payload = encodeRawArrayValue("u32", [1, 2, 3], DEFAULT_OPTIONS);
    expect(payload.ok).toBe(true);
    if (!payload.ok) {
      return;
    }

    const frame = encodeRawArrayFrame(5, payload.value, DEFAULT_OPTIONS);
    expect(frame.ok).toBe(true);
    if (!frame.ok) {
      return;
    }

    const decoded = decodeFrame(frame.value, DEFAULT_OPTIONS);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }

    expect(decoded.value.frame.flags).toBe(FRAME_FLAG_RAW_ARRAY);
    const rawArrayValue = decodeRawArrayValue("u32", decoded.value.frame.payload, DEFAULT_OPTIONS);
    expect(rawArrayValue).toEqual({ ok: true, value: [1, 2, 3], error: null });
  });
});
