/**
 * browser 环境 WebSocket factory。
 *
 * 这个文件属于唯一边界层，负责接触浏览器原生 WebSocket。
 * 它把浏览器 API 收敛成 transport 层可消费的统一 factory 抽象。
 */
import type { WebSocketFactory } from "@fluxbin/transport-websocket";

export function createBrowserWebSocketFactory(): WebSocketFactory {
  return (url, protocols) => new WebSocket(url, protocols);
}
