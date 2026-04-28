import { describe, expect, it } from "vitest";
import { createRegistry, encodeFrame, encodeFramedPayload, encodeRawValue, getRawTypeCode } from "@fluxbin/core";
import { createClient } from "../src/client.js";
import type { ClientTransport } from "../src/types.js";
import { createWebSocketTransport } from "@fluxbin/transport-websocket";
import type { WebSocketEventMap, WebSocketLike } from "@fluxbin/transport-websocket";

/**
 * Creates a transport that records outgoing frames and can feed them back to
 * the client as if they were remote responses.
 */
function createMockTransport() {
  let frameHandler: ((frame: Uint8Array) => void) | null = null;
  let connected = false;
  const sentFrames: Uint8Array[] = [];

  const transport: ClientTransport = {
    connect() {
      connected = true;
      return Promise.resolve();
    },
    disconnect() {
      connected = false;
      return Promise.resolve();
    },
    send(frame) {
      if (!connected) {
        return Promise.reject(new Error("not connected"));
      }

      sentFrames.push(frame);
      return Promise.resolve();
    },
    onFrame(handler) {
      frameHandler = handler;
      return () => {
        frameHandler = null;
      };
    }
  };

  return {
    emit(frame: Uint8Array) {
      frameHandler?.(frame);
    },
    sentFrames,
    transport
  };
}

class ExampleSocket implements WebSocketLike {
  binaryType = "";
  readyState = 0;
  private readonly listeners = new Map<keyof WebSocketEventMap, Set<(event: unknown) => void>>();

  constructor() {
    queueMicrotask(() => {
      this.emit("open", {});
    });
  }

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
    const responseFrame = encodeFrame(61, new Uint8Array([1]), createRegistry().options);
    void data;
    if (!responseFrame.ok) {
      return;
    }
    queueMicrotask(() => {
      this.emit("message", { data: responseFrame.value });
    });
  }
}

