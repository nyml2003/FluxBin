/**
 * env-node 边界层类型。
 *
 * 这个文件定义 Node 环境下用于示例和测试的 loopback 边界抽象。
 * 它不属于协议内核或 transport 协议层。
 */
import type { WebSocketFactory, WebSocketLike } from "@fluxbin/transport-websocket";

export type LoopbackServerHandler = (socket: WebSocketLike) => void;

export type LoopbackWebSocketBoundary = {
  setServerHandler(handler: LoopbackServerHandler): void;
  webSocketFactory: WebSocketFactory;
};
