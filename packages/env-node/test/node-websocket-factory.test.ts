import { describe, expect, it } from "vitest";
import { createNodeWebSocketFactory } from "../src/index.js";

class NodeSocketStub {
  binaryType = "";
  readonly protocols: string | string[] | undefined;
  readonly url: string;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
  }

  addEventListener(): void {}

  close(): void {}

  removeEventListener(): void {}

  send(): void {}
}

describe("env-node websocket factory", () => {
  it("creates sockets through the node boundary wrapper", () => {
    const originalWebSocket = globalThis.WebSocket;
    // @ts-expect-error test override
    globalThis.WebSocket = NodeSocketStub;

    const factory = createNodeWebSocketFactory();
    const socket = factory("ws://node.test", ["node"]);
    const nodeSocket = socket as unknown as NodeSocketStub;

    expect(nodeSocket.url).toBe("ws://node.test");

    if (originalWebSocket !== undefined) {
      globalThis.WebSocket = originalWebSocket;
      return;
    }

    // @ts-expect-error test cleanup
    delete globalThis.WebSocket;
  });

  it("throws when no node websocket implementation exists", () => {
    const originalWebSocket = globalThis.WebSocket;
    // @ts-expect-error test override
    globalThis.WebSocket = undefined;

    const factory = createNodeWebSocketFactory();
    expect(() => factory("ws://node.test")).toThrow("没有可用的 WebSocket");

    if (originalWebSocket !== undefined) {
      globalThis.WebSocket = originalWebSocket;
      return;
    }

    // @ts-expect-error test cleanup
    delete globalThis.WebSocket;
  });
});
