/**
 * WebSocket transport 第一版实现。
 *
 * 这个文件把 WebSocket-like 对象适配成 FluxBin 需要的最小 frame transport。
 * 它只负责连接状态和字节帧搬运，不负责解释 frame / payload 语义。
 */
import type {
  CreateWebSocketTransportOptions,
  WebSocketFrameTransport,
  WebSocketLike,
  WebSocketTransportState
} from "./types.js";

function toUint8Array(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  return null;
}

function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}

export function createWebSocketTransport(
  options: CreateWebSocketTransportOptions
): WebSocketFrameTransport {
  const frameHandlers = new Set<(frame: Uint8Array) => void>();
  const stateHandlers = new Set<(state: WebSocketTransportState) => void>();
  let connectPromise: Promise<void> | null = null;
  let socket: WebSocketLike | null = null;
  let state: WebSocketTransportState = "idle";

  function emitState(nextState: WebSocketTransportState) {
    state = nextState;
    for (const handler of stateHandlers) {
      handler(nextState);
    }
  }

  function attachSocketHandlers(activeSocket: WebSocketLike) {
    const handleOpen = () => {
      emitState("open");
    };
    const handleClose = () => {
      emitState("closed");
    };
    const handleError = () => {
      emitState("error");
    };
    const handleMessage = (event: { data: unknown }) => {
      const frame = toUint8Array(event.data);
      if (frame === null) {
        return;
      }

      /**
       * transport 层只负责把二进制 frame 转交出去。
       * 是否把它解释成某个 typeId，对应的是 client/core 的职责。
       */
      for (const handler of frameHandlers) {
        handler(frame);
      }
    };

    activeSocket.addEventListener("open", handleOpen);
    activeSocket.addEventListener("close", handleClose);
    activeSocket.addEventListener("error", handleError);
    activeSocket.addEventListener("message", handleMessage);
  }

  return {
    connect() {
      if (state === "open") {
        return Promise.resolve();
      }

      if (state === "connecting" && connectPromise !== null) {
        return connectPromise;
      }

      emitState("connecting");
      try {
        socket = options.webSocketFactory(options.url, options.protocols);
      } catch (factoryFailure) {
        emitState("error");
        return Promise.reject(toError(factoryFailure, "WebSocket factory 创建失败。"));
      }
      socket.binaryType = "arraybuffer";
      attachSocketHandlers(socket);

      connectPromise = new Promise<void>((resolve, reject) => {
        if (socket === null) {
          reject(new Error("WebSocket transport 未初始化。"));
          return;
        }

        const activeSocket = socket;

        const finish = () => {
          activeSocket.removeEventListener("open", handleOpen);
          activeSocket.removeEventListener("error", handleError);
          connectPromise = null;
        };

        const handleOpen = () => {
          finish();
          resolve();
        };

        const handleError = (event: { error?: unknown }) => {
          finish();
          const resolvedError = toError(event.error, "WebSocket transport 打开失败。");
          reject(resolvedError);
        };

        activeSocket.addEventListener("open", handleOpen);
        activeSocket.addEventListener("error", handleError);
      });

      return connectPromise;
    },
    disconnect() {
      if (socket === null) {
        emitState("closed");
        return Promise.resolve();
      }

      socket.close();
      socket = null;
      emitState("closed");
      return Promise.resolve();
    },
    send(frame: Uint8Array) {
      if (socket === null || state !== "open") {
        return Promise.reject(new Error("WebSocket transport 尚未连接。"));
      }

      socket.send(frame);
      return Promise.resolve();
    },
    onFrame(handler) {
      frameHandlers.add(handler);
      return () => {
        frameHandlers.delete(handler);
      };
    },
    onStateChange(handler) {
      stateHandlers.add(handler);
      handler(state);
      return () => {
        stateHandlers.delete(handler);
      };
    }
  };
}
