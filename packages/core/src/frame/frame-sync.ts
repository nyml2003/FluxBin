/**
 * frame 重同步工具。
 *
 * 这个文件只负责在脏流里重新寻找下一个合法 frame 起点。
 * WebSocket 这种天然分帧传输通常用不到它，但文件/流式场景会需要。
 */
import { err, needMoreData, ok } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import type { Result } from "../types/result.js";
import { decodeFrame } from "./decode-frame.js";
import { FRAME_HEADER_BYTES, FRAME_MAGIC_BYTES } from "./frame-types.js";
import type { DecodedFrame } from "./frame-types.js";

function matchesMagic(bytes: Uint8Array, offset: number): boolean {
  for (let index = 0; index < FRAME_MAGIC_BYTES.length; index += 1) {
    if (bytes[offset + index] !== FRAME_MAGIC_BYTES[index]) {
      return false;
    }
  }

  return true;
}

function getTrailingMagicPrefixLength(bytes: Uint8Array, offset: number): number {
  const availableBytes = bytes.byteLength - offset;
  const maxPrefixLength = Math.min(FRAME_MAGIC_BYTES.length - 1, availableBytes);

  for (let prefixLength = maxPrefixLength; prefixLength > 0; prefixLength -= 1) {
    const prefixOffset = bytes.byteLength - prefixLength;
    let isMatch = true;

    for (let index = 0; index < prefixLength; index += 1) {
      if (bytes[prefixOffset + index] !== FRAME_MAGIC_BYTES[index]) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      return prefixLength;
    }
  }

  return 0;
}

export function findNextFrameMagicOffset(bytes: Uint8Array, offset?: number): number | null {
  let resolvedOffset = 0;
  if (offset !== undefined) {
    resolvedOffset = offset;
  }

  const lastCandidateOffset = bytes.byteLength - FRAME_MAGIC_BYTES.length;
  for (let index = resolvedOffset; index <= lastCandidateOffset; index += 1) {
    if (matchesMagic(bytes, index)) {
      return index;
    }
  }

  return null;
}

export function decodeFrameWithResync(
  bytes: Uint8Array,
  options: FluxBinOptions,
  offset?: number
): Result<{ frame: DecodedFrame; frameOffset: number; nextOffset: number; skippedBytes: number }, FluxBinError> {
  let resolvedOffset = 0;
  if (offset !== undefined) {
    resolvedOffset = offset;
  }

  let scanOffset = resolvedOffset;
  while (scanOffset < bytes.byteLength) {
    const magicOffset = findNextFrameMagicOffset(bytes, scanOffset);
    if (magicOffset === null) {
      const trailingMagicBytes = getTrailingMagicPrefixLength(bytes, resolvedOffset);
      return err(
        needMoreData(
          "No complete frame sync marker found yet.",
          FRAME_HEADER_BYTES,
          bytes.byteLength - resolvedOffset,
          resolvedOffset,
          { trailingMagicBytes }
        )
      );
    }

    const decodedFrame = decodeFrame(bytes, options, magicOffset);
    if (decodedFrame.ok) {
      return ok({
        frame: decodedFrame.value.frame,
        frameOffset: magicOffset,
        nextOffset: decodedFrame.value.nextOffset,
        skippedBytes: magicOffset - resolvedOffset
      });
    }

    if (decodedFrame.error.kind === "need-more-data") {
      return decodedFrame;
    }

    scanOffset = magicOffset + 1;
  }

  return err(
    needMoreData("No complete frame sync marker found yet.", FRAME_HEADER_BYTES, bytes.byteLength - resolvedOffset, resolvedOffset)
  );
}
