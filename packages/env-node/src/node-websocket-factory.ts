/**
 * node 环境 WebSocket factory。
 *
 * 这个文件属于边界层，允许在 Node 环境中接触全局 WebSocket 实现。
 * 非边界包不应该再直接读取 `globalThis.WebSocket`。
 */
import type { WebSocketFactory } from "@fluxbin/transport-websocket";

export function createNodeWebSocketFactory(): WebSocketFactory {
  return (url, protocols) => {
    const candidate = globalThis.WebSocket;
    if (typeof candidate !== "function") {
      throw new Error("当前 Node 环境没有可用的 WebSocket 实现。");
    }

    return new candidate(url, protocols);
  };
}
