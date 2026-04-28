/**
 * Node 环境 loopback 边界适配。
 *
 * 这个文件提供一个内存中的 WebSocket-like 边界适配，用于示例和测试。
 * 它属于 `env-node`，因为它承担的是环境 IO 模拟和边界注入，而不是协议规则。
 */
import type {
  WebSocketEventMap,
  WebSocketFactory,
  WebSocketLike
} from "@fluxbin/transport-websocket";
import type { LoopbackServerHandler, LoopbackWebSocketBoundary } from "./types.js";

class LoopbackSocket implements WebSocketLike {
  binaryType = "";
  readyState = 0;
  private peer: LoopbackSocket | null = null;
  private readonly listeners = new Map<keyof WebSocketEventMap, Set<(event: unknown) => void>>();

  addEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (event: WebSocketEventMap[K]) => void
  ): void {
    const existing = this.listeners.get(type);
    if (existing !== undefined) {
      existing.add(listener as (event: unknown) => void);
      return;
    }

    this.listeners.set(type, new Set([listener as (event: unknown) => void]));
  }

  attachPeer(peer: LoopbackSocket) {
    this.peer = peer;
  }

  close(): void {
    this.emit("close", {});
  }

  emit<K extends keyof WebSocketEventMap>(type: K, event: WebSocketEventMap[K]): void {
    const listeners = this.listeners.get(type);
    if (listeners === undefined) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }
  }

  removeEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (event: WebSocketEventMap[K]) => void
  ): void {
    const existing = this.listeners.get(type);
    if (existing === undefined) {
      return;
    }

    existing.delete(listener as (event: unknown) => void);
  }

  send(data: Uint8Array): void {
    if (this.peer === null) {
      return;
    }

    const activePeer = this.peer;
    queueMicrotask(() => {
      activePeer.emit("message", { data });
    });
  }
}

export function createLoopbackWebSocketBoundary(): LoopbackWebSocketBoundary {
  let serverHandler: LoopbackServerHandler | null = null;

  const webSocketFactory: WebSocketFactory = () => {
    const clientSocket = new LoopbackSocket();
    const serverSocket = new LoopbackSocket();

    clientSocket.attachPeer(serverSocket);
    serverSocket.attachPeer(clientSocket);

    queueMicrotask(() => {
      clientSocket.emit("open", {});
      serverSocket.emit("open", {});
      if (serverHandler !== null) {
        serverHandler(serverSocket);
      }
    });

    return clientSocket;
  };

  return {
    setServerHandler(handler: LoopbackServerHandler) {
      serverHandler = handler;
    },
    webSocketFactory
  };
}
