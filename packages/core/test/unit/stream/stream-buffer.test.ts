import { describe, expect, it } from "vitest";
import { encodeFrame } from "../../../src/frame/encode-frame.js";
import { createOptions, DEFAULT_OPTIONS } from "../../../src/limits/default-limits.js";
import { createStreamBuffer } from "../../../src/stream/create-stream-buffer.js";

/**
 * stream buffer 单元测试。
 *
 * 这一组测试锁住：
 * - 半包等待
 * - 粘包连续切出
 * - resync 跳过垃圾和坏帧
 * - buffered bytes 上限
 * - discard / clear 行为
 */
describe("stream buffer", () => {
  it("waits for more data when a frame arrives in chunks", () => {
    const frame = encodeFrame(7, new Uint8Array([1, 2, 3]), DEFAULT_OPTIONS);
    expect(frame.ok).toBe(true);
    if (!frame.ok) {
      return;
    }

    const buffer = createStreamBuffer(DEFAULT_OPTIONS);
    const headAppend = buffer.append(frame.value.slice(0, 8));
    expect(headAppend.ok).toBe(true);

    const partialRead = buffer.readFrame();
    expect(partialRead.ok).toBe(false);
    if (!partialRead.ok) {
      expect(partialRead.error.kind).toBe("need-more-data");
    }

    const tailAppend = buffer.append(frame.value.slice(8));
    expect(tailAppend.ok).toBe(true);

    const completedRead = buffer.readFrame();
    expect(completedRead.ok).toBe(true);
    if (!completedRead.ok) {
      return;
    }

    expect(completedRead.value.frame.typeTag).toBe(7);
    expect(Array.from(completedRead.value.frame.payload)).toEqual([1, 2, 3]);
    expect(buffer.getBufferedByteLength()).toBe(0);
  });

  it("splits sticky frames in order", () => {
    const first = encodeFrame(1, new Uint8Array([9]), DEFAULT_OPTIONS);
    const second = encodeFrame(2, new Uint8Array([8, 7]), DEFAULT_OPTIONS);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    const joined = new Uint8Array(first.value.byteLength + second.value.byteLength);
    joined.set(first.value, 0);
    joined.set(second.value, first.value.byteLength);

    const buffer = createStreamBuffer(DEFAULT_OPTIONS);
    const appendResult = buffer.append(joined);
    expect(appendResult.ok).toBe(true);

    const frames = buffer.readAvailableFrames();
    expect(frames.ok).toBe(true);
    if (!frames.ok) {
      return;
    }

    expect(frames.value).toHaveLength(2);
    expect(frames.value[0]?.frame.typeTag).toBe(1);
    expect(frames.value[1]?.frame.typeTag).toBe(2);
    expect(buffer.getBufferedByteLength()).toBe(0);
  });

  it("resyncs past garbage and bad frames", () => {
    const broken = encodeFrame(5, new Uint8Array([1]), DEFAULT_OPTIONS);
    const valid = encodeFrame(6, new Uint8Array([4, 3]), DEFAULT_OPTIONS);
    expect(broken.ok).toBe(true);
    expect(valid.ok).toBe(true);
    if (!broken.ok || !valid.ok) {
      return;
    }

    const corrupted = new Uint8Array(broken.value);
    const corruptedView = new DataView(corrupted.buffer, corrupted.byteOffset, corrupted.byteLength);
    corruptedView.setUint8(24, corruptedView.getUint8(24) ^ 1);

    const garbage = new Uint8Array([99, 88]);
    const combined = new Uint8Array(garbage.byteLength + corrupted.byteLength + valid.value.byteLength);
    combined.set(garbage, 0);
    combined.set(corrupted, garbage.byteLength);
    combined.set(valid.value, garbage.byteLength + corrupted.byteLength);

    const buffer = createStreamBuffer(DEFAULT_OPTIONS);
    const appendResult = buffer.append(combined);
    expect(appendResult.ok).toBe(true);

    const frame = buffer.readFrame("resync");
    expect(frame.ok).toBe(true);
    if (!frame.ok) {
      return;
    }

    expect(frame.value.skippedBytes).toBe(garbage.byteLength + corrupted.byteLength);
    expect(frame.value.frame.typeTag).toBe(6);
    expect(buffer.getBufferedByteLength()).toBe(0);
  });

  it("enforces maxBufferedBytes and supports discard/clear", () => {
    const options = createOptions({
      limits: {
        maxBufferedBytes: 4
      }
    });
    const buffer = createStreamBuffer(options);

    const firstAppend = buffer.append(new Uint8Array([1, 2, 3]));
    expect(firstAppend.ok).toBe(true);
    expect(buffer.getBufferedByteLength()).toBe(3);

    const secondAppend = buffer.append(new Uint8Array([4, 5]));
    expect(secondAppend.ok).toBe(false);
    if (!secondAppend.ok) {
      expect(secondAppend.error.code).toBe("BUFFER_LIMIT_EXCEEDED");
    }

    const discardResult = buffer.discard(2);
    expect(discardResult.ok).toBe(true);
    expect(buffer.peekBufferedBytes()).toEqual(new Uint8Array([3]));

    const invalidDiscard = buffer.discard(9);
    expect(invalidDiscard.ok).toBe(false);

    buffer.clear();
    expect(buffer.getBufferedByteLength()).toBe(0);
  });
});
