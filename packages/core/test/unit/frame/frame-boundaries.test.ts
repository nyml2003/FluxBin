import { describe, expect, it } from "vitest";
import { decodeFrame } from "../../../src/frame/decode-frame.js";
import { encodeFrame } from "../../../src/frame/encode-frame.js";
import { decodeFrameHeader, encodeFrameHeader } from "../../../src/frame/frame-header.js";
import { FRAME_VERSION } from "../../../src/frame/frame-types.js";
import { createOptions } from "../../../src/limits/default-limits.js";

describe("frame boundaries", () => {
  it("rejects payloads that exceed configured limits", () => {
    const options = createOptions({
      limits: {
        maxFrameBytes: 8,
        maxPayloadBytes: 4
      }
    });

    const headerResult = encodeFrameHeader(
      {
        flags: 0,
        payloadChecksum: 0,
        payloadKind: "typed",
        payloadLength: 5,
        typeTag: 1,
        version: FRAME_VERSION
      },
      options
    );
    expect(headerResult.ok).toBe(false);

    const frameResult = encodeFrame(1, new Uint8Array([1, 2, 3, 4, 5]), options);
    expect(frameResult.ok).toBe(false);

    const invalidTypeId = encodeFrame(-1, new Uint8Array([1]), createOptions());
    expect(invalidTypeId.ok).toBe(false);
    if (!invalidTypeId.ok) {
      expect(invalidTypeId.error.code).toBe("INVALID_TYPE_ID");
    }
  });

  it("rejects oversized frame headers and incomplete payloads", () => {
    const options = createOptions({
      limits: {
        maxFrameBytes: 9,
        maxPayloadBytes: 8
      }
    });

    const bytes = new Uint8Array([1, 2, 3]);
    const headerResult = decodeFrameHeader(bytes, options);
    expect(headerResult.ok).toBe(false);

    const oversizedHeader = encodeFrameHeader(
      {
        flags: 0,
        payloadChecksum: 0,
        payloadKind: "typed",
        payloadLength: 9,
        typeTag: 1,
        version: FRAME_VERSION
      },
      createOptions({
        limits: {
          maxFrameBytes: 64,
          maxPayloadBytes: 16
        }
      })
    );
    expect(oversizedHeader.ok).toBe(true);
    if (!oversizedHeader.ok) {
      return;
    }

    const oversizedPayloadHeader = oversizedHeader.value;
    const oversizedPayloadResult = decodeFrameHeader(oversizedPayloadHeader, options);
    expect(oversizedPayloadResult.ok).toBe(false);

    const frameTooLargeOptions = createOptions({
      limits: {
        maxFrameBytes: 25,
        maxPayloadBytes: 8
      }
    });
    const frameTooLargeHeader = encodeFrameHeader(
      {
        flags: 0,
        payloadChecksum: 0,
        payloadKind: "typed",
        payloadLength: 2,
        typeTag: 1,
        version: FRAME_VERSION
      },
      createOptions({
        limits: {
          maxFrameBytes: 64,
          maxPayloadBytes: 8
        }
      })
    );
    expect(frameTooLargeHeader.ok).toBe(true);
    if (!frameTooLargeHeader.ok) {
      return;
    }

    const frameTooLargeResult = decodeFrameHeader(frameTooLargeHeader.value, frameTooLargeOptions);
    expect(frameTooLargeResult.ok).toBe(false);

    const fullFrame = encodeFrame(1, new Uint8Array([9, 8]), createOptions());
    expect(fullFrame.ok).toBe(true);
    if (!fullFrame.ok) {
      return;
    }

    const truncatedFrame = fullFrame.value.slice(0, fullFrame.value.byteLength - 1);
    const decodeResult = decodeFrame(truncatedFrame, createOptions());
    expect(decodeResult.ok).toBe(false);
    if (!decodeResult.ok) {
      expect(decodeResult.error.kind).toBe("need-more-data");
    }
  });
});
