/**
 * stream buffer 第一版实现。
 *
 * 这个对象负责把分片字节积累成可读取的 frame 流。
 * 它不解释 typed/raw 业务语义，只负责：
 * - append
 * - 半包等待
 * - 粘包连续切出
 * - strict / resync 两种读法
 * - 已消费前缀裁剪
 */
import { ERROR_CODES } from "../errors/error-codes.js";
import type { FluxBinError } from "../errors/error-types.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { DecodedFrame } from "../frame/frame-types.js";
import { decodeFrame } from "../frame/decode-frame.js";
import { decodeFrameWithResync } from "../frame/frame-sync.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import type { Result } from "../types/result.js";

export type StreamBufferReadMode = "resync" | "strict";

export type StreamBufferReadResult = {
  bytesConsumed: number;
  frame: DecodedFrame;
  frameOffset: number;
  skippedBytes: number;
};

export type FluxBinStreamBuffer = {
  append(chunk: Uint8Array): Result<{ bufferedBytes: number }, FluxBinError>;
  clear(): void;
  discard(byteCount: number): Result<{ bufferedBytes: number }, FluxBinError>;
  getBufferedByteLength(): number;
  peekBufferedBytes(): Uint8Array;
  readAvailableFrames(mode?: StreamBufferReadMode): Result<StreamBufferReadResult[], FluxBinError>;
  readFrame(mode?: StreamBufferReadMode): Result<StreamBufferReadResult, FluxBinError>;
};

function copyChunk(chunk: Uint8Array): Uint8Array {
  return new Uint8Array(chunk);
}

export function createStreamBuffer(options: FluxBinOptions): FluxBinStreamBuffer {
  let bufferedChunks: Uint8Array[] = [];
  let bufferedByteLength = 0;
  let materializedBytes: Uint8Array | null = null;

  function ensureMaterializedBytes(): Uint8Array {
    if (materializedBytes !== null) {
      return materializedBytes;
    }

    if (bufferedChunks.length === 0) {
      const emptyBytes = new Uint8Array(new ArrayBuffer(0));
      materializedBytes = emptyBytes;
      bufferedChunks = [];
      return emptyBytes;
    }

    if (bufferedChunks.length === 1) {
      const [singleChunk] = bufferedChunks;
      if (singleChunk !== undefined) {
        materializedBytes = singleChunk;
        return singleChunk;
      }
    }

    const bytes = new Uint8Array(new ArrayBuffer(bufferedByteLength));
    let offset = 0;
    for (const chunk of bufferedChunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    materializedBytes = bytes;
    bufferedChunks = [bytes];
    return bytes;
  }

  function dropPrefix(byteCount: number) {
    let remaining = byteCount;

    while (remaining > 0) {
      const firstChunk = bufferedChunks[0];
      if (firstChunk === undefined) {
        break;
      }

      if (remaining >= firstChunk.byteLength) {
        remaining -= firstChunk.byteLength;
        bufferedChunks.shift();
        continue;
      }

      bufferedChunks[0] = firstChunk.subarray(remaining);
      remaining = 0;
    }

    materializedBytes = null;
  }

  function getBufferedByteLength() {
    return bufferedByteLength;
  }

  function clear() {
    bufferedChunks = [];
    bufferedByteLength = 0;
    materializedBytes = null;
  }

  function append(chunk: Uint8Array): Result<{ bufferedBytes: number }, FluxBinError> {
    const nextBufferedLength = bufferedByteLength + chunk.byteLength;
    if (nextBufferedLength > options.limits.maxBufferedBytes) {
      return err(
        protocolError(
          ERROR_CODES.BUFFER_LIMIT_EXCEEDED,
          `Buffered byte length ${String(nextBufferedLength)} exceeds maxBufferedBytes.`,
          null
        )
      );
    }

    bufferedChunks.push(copyChunk(chunk));
    bufferedByteLength = nextBufferedLength;
    materializedBytes = null;
    return ok({ bufferedBytes: bufferedByteLength });
  }

  function discard(byteCount: number): Result<{ bufferedBytes: number }, FluxBinError> {
    if (!Number.isInteger(byteCount) || byteCount < 0) {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "discard byteCount must be a non-negative integer.", null));
    }

    if (byteCount > bufferedByteLength) {
      return err(
        protocolError(
          ERROR_CODES.OUT_OF_BOUNDS,
          `Cannot discard ${String(byteCount)} bytes from buffer of length ${String(bufferedByteLength)}.`,
          null
        )
      );
    }

    if (byteCount === 0) {
      return ok({ bufferedBytes: bufferedByteLength });
    }

    if (materializedBytes !== null) {
      const nextBytes = materializedBytes.subarray(byteCount);
      bufferedChunks = [];
      if (nextBytes.byteLength > 0) {
        bufferedChunks.push(nextBytes);
      }
      materializedBytes = nextBytes.byteLength > 0 ? nextBytes : null;
    } else {
      dropPrefix(byteCount);
    }

    bufferedByteLength -= byteCount;
    if (bufferedByteLength === 0) {
      bufferedChunks = [];
      materializedBytes = null;
    }

    return ok({ bufferedBytes: bufferedByteLength });
  }

  function peekBufferedBytes() {
    return new Uint8Array(ensureMaterializedBytes());
  }

  function readFrame(mode?: StreamBufferReadMode): Result<StreamBufferReadResult, FluxBinError> {
    let resolvedMode: StreamBufferReadMode = "strict";
    if (mode !== undefined) {
      resolvedMode = mode;
    }

    const bufferedBytes = ensureMaterializedBytes();

    if (resolvedMode === "resync") {
      const decodedFrame = decodeFrameWithResync(bufferedBytes, options);
      if (!decodedFrame.ok) {
        return decodedFrame;
      }

      const discardResult = discard(decodedFrame.value.nextOffset);
      if (!discardResult.ok) {
        return discardResult;
      }
      return ok({
        bytesConsumed: decodedFrame.value.nextOffset,
        frame: decodedFrame.value.frame,
        frameOffset: decodedFrame.value.frameOffset,
        skippedBytes: decodedFrame.value.skippedBytes
      });
    }

    const decodedFrame = decodeFrame(bufferedBytes, options);
    if (!decodedFrame.ok) {
      return decodedFrame;
    }

    const discardResult = discard(decodedFrame.value.nextOffset);
    if (!discardResult.ok) {
      return discardResult;
    }
    return ok({
      bytesConsumed: decodedFrame.value.nextOffset,
      frame: decodedFrame.value.frame,
      frameOffset: 0,
      skippedBytes: 0
    });
  }

  function readAvailableFrames(mode?: StreamBufferReadMode): Result<StreamBufferReadResult[], FluxBinError> {
    const frames: StreamBufferReadResult[] = [];

    while (bufferedByteLength > 0) {
      const readResult = readFrame(mode);
      if (!readResult.ok) {
        if (readResult.error.kind === "need-more-data") {
          return ok(frames);
        }

        return readResult;
      }

      frames.push(readResult.value);
    }

    return ok(frames);
  }

  return {
    append,
    clear,
    discard,
    getBufferedByteLength,
    peekBufferedBytes,
    readAvailableFrames,
    readFrame
  };
}
