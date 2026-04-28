/**
 * FluxBin 最小端到端示例。
 *
 * 这个示例显式展示 “非边界协议包 + env 边界包” 的组合方式：
 * - `core` 负责协议
 * - `client` 负责会话
 * - `transport-websocket` 负责传输抽象
 * - `env-node` 负责边界注入
 * - `devtools` 负责开发辅助
 */
import { createRegistry, decodeFrame, decodePayload, encodeFrame, encodePayload } from "@fluxbin/core";
import { createClient } from "@fluxbin/client";
import { createFixture, inspectFrame } from "@fluxbin/devtools";
import { createLoopbackWebSocketBoundary } from "@fluxbin/env-node";
import { createWebSocketTransport } from "@fluxbin/transport-websocket";

const registry = createRegistry();
const requestDescriptor = {
  name: "request.v1",
  shape: {
    city: "utf8-string"
  },
  typeId: 100
} as const;
const responseDescriptor = {
  name: "response.v1",
  shape: {
    ok: "bool"
  },
  typeId: 101
} as const;

const requestRegistered = registry.register(requestDescriptor.typeId, requestDescriptor.shape, { name: requestDescriptor.name });
if (!requestRegistered.ok) {
  throw new Error("注册 request descriptor 失败。");
}

const responseRegistered = registry.register(responseDescriptor.typeId, responseDescriptor.shape, { name: responseDescriptor.name });
if (!responseRegistered.ok) {
  throw new Error("注册 response descriptor 失败。");
}

const requestEntry = requestRegistered.value;
const responseEntry = responseRegistered.value;
const boundary = createLoopbackWebSocketBoundary();
boundary.setServerHandler((serverSocket) => {
  serverSocket.addEventListener("message", (event) => {
    /**
     * 这里模拟一个极小 server：
     * env 边界层把“收发消息”的壳搭出来，示例内部只借它演示协议链路。
     */
    const frame = event.data;
    if (!(frame instanceof Uint8Array)) {
      return;
    }

    const decoded = decodeFrame(frame, registry.options);
    if (!decoded.ok) {
      return;
    }

    const payload = decodePayload(requestEntry.compiledShape, decoded.value.frame.payload, registry.options);
    if (!payload.ok) {
      return;
    }

    const encodedResponsePayload = encodePayload(responseEntry.compiledShape, { ok: true }, registry.options);
    if (!encodedResponsePayload.ok) {
      return;
    }

    const encodedResponseFrame = encodeFrame(responseEntry.typeId, encodedResponsePayload.value, registry.options);
    if (!encodedResponseFrame.ok) {
      return;
    }

    serverSocket.send(encodedResponseFrame.value);
  });
});

const transport = createWebSocketTransport({
  url: "loopback://example",
  webSocketFactory: boundary.webSocketFactory
});
const client = createClient({
  registry,
  requestTimeoutMs: 250,
  transport
});

async function main() {
  const connectResult = await client.connect();
  if (!connectResult.ok) {
    throw new Error(connectResult.error.message);
  }

  const requestResult = await client.request({
    payload: {
      city: "上海"
    },
    request: requestDescriptor,
    response: responseDescriptor
  });

  if (!requestResult.ok) {
    throw new Error(requestResult.error.message);
  }

  const fixture = createFixture(
    {
      name: "example-city.v1",
      payload: {
        city: "上海"
      },
      shape: {
        city: "utf8-string"
      },
      typeId: 200
    },
    registry
  );

  console.log("request result:", requestResult.value);
  console.log("fixture inspect:", inspectFrame(fixture.frameBytes, registry));
}

await main();
