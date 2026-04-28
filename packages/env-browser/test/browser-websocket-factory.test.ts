import { describe, expect, it } from "vitest";
import { createBrowserWebSocketFactory } from "../src/index.js";

class BrowserSocketStub {
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

describe("env-browser websocket factory", () => {
  it("creates sockets through the browser boundary wrapper", () => {
    const originalWebSocket = globalThis.WebSocket;
    // @ts-expect-error test override
    globalThis.WebSocket = BrowserSocketStub;

    const factory = createBrowserWebSocketFactory();
    const socket = factory("ws://browser.test", ["proto"]);

    expect(socket).toBeInstanceOf(BrowserSocketStub);
    const browserSocket = socket as unknown as BrowserSocketStub;
    expect(browserSocket.url).toBe("ws://browser.test");

    if (originalWebSocket !== undefined) {
      globalThis.WebSocket = originalWebSocket;
      return;
    }

    // @ts-expect-error test cleanup
    delete globalThis.WebSocket;
  });
});
