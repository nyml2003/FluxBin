import { describe, expect, it } from "vitest";
import { decodeFrame } from "../../../src/frame/decode-frame.js";
import { encodeFrame } from "../../../src/frame/encode-frame.js";
import { FRAME_VERSION } from "../../../src/frame/frame-types.js";
import { DEFAULT_OPTIONS } from "../../../src/limits/default-limits.js";

describe("frame codec", () => {
  it("roundtrips a complete frame", () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const encoded = encodeFrame(7, payload, DEFAULT_OPTIONS);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const decoded = decodeFrame(encoded.value, DEFAULT_OPTIONS);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }

    expect(decoded.value.frame.payloadKind).toBe("typed");
    expect(decoded.value.frame.version).toBe(FRAME_VERSION);
    expect(decoded.value.frame.flags).toBe(0);
    expect(decoded.value.frame.headerChecksum).toBeGreaterThan(0);
    expect(decoded.value.frame.payloadChecksum).toBeGreaterThan(0);
    expect(decoded.value.frame.typeTag).toBe(7);
    expect(Array.from(decoded.value.frame.payload)).toEqual([1, 2, 3, 4]);
  });

  it("returns need-more-data for an incomplete header", () => {
    const decoded = decodeFrame(new Uint8Array([1, 2, 3]), DEFAULT_OPTIONS);

    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error.kind).toBe("need-more-data");
    }
  });
});
