import { describe, expect, it } from "vitest";
import { createLoopbackWebSocketBoundary } from "../src/index.js";

describe("env-node loopback boundary", () => {
  it("creates paired sockets and forwards bytes to the server side", async () => {
    const boundary = createLoopbackWebSocketBoundary();
    let received: Uint8Array | null = null;

    boundary.setServerHandler((socket) => {
      socket.addEventListener("message", (event) => {
        received = event.data as Uint8Array;
      });
    });

    const socket = boundary.webSocketFactory("loopback://test");
    socket.send(new Uint8Array([1, 2, 3]));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(received).not.toBeNull();
  });

  it("keeps working when there is no server handler and supports close events", async () => {
    const boundary = createLoopbackWebSocketBoundary();
    const socket = boundary.webSocketFactory("loopback://test");
    let closed = false;

    socket.addEventListener("close", () => {
      closed = true;
    });

    socket.close();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(closed).toBe(true);
  });

  it("replaces the server handler and forwards to the latest one", async () => {
    const boundary = createLoopbackWebSocketBoundary();
    let firstCount = 0;
    let secondCount = 0;

    boundary.setServerHandler(() => {
      firstCount += 1;
    });
    boundary.setServerHandler(() => {
      secondCount += 1;
    });

    boundary.webSocketFactory("loopback://replace");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(firstCount).toBe(0);
    expect(secondCount).toBe(1);
  });
});
