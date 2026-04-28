/**
 * FluxBin client 第一版实现。
 *
 * 这个文件负责最小会话层能力：connect / disconnect / publish / request / timeout。
 * 它依赖 core 做编码解码，依赖 transport 传输 frame，但不重做协议核心规则。
 */
import {
  decodeFrame,
  decodePayload,
  decodeRawValue,
  encodeFrame,
  encodeFramedPayload,
  encodePayload,
  encodeRawValue,
  err,
  getRawTypeCode,
  ok,
  type RawScalarType,
  type RawScalarTypeValue,
  type RegisteredShape,
  type Result
} from "@fluxbin/core";
import { createClientError, type ClientError } from "./errors.js";
import type {
  ClientTransport,
  ClientTransportState,
  CreateClientOptions,
  FluxBinClient,
  MessageDescriptor,
  PublishMessage,
  PublishRawMessage,
  RawRequestMessage,
  RequestMessage
} from "./types.js";

type TypedPendingRequest = {
  kind: "typed";
  resolve: (result: Result<unknown, ClientError>) => void;
  responseShape: RegisteredShape;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
};

type RawPendingRequest = {
  kind: "raw";
  resolve: (result: Result<unknown, ClientError>) => void;
  responseRawType: RawScalarType;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
};

type PendingRequest = RawPendingRequest | TypedPendingRequest;

function createTransportError(message: string, details: unknown): ClientError {
  return createClientError("CLIENT_TRANSPORT_ERROR", message, details);
}

function createProtocolError(message: string, details: unknown): ClientError {
  return createClientError("CLIENT_PROTOCOL_ERROR", message, details);
}

function ensureRegistered<TPayload>(
  descriptor: MessageDescriptor<TPayload>,
  options: CreateClientOptions
): Result<RegisteredShape, ClientError> {
  const existing = options.registry.get(descriptor.typeId);
  if (existing !== undefined) {
    return ok(existing);
  }

  const meta = descriptor.name === undefined ? undefined : { name: descriptor.name };
  const registered = options.registry.register(descriptor.typeId, descriptor.shape, meta);
  if (!registered.ok) {
    return err(createProtocolError("注册消息描述失败。", registered.error));
  }

  return ok(registered.value);
}

function createPendingRequestMap() {
  return new Map<string, PendingRequest[]>();
}

function createPendingRequestKey(payloadKind: "raw" | "typed", typeTag: number) {
  return `${payloadKind}:${String(typeTag)}`;
}

function enqueuePendingRequest(
  pendingByKey: Map<string, PendingRequest[]>,
  payloadKind: "raw" | "typed",
  responseTypeTag: number,
  pending: PendingRequest
) {
  const pendingKey = createPendingRequestKey(payloadKind, responseTypeTag);
  const existing = pendingByKey.get(pendingKey);
  if (existing !== undefined) {
    existing.push(pending);
    return;
  }

  pendingByKey.set(pendingKey, [pending]);
}

function dequeuePendingRequest(
  pendingByKey: Map<string, PendingRequest[]>,
  payloadKind: "raw" | "typed",
  responseTypeTag: number
): PendingRequest | undefined {
  const pendingKey = createPendingRequestKey(payloadKind, responseTypeTag);
  const queue = pendingByKey.get(pendingKey);
  if (queue === undefined) {
    return undefined;
  }

  const nextPending = queue.shift();
  if (queue.length === 0) {
    pendingByKey.delete(pendingKey);
  }

  return nextPending;
}

function createFrameReceiver(
  options: CreateClientOptions,
  pendingByKey: Map<string, PendingRequest[]>
) {
  return (frameBytes: Uint8Array) => {
    const decodedFrame = decodeFrame(frameBytes, options.registry.options);
    if (!decodedFrame.ok) {
      return;
    }

    const pending = dequeuePendingRequest(
      pendingByKey,
      decodedFrame.value.frame.payloadKind,
      decodedFrame.value.frame.typeTag
    );
    if (pending === undefined) {
      return;
    }

    if (pending.timeoutHandle !== null) {
      clearTimeout(pending.timeoutHandle);
    }

    if (pending.kind === "raw") {
      const decodedRawValue = decodeRawValue(
        pending.responseRawType,
        decodedFrame.value.frame.payload,
        options.registry.options
      );
      if (!decodedRawValue.ok) {
        pending.resolve(err(createProtocolError("解码 raw 响应 payload 失败。", decodedRawValue.error)));
        return;
      }

      pending.resolve(ok(decodedRawValue.value));
      return;
    }

    const decodedPayload = decodePayload(
      pending.responseShape.compiledNode,
      decodedFrame.value.frame.payload,
      options.registry.options
    );
    if (!decodedPayload.ok) {
      pending.resolve(err(createProtocolError("解码响应 payload 失败。", decodedPayload.error)));
      return;
    }

    pending.resolve(ok(decodedPayload.value.value));
  };
}

