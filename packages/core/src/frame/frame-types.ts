export const FRAME_HEADER_BYTES = 8;

export type FrameHeader = {
  payloadLength: number;
  typeId: number;
};

export type DecodedFrame = FrameHeader & {
  payload: Uint8Array;
};
