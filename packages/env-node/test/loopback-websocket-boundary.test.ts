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
});
