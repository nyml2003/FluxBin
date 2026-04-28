import { err, needMoreData, ok } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import type { Result } from "../types/result.js";
import { decodeFrameHeader } from "./frame-header.js";
import type { DecodedFrame } from "./frame-types.js";

export function decodeFrame(
  bytes: Uint8Array,
  options: FluxBinOptions,
  offset?: number
): Result<{ frame: DecodedFrame; nextOffset: number }, FluxBinError> {
  let resolvedOffset = 0;
  if (offset !== undefined) {
    resolvedOffset = offset;
  }
  const headerResult = decodeFrameHeader(bytes, options, resolvedOffset);
  if (!headerResult.ok) {
    return headerResult;
  }

  const payloadOffset = headerResult.value.nextOffset;
  const payloadLength = headerResult.value.header.payloadLength;
  const availableBytes = bytes.byteLength - payloadOffset;
  if (availableBytes < payloadLength) {
    return err(
      needMoreData("Not enough bytes available for frame payload.", payloadLength, Math.max(availableBytes, 0), payloadOffset)
    );
  }

  const payload = bytes.slice(payloadOffset, payloadOffset + payloadLength);
  return ok({
    frame: {
      payload,
      payloadLength,
      typeId: headerResult.value.header.typeId
    },
    nextOffset: payloadOffset + payloadLength
  });
}