describe("client", () => {
  it("returns a disconnected error when publish is called too early", async () => {
    const mockTransport = createMockTransport();
    const registry = createRegistry();
    const client = createClient({
      registry,
      transport: mockTransport.transport
    });

    const result = await client.publish({
      descriptor: {
        shape: {
          id: "u32"
        },
        typeId: 99
      },
      payload: {
        id: 1
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CLIENT_NOT_CONNECTED");
    }
  });

  it("connects and publishes frames", async () => {
    const mockTransport = createMockTransport();
    const registry = createRegistry();
    const client = createClient({
      registry,
      transport: mockTransport.transport
    });

    const connectResult = await client.connect();
    expect(connectResult.ok).toBe(true);

    const publishResult = await client.publish({
      descriptor: {
        shape: {
          id: "u32"
        },
        typeId: 1
      },
      payload: {
        id: 7
      }
    });

    expect(publishResult.ok).toBe(true);
    expect(mockTransport.sentFrames).toHaveLength(1);

    const secondConnect = await client.connect();
    expect(secondConnect.ok).toBe(true);
  });

  it("completes a request/response roundtrip", async () => {
    const mockTransport = createMockTransport();
    const registry = createRegistry();
    const client = createClient({
      registry,
      requestTimeoutMs: 25,
      transport: mockTransport.transport
    });

    await client.connect();

    const requestPromise = client.request({
      payload: {
        id: 7
      },
      request: {
        shape: {
          id: "u32"
        },
        typeId: 2
      },
      response: {
        shape: {
          ok: "bool"
        },
        typeId: 3
      }
    });

    const responseShape = registry.get(3);
    expect(responseShape).toBeDefined();
    if (responseShape === undefined) {
      return;
    }

    const responseFrame = encodeFrame(3, new Uint8Array([1]), registry.options);
    expect(responseFrame.ok).toBe(true);
    if (!responseFrame.ok) {
      return;
    }
    mockTransport.emit(responseFrame.value);

    const requestResult = await requestPromise;
    expect(requestResult.ok).toBe(true);
    if (!requestResult.ok) {
      return;
    }

    expect(requestResult.value).toEqual({ ok: true });
  });

  it("times out requests when no response arrives", async () => {
    const mockTransport = createMockTransport();
    const registry = createRegistry();
    const client = createClient({
      registry,
      requestTimeoutMs: 1,
      transport: mockTransport.transport
    });

    await client.connect();

    const result = await client.request({
      payload: {
        id: 1
      },
      request: {
        shape: {
          id: "u32"
        },
        typeId: 10
      },
      response: {
        shape: {
          id: "u32"
        },
        typeId: 11
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CLIENT_REQUEST_TIMEOUT");
    }
  });

  it("maps transport connect failures into Result", async () => {
    const registry = createRegistry();
    const client = createClient({
      registry,
      transport: {
        connect() {
          return Promise.reject(new Error("boom"));
        },
        disconnect() {
          return Promise.resolve();
        },
        onFrame() {
          return () => {};
        },
        send() {
          return Promise.resolve();
        }
      }
    });

    const result = await client.connect();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CLIENT_TRANSPORT_ERROR");
    }
  });

  it("maps disconnect failures into Result", async () => {
    const registry = createRegistry();
    const client = createClient({
      registry,
      transport: {
        connect() {
          return Promise.resolve();
        },
        disconnect() {
          return Promise.reject(new Error("disconnect failed"));
        },
        onFrame() {
          return () => {};
        },
        send() {
          return Promise.resolve();
        }
      }
    });

    const result = await client.disconnect();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CLIENT_TRANSPORT_ERROR");
    }
  });

  it("maps request send failures and disconnected request calls into Result", async () => {
    const disconnectedTransport = createMockTransport();
    const registry = createRegistry();
    const disconnectedClient = createClient({
      registry,
      transport: disconnectedTransport.transport
    });

    const disconnectedResult = await disconnectedClient.request({
      payload: {
        id: 1
      },
      request: {
        shape: {
          id: "u32"
        },
        typeId: 20
      },
      response: {
        shape: {
          id: "u32"
        },
        typeId: 21
      }
    });
    expect(disconnectedResult.ok).toBe(false);

    const failingClient = createClient({
      registry: createRegistry(),
      transport: {
        connect() {
          return Promise.resolve();
        },
        disconnect() {
          return Promise.resolve();
        },
        onFrame() {
          return () => {};
        },
        send() {
          return Promise.reject(new Error("send failed"));
        }
      }
    });

    await failingClient.connect();
    const sendFailure = await failingClient.request({
      payload: {
        id: 1
      },
      request: {
        shape: {
          id: "u32"
        },
        typeId: 30
      },
      response: {
        shape: {
          id: "u32"
        },
        typeId: 31
      }
    });

    expect(sendFailure.ok).toBe(false);
    if (!sendFailure.ok) {
      expect(sendFailure.error.code).toBe("CLIENT_TRANSPORT_ERROR");
    }
  });

  it("maps publish send failures and request decode failures into Result", async () => {
    const publishClient = createClient({
      registry: createRegistry(),
      transport: {
        connect() {
          return Promise.resolve();
        },
        disconnect() {
          return Promise.resolve();
        },
        onFrame() {
          return () => {};
        },
        send() {
          return Promise.reject(new Error("publish failed"));
        }
      }
    });

    await publishClient.connect();
    const publishFailure = await publishClient.publish({
      descriptor: {
        shape: {
          id: "u32"
        },
        typeId: 40
      },
      payload: {
        id: 1
      }
    });
    expect(publishFailure.ok).toBe(false);

    const decodeTransport = createMockTransport();
    const decodeRegistry = createRegistry();
    const decodeClient = createClient({
      registry: decodeRegistry,
      requestTimeoutMs: 25,
      transport: decodeTransport.transport
    });

    await decodeClient.connect();

    const pendingRequest = decodeClient.request({
      payload: {
        id: 7
      },
      request: {
        shape: {
          id: "u32"
        },
        typeId: 50
      },
      response: {
        shape: {
          ok: "bool"
        },
        typeId: 51
      }
    });

    decodeTransport.emit(new Uint8Array([1, 2, 3]));
    decodeTransport.emit(new Uint8Array([9, 0, 0, 0, 0, 0, 0, 0]));
    const invalidResponseFrame = encodeFrame(51, new Uint8Array([9]), decodeRegistry.options);
    expect(invalidResponseFrame.ok).toBe(true);
    if (!invalidResponseFrame.ok) {
      return;
    }
    decodeTransport.emit(invalidResponseFrame.value);

    const decodeFailure = await pendingRequest;
    expect(decodeFailure.ok).toBe(false);
    if (!decodeFailure.ok) {
      expect(decodeFailure.error.code).toBe("CLIENT_PROTOCOL_ERROR");
    }
  });

  it("works with the real websocket transport shape after connect resolves", async () => {
    const registry = createRegistry();
    const transport = createWebSocketTransport({
      url: "ws://shape.test",
      webSocketFactory() {
        return new ExampleSocket();
      }
    });
    const client = createClient({
      registry,
      requestTimeoutMs: 50,
      transport
    });

    const connectResult = await client.connect();
    expect(connectResult.ok).toBe(true);

    const publishResult = await client.publish({
      descriptor: {
        shape: {
          id: "u32"
        },
        typeId: 60
      },
      payload: {
        id: 1
      }
    });
    expect(publishResult.ok).toBe(true);

    const requestResult = await client.request({
      payload: {
        id: 1
      },
      request: {
        shape: {
          id: "u32"
        },
        typeId: 60
      },
      response: {
        shape: {
          ok: "bool"
        },
        typeId: 61
      }
    });

    expect(requestResult.ok).toBe(true);
  });

  it("publishes and requests raw scalar frames", async () => {
    const mockTransport = createMockTransport();
    const registry = createRegistry();
    const client = createClient({
      registry,
      requestTimeoutMs: 25,
      transport: mockTransport.transport
    });

    await client.connect();

    const publishResult = await client.publishRaw({
      descriptor: {
        rawType: "utf8-string"
      },
      payload: "raw ping"
    });
    expect(publishResult.ok).toBe(true);
    expect(mockTransport.sentFrames).toHaveLength(1);

    const rawRequestPromise = client.requestRaw({
      payload: 7,
      request: {
        rawType: "u32"
      },
      response: {
        rawType: "bool"
      }
    });

    const rawPayload = encodeRawValue("bool", true, registry.options);
    expect(rawPayload.ok).toBe(true);
    if (!rawPayload.ok) {
      return;
    }

    const rawResponseFrame = encodeFramedPayload(
      "raw",
      getRawTypeCode("bool"),
      rawPayload.value,
      registry.options
    );
    expect(rawResponseFrame.ok).toBe(true);
    if (!rawResponseFrame.ok) {
      return;
    }

    mockTransport.emit(rawResponseFrame.value);

    const rawRequestResult = await rawRequestPromise;
    expect(rawRequestResult.ok).toBe(true);
    if (!rawRequestResult.ok) {
      return;
    }

    expect(rawRequestResult.value).toBe(true);
  });
});
