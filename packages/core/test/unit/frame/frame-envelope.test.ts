import { describe, expect, it } from "vitest";
import { writeU32 } from "../../../src/scalar/write-scalars.js";
import { computeFrameChecksum } from "../../../src/frame/frame-checksum.js";
import { decodeFrame } from "../../../src/frame/decode-frame.js";
import { encodeFrame } from "../../../src/frame/encode-frame.js";
import { decodeFrameWithResync, findNextFrameMagicOffset } from "../../../src/frame/frame-sync.js";
import { DEFAULT_OPTIONS } from "../../../src/limits/default-limits.js";

/**
 * envelope 保护测试。
 *
 * 这组测试专门覆盖 magic / version / checksum / resync，
 * 这样协议外层的生存性约束就不会退化回旧的裸 header。
 */
describe("frame envelope", () => {
  it("rejects invalid magic, version, flags, header checksum and payload checksum", () => {
    const encoded = encodeFrame(7, new Uint8Array([1, 2, 3]), DEFAULT_OPTIONS);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const invalidMagic = new Uint8Array(encoded.value);
    const invalidMagicView = new DataView(invalidMagic.buffer, invalidMagic.byteOffset, invalidMagic.byteLength);
    invalidMagicView.setUint8(0, 0);
    const invalidMagicResult = decodeFrame(invalidMagic, DEFAULT_OPTIONS);
    expect(invalidMagicResult.ok).toBe(false);
    if (!invalidMagicResult.ok) {
      expect(invalidMagicResult.error.code).toBe("INVALID_FRAME_MAGIC");
    }

    const invalidVersion = new Uint8Array(encoded.value);
    const invalidVersionView = new DataView(invalidVersion.buffer, invalidVersion.byteOffset, invalidVersion.byteLength);
    invalidVersionView.setUint8(4, 9);
    const invalidVersionResult = decodeFrame(invalidVersion, DEFAULT_OPTIONS);
    expect(invalidVersionResult.ok).toBe(false);
    if (!invalidVersionResult.ok) {
      expect(invalidVersionResult.error.code).toBe("UNSUPPORTED_FRAME_VERSION");
    }

    const invalidFlags = new Uint8Array(encoded.value);
    const invalidFlagsView = new DataView(invalidFlags.buffer, invalidFlags.byteOffset, invalidFlags.byteLength);
    invalidFlagsView.setUint8(6, 1);
    const invalidFlagsResult = decodeFrame(invalidFlags, DEFAULT_OPTIONS);
    expect(invalidFlagsResult.ok).toBe(false);
    if (!invalidFlagsResult.ok) {
      expect(invalidFlagsResult.error.code).toBe("INVALID_FRAME_FLAGS");
    }

    const invalidHeaderChecksum = new Uint8Array(encoded.value);
    const invalidHeaderChecksumView = new DataView(
      invalidHeaderChecksum.buffer,
      invalidHeaderChecksum.byteOffset,
      invalidHeaderChecksum.byteLength
    );
    invalidHeaderChecksumView.setUint8(20, invalidHeaderChecksumView.getUint8(20) ^ 1);
    const invalidHeaderChecksumResult = decodeFrame(invalidHeaderChecksum, DEFAULT_OPTIONS);
    expect(invalidHeaderChecksumResult.ok).toBe(false);
    if (!invalidHeaderChecksumResult.ok) {
      expect(invalidHeaderChecksumResult.error.code).toBe("HEADER_CHECKSUM_MISMATCH");
    }

    const invalidPayloadChecksum = new Uint8Array(encoded.value);
    const invalidPayloadChecksumView = new DataView(
      invalidPayloadChecksum.buffer,
      invalidPayloadChecksum.byteOffset,
      invalidPayloadChecksum.byteLength
    );
    invalidPayloadChecksumView.setUint8(24, invalidPayloadChecksumView.getUint8(24) ^ 1);
    const invalidPayloadChecksumResult = decodeFrame(invalidPayloadChecksum, DEFAULT_OPTIONS);
    expect(invalidPayloadChecksumResult.ok).toBe(false);
    if (!invalidPayloadChecksumResult.ok) {
      expect(invalidPayloadChecksumResult.error.code).toBe("PAYLOAD_CHECKSUM_MISMATCH");
    }

    const invalidPayloadKind = new Uint8Array(encoded.value);
    const invalidPayloadKindView = new DataView(
      invalidPayloadKind.buffer,
      invalidPayloadKind.byteOffset,
      invalidPayloadKind.byteLength
    );
    invalidPayloadKindView.setUint8(5, 9);
    const headerChecksum = computeFrameChecksum(invalidPayloadKind.subarray(0, 20));
    const rewriteHeaderChecksum = writeU32(invalidPayloadKindView, 20, headerChecksum, DEFAULT_OPTIONS.endian);
    expect(rewriteHeaderChecksum.ok).toBe(true);

    const invalidPayloadKindResult = decodeFrame(invalidPayloadKind, DEFAULT_OPTIONS);
    expect(invalidPayloadKindResult.ok).toBe(false);
    if (!invalidPayloadKindResult.ok) {
      expect(invalidPayloadKindResult.error.code).toBe("UNKNOWN_PAYLOAD_KIND");
    }
  });

  it("resyncs past garbage and broken frames to the next valid frame", () => {
    const brokenFrame = encodeFrame(7, new Uint8Array([1]), DEFAULT_OPTIONS);
    expect(brokenFrame.ok).toBe(true);
    if (!brokenFrame.ok) {
      return;
    }

    const validFrame = encodeFrame(8, new Uint8Array([9, 8]), DEFAULT_OPTIONS);
    expect(validFrame.ok).toBe(true);
    if (!validFrame.ok) {
      return;
    }

    const corruptedFrame = new Uint8Array(brokenFrame.value);
    const corruptedFrameView = new DataView(corruptedFrame.buffer, corruptedFrame.byteOffset, corruptedFrame.byteLength);
    corruptedFrameView.setUint8(24, corruptedFrameView.getUint8(24) ^ 1);

    const garbage = new Uint8Array([99, 88, 77]);
    const stream = new Uint8Array(garbage.byteLength + corruptedFrame.byteLength + validFrame.value.byteLength);
    stream.set(garbage, 0);
    stream.set(corruptedFrame, garbage.byteLength);
    stream.set(validFrame.value, garbage.byteLength + corruptedFrame.byteLength);

    expect(findNextFrameMagicOffset(stream)).toBe(garbage.byteLength);

    const resynced = decodeFrameWithResync(stream, DEFAULT_OPTIONS);
    expect(resynced.ok).toBe(true);
    if (!resynced.ok) {
      return;
    }

    expect(resynced.value.frameOffset).toBe(garbage.byteLength + corruptedFrame.byteLength);
    expect(resynced.value.skippedBytes).toBe(garbage.byteLength + corruptedFrame.byteLength);
    expect(resynced.value.frame.typeTag).toBe(8);
    expect(Array.from(resynced.value.frame.payload)).toEqual([9, 8]);
  });

  it("reports need-more-data when only a partial magic prefix is available", () => {
    const partial = new Uint8Array([
      1,
      2,
      0x46,
      0x4c
    ]);

    const resynced = decodeFrameWithResync(partial, DEFAULT_OPTIONS);
    expect(resynced.ok).toBe(false);
    if (!resynced.ok) {
      expect(resynced.error.kind).toBe("need-more-data");
      expect(resynced.error.details).toEqual({ trailingMagicBytes: 2 });
    }
  });
});
