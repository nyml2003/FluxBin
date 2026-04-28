import { err, needMoreData, ok, protocolError } from "../errors/result-factories.js";
import { ERROR_CODES } from "../errors/error-codes.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import type { Result } from "../types/result.js";
import { computeFrameChecksum } from "./frame-checksum.js";
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
  const actualPayloadChecksum = computeFrameChecksum(payload);
  if (actualPayloadChecksum !== headerResult.value.header.payloadChecksum) {
    return err(
      protocolError(
        ERROR_CODES.PAYLOAD_CHECKSUM_MISMATCH,
        "Frame payload checksum does not match.",
        payloadOffset
      )
    );
  }

  return ok({
    frame: {
      flags: headerResult.value.header.flags,
      headerChecksum: headerResult.value.header.headerChecksum,
      payload,
      payloadKind: headerResult.value.header.payloadKind,
      payloadLength,
      payloadChecksum: headerResult.value.header.payloadChecksum,
      typeTag: headerResult.value.header.typeTag,
      version: headerResult.value.header.version
    },
    nextOffset: payloadOffset + payloadLength
  });
}
