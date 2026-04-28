import { describe, expect, it } from "vitest";
import { encodeFrame } from "../../../src/frame/encode-frame.js";
import { createFrameLog, encodeFrameLogRecord } from "../../../src/log/frame-log.js";
import { DEFAULT_OPTIONS } from "../../../src/limits/default-limits.js";

/**
 * frame log 回放测试。
 *
 * 这里验证的是“顺序追加的 envelope 记录”在日志场景下的恢复能力，
 * 而不是 transport 场景下的单次 frame 解码。
 */
describe("frame log", () => {
  it("replays appended records across chunks", () => {
    const first = encodeFrame(1, new Uint8Array([7]), DEFAULT_OPTIONS);
    const second = encodeFrame(2, new Uint8Array([8, 9]), DEFAULT_OPTIONS);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    const log = createFrameLog(DEFAULT_OPTIONS);
    const combined = new Uint8Array(first.value.byteLength + second.value.byteLength);
    combined.set(encodeFrameLogRecord(first.value), 0);
    combined.set(encodeFrameLogRecord(second.value), first.value.byteLength);

    const appendHead = log.appendChunk(combined.slice(0, 10));
    expect(appendHead.ok).toBe(true);

    const partialReplay = log.readAvailableEntries();
    expect(partialReplay.ok).toBe(true);
    if (!partialReplay.ok) {
      return;
    }
    expect(partialReplay.value).toHaveLength(0);

    const appendTail = log.appendChunk(combined.slice(10));
    expect(appendTail.ok).toBe(true);

    const replayed = log.readAvailableEntries();
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) {
      return;
    }

    expect(replayed.value).toHaveLength(2);
    expect(replayed.value[0]?.absoluteOffset).toBe(0);
    expect(replayed.value[0]?.frame.typeTag).toBe(1);
    expect(replayed.value[1]?.absoluteOffset).toBe(first.value.byteLength);
    expect(replayed.value[1]?.frame.typeTag).toBe(2);
  });

  it("skips corrupted records and continues replay", () => {
    const broken = encodeFrame(5, new Uint8Array([1]), DEFAULT_OPTIONS);
    const valid = encodeFrame(6, new Uint8Array([3, 4]), DEFAULT_OPTIONS);
    expect(broken.ok).toBe(true);
    expect(valid.ok).toBe(true);
    if (!broken.ok || !valid.ok) {
      return;
    }

    const corrupted = new Uint8Array(broken.value);
    const corruptedView = new DataView(corrupted.buffer, corrupted.byteOffset, corrupted.byteLength);
    corruptedView.setUint8(24, corruptedView.getUint8(24) ^ 1);

    const garbage = new Uint8Array([99]);
    const combined = new Uint8Array(garbage.byteLength + corrupted.byteLength + valid.value.byteLength);
    combined.set(garbage, 0);
    combined.set(corrupted, garbage.byteLength);
    combined.set(valid.value, garbage.byteLength + corrupted.byteLength);

    const log = createFrameLog(DEFAULT_OPTIONS);
    const appendResult = log.appendChunk(combined);
    expect(appendResult.ok).toBe(true);

    const replayed = log.readAvailableEntries();
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) {
      return;
    }

    expect(replayed.value).toHaveLength(1);
    expect(replayed.value[0]?.absoluteOffset).toBe(garbage.byteLength + corrupted.byteLength);
    expect(replayed.value[0]?.skippedBytes).toBe(garbage.byteLength + corrupted.byteLength);
    expect(replayed.value[0]?.frame.typeTag).toBe(6);

    const finalized = log.finalize();
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) {
      return;
    }

    expect(finalized.value.totalEntries).toBe(1);
    expect(finalized.value.totalSkippedBytes).toBe(garbage.byteLength + corrupted.byteLength);
    expect(finalized.value.truncatedTailBytes).toBe(0);
  });

  it("reports truncated tail during finalize without failing replay", () => {
    const frame = encodeFrame(9, new Uint8Array([1, 2, 3]), DEFAULT_OPTIONS);
    expect(frame.ok).toBe(true);
    if (!frame.ok) {
      return;
    }

    const log = createFrameLog(DEFAULT_OPTIONS);
    const appendResult = log.appendChunk(frame.value.slice(0, frame.value.byteLength - 2));
    expect(appendResult.ok).toBe(true);

    const replayed = log.readAvailableEntries();
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) {
      return;
    }
    expect(replayed.value).toHaveLength(0);

    const finalized = log.finalize();
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) {
      return;
    }

    expect(finalized.value.totalEntries).toBe(0);
    expect(finalized.value.truncatedTailBytes).toBe(frame.value.byteLength - 2);
    expect(finalized.value.trailingBytes.byteLength).toBe(frame.value.byteLength - 2);
  });

  it("resets replay state", () => {
    const frame = encodeFrame(3, new Uint8Array([1]), DEFAULT_OPTIONS);
    expect(frame.ok).toBe(true);
    if (!frame.ok) {
      return;
    }

    const log = createFrameLog(DEFAULT_OPTIONS);
    const appendResult = log.appendChunk(frame.value);
    expect(appendResult.ok).toBe(true);

    const replayed = log.readAvailableEntries();
    expect(replayed.ok).toBe(true);

    log.reset();

    const finalized = log.finalize();
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) {
      return;
    }

    expect(finalized.value.totalEntries).toBe(0);
    expect(finalized.value.totalSkippedBytes).toBe(0);
    expect(finalized.value.truncatedTailBytes).toBe(0);
  });
});
