import { ERROR_CODES } from "../errors/error-codes.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import { err, needMoreData, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import { readU8, readU16, readU32 } from "../scalar/read-scalars.js";
import { writeU8, writeU16, writeU32 } from "../scalar/write-scalars.js";
import { computeFrameChecksum } from "./frame-checksum.js";
import {
  FRAME_HEADER_BYTES,
  FRAME_HEADER_PREFIX_BYTES,
  FRAME_FLAG_RAW_ARRAY,
  FRAME_MAGIC_BYTES,
  FRAME_VERSION,
  PAYLOAD_KIND_CODES,
  type FrameHeader,
  type PayloadKind
} from "./frame-types.js";

function encodePayloadKind(payloadKind: PayloadKind): number {
  return PAYLOAD_KIND_CODES[payloadKind];
}

function decodePayloadKind(code: number): PayloadKind | null {
  if (code === PAYLOAD_KIND_CODES.typed) {
    return "typed";
  }
  if (code === PAYLOAD_KIND_CODES.raw) {
    return "raw";
  }

  return null;
}

export function encodeFrameHeader(
  header: Omit<FrameHeader, "headerChecksum">,
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
  bytes.set(FRAME_MAGIC_BYTES, 0);

  const versionWrite = writeU8(view, 4, header.version);
  if (!versionWrite.ok) {
    return versionWrite;
  }

  const payloadKindWrite = writeU8(view, 5, encodePayloadKind(header.payloadKind));
  if (!payloadKindWrite.ok) {
    return payloadKindWrite;
  }

  const flagsWrite = writeU16(view, 6, header.flags, options.endian);
  if (!flagsWrite.ok) {
    return flagsWrite;
  }

  const typeWrite = writeU32(view, 8, header.typeTag, options.endian);
  if (!typeWrite.ok) {
    return typeWrite;
  }

  const lengthWrite = writeU32(view, 12, header.payloadLength, options.endian);
  if (!lengthWrite.ok) {
    return lengthWrite;
  }

  const payloadChecksumWrite = writeU32(view, 16, header.payloadChecksum, options.endian);
  if (!payloadChecksumWrite.ok) {
    return payloadChecksumWrite;
  }

  const headerChecksum = computeFrameChecksum(bytes.subarray(0, FRAME_HEADER_PREFIX_BYTES));
  const headerChecksumWrite = writeU32(view, 20, headerChecksum, options.endian);
  if (!headerChecksumWrite.ok) {
    return headerChecksumWrite;
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
  for (let index = 0; index < FRAME_MAGIC_BYTES.length; index += 1) {
    if (bytes[resolvedOffset + index] !== FRAME_MAGIC_BYTES[index]) {
      return err(protocolError(ERROR_CODES.INVALID_FRAME_MAGIC, "Invalid frame magic.", resolvedOffset + index));
    }
  }

  const versionResult = readU8(view, resolvedOffset + 4);
  if (!versionResult.ok) {
    return versionResult;
  }
  if (versionResult.value.value !== FRAME_VERSION) {
    return err(
      protocolError(
        ERROR_CODES.UNSUPPORTED_FRAME_VERSION,
        `Unsupported frame version ${String(versionResult.value.value)}.`,
        resolvedOffset + 4
      )
    );
  }

  const payloadKindResult = readU8(view, resolvedOffset + 5);
  if (!payloadKindResult.ok) {
    return payloadKindResult;
  }

  const payloadKind = decodePayloadKind(payloadKindResult.value.value);
  if (payloadKind === null) {
    return err(protocolError(ERROR_CODES.UNKNOWN_PAYLOAD_KIND, "Unknown payloadKind code.", resolvedOffset + 5));
  }

  const flagsResult = readU16(view, resolvedOffset + 6, options.endian);
  if (!flagsResult.ok) {
    return flagsResult;
  }
  const allowedFlags = payloadKind === "raw" ? FRAME_FLAG_RAW_ARRAY : 0;
  if (flagsResult.value.value !== allowedFlags && flagsResult.value.value !== 0) {
    return err(protocolError(ERROR_CODES.INVALID_FRAME_FLAGS, "Unsupported non-zero frame flags.", resolvedOffset + 6));
  }

  const typeResult = readU32(view, resolvedOffset + 8, options.endian);
  if (!typeResult.ok) {
    return typeResult;
  }

  const payloadLengthResult = readU32(view, resolvedOffset + 12, options.endian);
  if (!payloadLengthResult.ok) {
    return payloadLengthResult;
  }

  const payloadChecksumResult = readU32(view, resolvedOffset + 16, options.endian);
  if (!payloadChecksumResult.ok) {
    return payloadChecksumResult;
  }

  const headerChecksumResult = readU32(view, resolvedOffset + 20, options.endian);
  if (!headerChecksumResult.ok) {
    return headerChecksumResult;
  }

  const expectedHeaderChecksum = computeFrameChecksum(
    bytes.subarray(resolvedOffset, resolvedOffset + FRAME_HEADER_PREFIX_BYTES)
  );
  if (headerChecksumResult.value.value !== expectedHeaderChecksum) {
    return err(
      protocolError(
        ERROR_CODES.HEADER_CHECKSUM_MISMATCH,
        "Frame header checksum does not match.",
        resolvedOffset + 20
      )
    );
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
      flags: flagsResult.value.value,
      headerChecksum: headerChecksumResult.value.value,
      payloadKind,
      payloadLength,
      payloadChecksum: payloadChecksumResult.value.value,
      typeTag: typeResult.value.value,
      version: versionResult.value.value
    },
    nextOffset: resolvedOffset + FRAME_HEADER_BYTES
  });
}