function createTransportStateHandler(stateRef: { value: ClientTransportState }) {
  return (nextState: ClientTransportState) => {
    stateRef.value = nextState;
  };
}

function resolveTimeoutMs(message: { timeoutMs?: number }, options: CreateClientOptions): number {
  let timeoutMs = 5_000;
  if (options.requestTimeoutMs !== undefined) {
    timeoutMs = options.requestTimeoutMs;
  }
  if (message.timeoutMs !== undefined) {
    timeoutMs = message.timeoutMs;
  }

  return timeoutMs;
}

async function publishMessage<TPayload>(
  options: CreateClientOptions,
  transport: ClientTransport,
  stateRef: { value: ClientTransportState },
  message: PublishMessage<TPayload>
): Promise<Result<void, ClientError>> {
  if (stateRef.value !== "open") {
    return err(createClientError("CLIENT_NOT_CONNECTED", "客户端未连接，不能 publish。"));
  }

  const registered = ensureRegistered(message.descriptor, options);
  if (!registered.ok) {
    return registered;
  }

  const encodedPayload = encodePayload(
    registered.value.compiledNode,
    message.payload,
    options.registry.options
  );
  if (!encodedPayload.ok) {
    return err(createProtocolError("编码 publish payload 失败。", encodedPayload.error));
  }

  const encodedFrame = encodeFrame(registered.value.typeId, encodedPayload.value, options.registry.options);
  if (!encodedFrame.ok) {
    return err(createProtocolError("编码 publish frame 失败。", encodedFrame.error));
  }

  try {
    await transport.send(encodedFrame.value);
    return ok(undefined);
  } catch (transportFailure) {
    return err(createTransportError("publish 发送失败。", transportFailure));
  }
}

async function publishRawMessage<TRawType extends RawScalarType>(
  options: CreateClientOptions,
  transport: ClientTransport,
  stateRef: { value: ClientTransportState },
  message: PublishRawMessage<TRawType>
): Promise<Result<void, ClientError>> {
  if (stateRef.value !== "open") {
    return err(createClientError("CLIENT_NOT_CONNECTED", "客户端未连接，不能 publishRaw。"));
  }

  const encodedPayload = encodeRawValue(message.descriptor.rawType, message.payload, options.registry.options);
  if (!encodedPayload.ok) {
    return err(createProtocolError("编码 raw publish payload 失败。", encodedPayload.error));
  }

  const encodedFrame = encodeFramedPayload(
    "raw",
    getRawTypeCode(message.descriptor.rawType),
    encodedPayload.value,
    options.registry.options
  );
  if (!encodedFrame.ok) {
    return err(createProtocolError("编码 raw publish frame 失败。", encodedFrame.error));
  }

  try {
    await transport.send(encodedFrame.value);
    return ok(undefined);
  } catch (transportFailure) {
    return err(createTransportError("raw publish 发送失败。", transportFailure));
  }
}

async function requestMessage<TRequest, TResponse>(
  options: CreateClientOptions,
  transport: ClientTransport,
  stateRef: { value: ClientTransportState },
  pendingByKey: Map<string, PendingRequest[]>,
  message: RequestMessage<TRequest, TResponse>
): Promise<Result<TResponse, ClientError>> {
  if (stateRef.value !== "open") {
    return err(createClientError("CLIENT_NOT_CONNECTED", "客户端未连接，不能 request。"));
  }

  const requestShape = ensureRegistered(message.request, options);
  if (!requestShape.ok) {
    return requestShape;
  }

  const responseShape = ensureRegistered(message.response, options);
  if (!responseShape.ok) {
    return responseShape;
  }

  const encodedPayload = encodePayload(
    requestShape.value.compiledNode,
    message.payload,
    options.registry.options
  );
  if (!encodedPayload.ok) {
    return err(createProtocolError("编码 request payload 失败。", encodedPayload.error));
  }

  const encodedFrame = encodeFrame(message.request.typeId, encodedPayload.value, options.registry.options);
  if (!encodedFrame.ok) {
    return err(createProtocolError("编码 request frame 失败。", encodedFrame.error));
  }

  const timeoutMs = resolveTimeoutMs(message, options);

  return new Promise<Result<TResponse, ClientError>>((resolve) => {
    /**
     * 这里必须先登记 pending request，再真正发送 frame。
     * 否则极快返回的 response 可能在映射表建立前到达，导致请求丢失。
     */
    const pending: PendingRequest = {
      kind: "typed",
      resolve(result) {
        resolve(result as Result<TResponse, ClientError>);
      },
      responseShape: responseShape.value,
      timeoutHandle: null
    };

    enqueuePendingRequest(pendingByKey, "typed", message.response.typeId, pending);

    pending.timeoutHandle = setTimeout(() => {
      dequeuePendingRequest(pendingByKey, "typed", message.response.typeId);
      resolve(err(createClientError("CLIENT_REQUEST_TIMEOUT", "请求超时。")));
    }, timeoutMs);

    void transport.send(encodedFrame.value).catch((transportFailure) => {
      if (pending.timeoutHandle !== null) {
        clearTimeout(pending.timeoutHandle);
      }
      dequeuePendingRequest(pendingByKey, "typed", message.response.typeId);
      resolve(err(createTransportError("request 发送失败。", transportFailure)));
    });
  });
}

