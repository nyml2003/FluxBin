import { ERROR_CODES } from "../errors/error-codes.js";
import type { FluxBinOptions } from "../limits/default-limits.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import { encodeFrameHeader } from "./frame-header.js";
import { FRAME_HEADER_BYTES } from "./frame-types.js";

export function encodeFrame(
  typeId: number,
  payload: Uint8Array,
  options: FluxBinOptions
): Result<Uint8Array, FluxBinError> {
  if (payload.byteLength > options.limits.maxPayloadBytes) {
    return err(
      protocolError(
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        `Payload length ${String(payload.byteLength)} exceeds maxPayloadBytes.`,
        null
      )
    );
  }

  const totalFrameBytes = FRAME_HEADER_BYTES + payload.byteLength;
  if (totalFrameBytes > options.limits.maxFrameBytes) {
    return err(protocolError(ERROR_CODES.FRAME_TOO_LARGE, `Frame length ${String(totalFrameBytes)} exceeds maxFrameBytes.`, null));
  }

  const header = encodeFrameHeader({ payloadLength: payload.byteLength, typeId }, options);
  if (!header.ok) {
    return header;
  }

  const frame = new Uint8Array(totalFrameBytes);
  frame.set(header.value, 0);
  frame.set(payload, FRAME_HEADER_BYTES);
  return ok(frame);
}
