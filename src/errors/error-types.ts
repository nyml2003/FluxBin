import type { ErrorCode } from "./error-codes.js";

type BaseFluxBinError = {
  code: ErrorCode;
  message: string;
  offset: number | null;
  details?: unknown;
};

export type NeedMoreDataError = BaseFluxBinError & {
  kind: "need-more-data";
  expectedBytes: number;
  availableBytes: number;
};

export type ProtocolError = BaseFluxBinError & {
  kind: "protocol-error";
};

export type FluxBinError = NeedMoreDataError | ProtocolError;
