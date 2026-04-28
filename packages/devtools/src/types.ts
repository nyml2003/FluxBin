import type { RawScalarType, RawScalarValue } from "@fluxbin/core";

/**
 * devtools 公共类型。
 *
 * 这个文件定义 inspect / fixture / pretty 相关的输出结构。
 * 它属于开发工具层，不承载运行时协议语义。
 */
export type InspectedFrame = {
  decodedPayload?: unknown;
  flags?: number;
  headerChecksum?: number;
  payloadByteLength: number;
  payloadKind: "invalid" | "raw" | "typed";
  payloadChecksum?: number;
  protocolVersion?: number;
  rawType?: RawScalarType;
  rawValue?: RawScalarValue;
  registeredName?: string;
  registeredTypeId?: number;
  typeTag: number;
};
