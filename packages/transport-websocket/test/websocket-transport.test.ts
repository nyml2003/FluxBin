import { describe, expect, it } from "vitest";
import { createWebSocketTransport } from "../src/websocket-transport.js";
import type { WebSocketEventMap, WebSocketLike } from "../src/types.js";

/**
 * Minimal fake WebSocket for transport tests.
 *
 * The fake exposes the event methods we rely on and lets tests explicitly
 * trigger open/message/error/close transitions.
 */
class FakeWebSocket implements WebSocketLike {
  binaryType = "";
  readyState = 0;
  sent: Uint8Array[] = [];
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
    this.listeners.get(type)?.delete(listener as (event: unknown) => void);
  }

  send(data: Uint8Array): void {
    this.sent.push(data);
  }
}

class AutoOpenFakeWebSocket extends FakeWebSocket {
  constructor() {
    super();
    queueMicrotask(() => {
      this.emit("open", {});
    });
  }
}

describe("websocket transport", () => {
  it("connects, emits state, and forwards frames", async () => {
    const fakeSocket = new FakeWebSocket();
    const transport = createWebSocketTransport({
      url: "ws://local.test",
      webSocketFactory() {
        return fakeSocket;
      }
    });

    const states: string[] = [];
    transport.onStateChange?.((state) => {
      states.push(state);
    });

    const receivedFrames: Uint8Array[] = [];
    transport.onFrame((frame) => {
      receivedFrames.push(frame);
    });

    const connectPromise = transport.connect();
    fakeSocket.emit("open", {});
    await connectPromise;
    expect(states).toContain("open");

    await transport.send(new Uint8Array([1, 2, 3]));
    expect(fakeSocket.sent).toHaveLength(1);

    fakeSocket.emit("message", { data: new Uint8Array([9, 8, 7]) });
    expect(receivedFrames).toHaveLength(1);
  });

  it("waits for open before connect resolves", async () => {
    const transport = createWebSocketTransport({
      url: "ws://auto-open.test",
      webSocketFactory() {
        return new AutoOpenFakeWebSocket();
      }
    });

    await transport.connect();
    await expect(transport.send(new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
  });

  it("rejects send before open and handles disconnect", async () => {
    const fakeSocket = new FakeWebSocket();
    const transport = createWebSocketTransport({
      url: "ws://local.test",
      webSocketFactory() {
        return fakeSocket;
      }
    });

    await expect(transport.send(new Uint8Array([1]))).rejects.toThrow("尚未连接");

    const connectPromise = transport.connect();
    fakeSocket.emit("open", {});
    await connectPromise;
    await transport.disconnect();
  });

  it("handles missing websocket implementations and ignores unsupported message payloads", async () => {
    const originalWebSocket = globalThis.WebSocket;
    // @ts-expect-error test override
    globalThis.WebSocket = undefined;

    const transport = createWebSocketTransport({
      url: "ws://missing.test"
    });

    await expect(transport.connect()).rejects.toThrow("没有可用的 WebSocket");

    if (originalWebSocket !== undefined) {
      globalThis.WebSocket = originalWebSocket;
    } else {
      // @ts-expect-error test cleanup
      delete globalThis.WebSocket;
    }

    const fakeSocket = new FakeWebSocket();
    const frames: Uint8Array[] = [];
    const normalTransport = createWebSocketTransport({
      url: "ws://local.test",
      webSocketFactory() {
        return fakeSocket;
      }
    });

    normalTransport.onFrame((frame) => {
      frames.push(frame);
    });

    const connectPromise = normalTransport.connect();
    fakeSocket.emit("open", {});
    await connectPromise;
    fakeSocket.emit("message", { data: "ignored" });
    expect(frames).toHaveLength(0);
  });
});
