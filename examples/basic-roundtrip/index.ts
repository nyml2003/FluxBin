/**
 * FluxBin 最小端到端示例。
 *
 * 这个示例不依赖真实网络，而是用内存 transport 演示
 * core + client + devtools 的最小协作路径，便于在本地快速验证。
 */
import { createRegistry, decodeFrame, decodePayload, encodeFrame, encodePayload } from "@fluxbin/core";
import { createClient, type ClientTransport } from "@fluxbin/client";
import { createFixture, inspectFrame } from "@fluxbin/devtools";

function createLoopbackTransport() {
  let frameHandler: ((frame: Uint8Array) => void) | null = null;
  let connected = false;

  const transport: ClientTransport = {
    connect() {
      connected = true;
      return Promise.resolve();
    },
    disconnect() {
      connected = false;
      return Promise.resolve();
    },
    onFrame(handler) {
      frameHandler = handler;
      return () => {
        frameHandler = null;
      };
    },
    send(frame) {
      if (!connected) {
        return Promise.reject(new Error("loopback 未连接。"));
      }

      /**
       * 这里模拟一个极小 server：
       * 收到 request frame 后，立刻解码并回写一个 response frame。
       */
      const decoded = decodeFrame(frame, registry.options);
      if (decoded.ok) {
        const payload = decodePayload(requestEntry.compiledShape, decoded.value.frame.payload, registry.options);
        if (payload.ok) {
          const encodedResponsePayload = encodePayload(responseEntry.compiledShape, { ok: true }, registry.options);
          if (encodedResponsePayload.ok) {
            const encodedResponseFrame = encodeFrame(responseEntry.typeId, encodedResponsePayload.value, registry.options);
            if (encodedResponseFrame.ok) {
              frameHandler?.(encodedResponseFrame.value);
            }
          }
        }
      }

      return Promise.resolve();
    }
  };

  return transport;
}

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
const transport = createLoopbackTransport();
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
