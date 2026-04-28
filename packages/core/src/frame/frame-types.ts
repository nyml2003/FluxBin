export const FRAME_MAGIC_BYTES = new Uint8Array([0x46, 0x4c, 0x58, 0x42]);
export const FRAME_VERSION = 1;
export const FRAME_HEADER_PREFIX_BYTES = 20;
export const FRAME_HEADER_BYTES = 24;
export const FRAME_FLAG_RAW_ARRAY = 1;

export const PAYLOAD_KIND_CODES = {
  raw: 2,
  typed: 1
} as const;

export type PayloadKind = keyof typeof PAYLOAD_KIND_CODES;

export type FrameHeader = {
  flags: number;
  headerChecksum: number;
  payloadKind: PayloadKind;
  payloadLength: number;
  payloadChecksum: number;
  typeTag: number;
  version: number;
};

export type DecodedFrame = FrameHeader & {
  payload: Uint8Array;
};
