/**
 * frame log 回放与恢复。
 *
 * 当前 FluxBin 的 append-friendly log 格式非常直接：
 * - 一个 log record 就是一整个 frame envelope 字节串
 * - 多条记录按顺序直接拼接
 *
 * 这个模块不接触文件系统。
 * 它只负责“如何解释一串日志字节并在坏帧/截断尾部下恢复”。
 */
import type { FluxBinError } from "../errors/error-types.js";
import { ok } from "../errors/result-factories.js";
import { createStreamBuffer, type StreamBufferReadResult } from "../stream/create-stream-buffer.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import type { Result } from "../types/result.js";

export type FrameLogReplayEntry = StreamBufferReadResult & {
  absoluteOffset: number;
  recordByteLength: number;
};

export type FrameLogFinalizeResult = {
  bufferedBytes: number;
  totalEntries: number;
  totalSkippedBytes: number;
  trailingBytes: Uint8Array;
  truncatedTailBytes: number;
};

export type FluxBinFrameLog = {
  appendChunk(chunk: Uint8Array): Result<{ bufferedBytes: number; totalAppendedBytes: number }, FluxBinError>;
  finalize(): Result<FrameLogFinalizeResult, FluxBinError>;
  readAvailableEntries(): Result<FrameLogReplayEntry[], FluxBinError>;
  reset(): void;
};

export function encodeFrameLogRecord(frameBytes: Uint8Array): Uint8Array {
  return new Uint8Array(frameBytes);
}

export function createFrameLog(options: FluxBinOptions): FluxBinFrameLog {
  const streamBuffer = createStreamBuffer(options);
  let absoluteCursor = 0;
  let totalAppendedBytes = 0;
  let totalEntries = 0;
  let totalSkippedBytes = 0;

  function appendChunk(chunk: Uint8Array): Result<{ bufferedBytes: number; totalAppendedBytes: number }, FluxBinError> {
    const appendResult = streamBuffer.append(chunk);
    if (!appendResult.ok) {
      return appendResult;
    }

    totalAppendedBytes += chunk.byteLength;
    return ok({
      bufferedBytes: appendResult.value.bufferedBytes,
      totalAppendedBytes
    });
  }

  function readAvailableEntries(): Result<FrameLogReplayEntry[], FluxBinError> {
    const entries: FrameLogReplayEntry[] = [];

    while (streamBuffer.getBufferedByteLength() > 0) {
      const readResult = streamBuffer.readFrame("resync");
      if (!readResult.ok) {
        if (readResult.error.kind === "need-more-data") {
          return ok(entries);
        }

        return readResult;
      }

      const entry: FrameLogReplayEntry = {
        absoluteOffset: absoluteCursor + readResult.value.frameOffset,
        bytesConsumed: readResult.value.bytesConsumed,
        frame: readResult.value.frame,
        frameOffset: readResult.value.frameOffset,
        recordByteLength: readResult.value.bytesConsumed - readResult.value.skippedBytes,
        skippedBytes: readResult.value.skippedBytes
      };

      absoluteCursor += readResult.value.bytesConsumed;
      totalEntries += 1;
      totalSkippedBytes += readResult.value.skippedBytes;
      entries.push(entry);
    }

    return ok(entries);
  }

  function finalize(): Result<FrameLogFinalizeResult, FluxBinError> {
    const drainResult = readAvailableEntries();
    if (!drainResult.ok) {
      return drainResult;
    }

    const trailingBytes = streamBuffer.peekBufferedBytes();
    return ok({
      bufferedBytes: trailingBytes.byteLength,
      totalEntries,
      totalSkippedBytes,
      trailingBytes,
      truncatedTailBytes: trailingBytes.byteLength
    });
  }

  function reset() {
    streamBuffer.clear();
    absoluteCursor = 0;
    totalAppendedBytes = 0;
    totalEntries = 0;
    totalSkippedBytes = 0;
  }

  return {
    appendChunk,
    finalize,
    readAvailableEntries,
    reset
  };
}