async function requestRawMessage<
  TRequestType extends RawScalarType,
  TResponseType extends RawScalarType
>(
  options: CreateClientOptions,
  transport: ClientTransport,
  stateRef: { value: ClientTransportState },
  pendingByKey: Map<string, PendingRequest[]>,
  message: RawRequestMessage<TRequestType, TResponseType>
): Promise<Result<RawScalarTypeValue<TResponseType>, ClientError>> {
  if (stateRef.value !== "open") {
    return err(createClientError("CLIENT_NOT_CONNECTED", "客户端未连接，不能 requestRaw。"));
  }

  const encodedPayload = encodeRawValue(message.request.rawType, message.payload, options.registry.options);
  if (!encodedPayload.ok) {
    return err(createProtocolError("编码 raw request payload 失败。", encodedPayload.error));
  }

  const requestTypeTag = getRawTypeCode(message.request.rawType);
  const responseTypeTag = getRawTypeCode(message.response.rawType);
  const encodedFrame = encodeFramedPayload("raw", requestTypeTag, encodedPayload.value, options.registry.options);
  if (!encodedFrame.ok) {
    return err(createProtocolError("编码 raw request frame 失败。", encodedFrame.error));
  }

  const timeoutMs = resolveTimeoutMs(message, options);

  return new Promise<Result<RawScalarTypeValue<TResponseType>, ClientError>>((resolve) => {
    const pending: PendingRequest = {
      kind: "raw",
      resolve(result) {
        resolve(result as Result<RawScalarTypeValue<TResponseType>, ClientError>);
      },
      responseRawType: message.response.rawType,
      timeoutHandle: null
    };

    enqueuePendingRequest(pendingByKey, "raw", responseTypeTag, pending);

    pending.timeoutHandle = setTimeout(() => {
      dequeuePendingRequest(pendingByKey, "raw", responseTypeTag);
      resolve(err(createClientError("CLIENT_REQUEST_TIMEOUT", "请求超时。")));
    }, timeoutMs);

    void transport.send(encodedFrame.value).catch((transportFailure) => {
      if (pending.timeoutHandle !== null) {
        clearTimeout(pending.timeoutHandle);
      }
      dequeuePendingRequest(pendingByKey, "raw", responseTypeTag);
      resolve(err(createTransportError("raw request 发送失败。", transportFailure)));
    });
  });
}

export function createClient(options: CreateClientOptions): FluxBinClient {
  const pendingByKey = createPendingRequestMap();
  const stateRef = { value: "idle" as ClientTransportState };

  options.transport.onFrame(createFrameReceiver(options, pendingByKey));
  if (options.transport.onStateChange !== undefined) {
    options.transport.onStateChange(createTransportStateHandler(stateRef));
  }

  async function connect() {
    if (stateRef.value === "open") {
      return ok(undefined);
    }

    stateRef.value = "connecting";

    try {
      await options.transport.connect();
      stateRef.value = "open";
      return ok(undefined);
    } catch (transportFailure) {
      stateRef.value = "error";
      return err(createTransportError("transport 连接失败。", transportFailure));
    }
  }

  async function disconnect() {
    try {
      await options.transport.disconnect();
      stateRef.value = "closed";
      return ok(undefined);
    } catch (transportFailure) {
      stateRef.value = "error";
      return err(createTransportError("transport 断开失败。", transportFailure));
    }
  }

  return {
    connect,
    disconnect,
    publish(message) {
      return publishMessage(options, options.transport, stateRef, message);
    },
    publishRaw(message) {
      return publishRawMessage(options, options.transport, stateRef, message);
    },
    request(message) {
      return requestMessage(options, options.transport, stateRef, pendingByKey, message);
    },
    requestRaw(message) {
      return requestRawMessage(options, options.transport, stateRef, pendingByKey, message);
    }
  };
}
