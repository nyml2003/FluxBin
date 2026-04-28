import { describe, expect, it } from "vitest";
import { decodeFrame } from "../../../src/frame/decode-frame.js";
import { encodeFrame } from "../../../src/frame/encode-frame.js";
import { decodeFrameHeader, encodeFrameHeader } from "../../../src/frame/frame-header.js";
import { createOptions } from "../../../src/limits/default-limits.js";

describe("frame boundaries", () => {
  it("rejects payloads that exceed configured limits", () => {
    const options = createOptions({
      limits: {
        maxFrameBytes: 8,
        maxPayloadBytes: 4
      }
    });

    const headerResult = encodeFrameHeader({ payloadLength: 5, typeId: 1 }, options);
    expect(headerResult.ok).toBe(false);

    const frameResult = encodeFrame(1, new Uint8Array([1, 2, 3, 4, 5]), options);
    expect(frameResult.ok).toBe(false);

    const invalidTypeId = encodeFrame(-1, new Uint8Array([1]), createOptions());
    expect(invalidTypeId.ok).toBe(false);
  });

  it("rejects oversized frame headers and incomplete payloads", () => {
    const options = createOptions({
      limits: {
        maxFrameBytes: 9,
        maxPayloadBytes: 8
      }
    });

    const bytes = new Uint8Array([
      1, 0, 0, 0,
      8, 0, 0, 0
    ]);
    const headerResult = decodeFrameHeader(bytes, options);
    expect(headerResult.ok).toBe(false);

    const oversizedPayloadHeader = new Uint8Array([
      1, 0, 0, 0,
      9, 0, 0, 0
    ]);
    const oversizedPayloadResult = decodeFrameHeader(oversizedPayloadHeader, options);
    expect(oversizedPayloadResult.ok).toBe(false);

    const fullFrame = new Uint8Array([
      1, 0, 0, 0,
      4, 0, 0, 0,
      9, 8
    ]);
    const decodeResult = decodeFrame(fullFrame, createOptions());
    expect(decodeResult.ok).toBe(false);
  });
});
