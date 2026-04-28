import { ERROR_CODES } from "../errors/error-codes.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import { err, needMoreData, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import { readU32 } from "../scalar/read-scalars.js";
import { writeU32 } from "../scalar/write-scalars.js";
import { FRAME_HEADER_BYTES, type FrameHeader } from "./frame-types.js";

export function encodeFrameHeader(
  header: FrameHeader,
  options: FluxBinOptions
): Result<Uint8Array, FluxBinError> {
  if (header.payloadLength > options.limits.maxPayloadBytes) {
    return err(
      protocolError(
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        `Payload length ${String(header.payloadLength)} exceeds maxPayloadBytes.`,
        null
      )
    );
  }

  const bytes = new Uint8Array(FRAME_HEADER_BYTES);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const typeWrite = writeU32(view, 0, header.typeId, options.endian);
  if (!typeWrite.ok) {
    return typeWrite;
  }

  const lengthWrite = writeU32(view, 4, header.payloadLength, options.endian);
  if (!lengthWrite.ok) {
    return lengthWrite;
  }

  return ok(bytes);
}

export function decodeFrameHeader(
  bytes: Uint8Array,
  options: FluxBinOptions,
  offset?: number
): Result<{ header: FrameHeader; nextOffset: number }, FluxBinError> {
  let resolvedOffset = 0;
  if (offset !== undefined) {
    resolvedOffset = offset;
  }
  const availableBytes = bytes.byteLength - resolvedOffset;
  if (availableBytes < FRAME_HEADER_BYTES) {
    return err(
      needMoreData(
        "Not enough bytes available for frame header.",
        FRAME_HEADER_BYTES,
        Math.max(availableBytes, 0),
        resolvedOffset
      )
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const typeResult = readU32(view, resolvedOffset, options.endian);
  if (!typeResult.ok) {
    return typeResult;
  }

  const payloadLengthResult = readU32(view, typeResult.value.nextOffset, options.endian);
  if (!payloadLengthResult.ok) {
    return payloadLengthResult;
  }

  const payloadLength = payloadLengthResult.value.value;
  if (payloadLength > options.limits.maxPayloadBytes) {
    return err(
      protocolError(
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        `Payload length ${String(payloadLength)} exceeds maxPayloadBytes.`,
        resolvedOffset
      )
    );
  }

  const totalFrameBytes = FRAME_HEADER_BYTES + payloadLength;
  if (totalFrameBytes > options.limits.maxFrameBytes) {
    return err(
      protocolError(
        ERROR_CODES.FRAME_TOO_LARGE,
        `Frame length ${String(totalFrameBytes)} exceeds maxFrameBytes.`,
        resolvedOffset
      )
    );
  }

  return ok({
    header: {
      payloadLength,
      typeId: typeResult.value.value
    },
    nextOffset: payloadLengthResult.value.nextOffset
  });
}
