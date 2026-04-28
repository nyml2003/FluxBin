/**
 * client 错误模型。
 *
 * 这个文件只定义应用侧会话层的错误，不负责协议核心错误分类。
 * 它属于 `packages/client`，用于把 transport / protocol 失败映射成更高层的语义。
 */
export type ClientErrorCode =
  | "CLIENT_NOT_CONNECTED"
  | "CLIENT_NOT_IMPLEMENTED"
  | "CLIENT_REQUEST_TIMEOUT"
  | "CLIENT_TRANSPORT_ERROR"
  | "CLIENT_PROTOCOL_ERROR"
  | "CLIENT_UNKNOWN_RESPONSE_TYPE";

export type ClientError = {
  code: ClientErrorCode;
  message: string;
  details?: unknown;
};

export function createClientError(code: ClientErrorCode, message: string, details?: unknown): ClientError {
  return { code, message, details };
}
