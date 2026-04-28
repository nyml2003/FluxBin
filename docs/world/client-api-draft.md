# FluxBin Client API Draft

## 1. 目标

`packages/client` 不是协议内核，它是“应用如何使用 FluxBin”的入口层。

它要解决的是：

- 如何连接
- 如何发消息
- 如何收响应
- 如何订阅推送
- 如何超时、取消、重连

而不是：

- shape 怎么编译
- frame 怎么编码
- registry 怎么治理

这些属于 `packages/core`。

## 2. 依赖关系

推荐关系：

```text
client -> core
client -> transport-websocket | transport-fetch | custom transport
```

禁止关系：

```text
core -> client
core -> transport-*
```

## 3. Transport Contract

建议先抽一个最小 transport 接口：

```ts
export type ClientTransport = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(frame: Uint8Array): Promise<void>;
  onFrame(handler: (frame: Uint8Array) => void): () => void;
  onStateChange?(handler: (state: "idle" | "connecting" | "open" | "closed" | "error") => void): () => void;
};
```

## 4. Client 创建方式

```ts
type CreateClientOptions = {
  registry: Registry;
  transport: ClientTransport;
  requestTimeoutMs?: number;
  metadata?: Record<string, string>;
};

declare function createClient(options: CreateClientOptions): FluxBinClient;
```

## 5. Client 核心接口

```ts
type FluxBinClient = {
  connect(): Promise<Result<void, ClientError>>;
  disconnect(): Promise<Result<void, ClientError>>;

  request<TReq, TRes>(message: ClientMessage<TReq, TRes>): Promise<Result<TRes, ClientError>>;

  publish<T>(message: OutboundMessage<T>): Promise<Result<void, ClientError>>;

  subscribe<T>(message: SubscriptionMessage<T>, handler: (payload: T) => void): Result<() => void, ClientError>;
};
```

## 6. Message Model

建议不要让应用层直接手写裸 `typeId`。

更适合的模型是：

```ts
type MessageDescriptor<TPayload> = {
  typeId: number;
  shape: Shape;
  name?: string;
};
```

然后：

```ts
type OutboundMessage<TPayload> = {
  descriptor: MessageDescriptor<TPayload>;
  payload: TPayload;
};
```

对于 request-response：

```ts
type ClientMessage<TReq, TRes> = {
  request: MessageDescriptor<TReq>;
  response: MessageDescriptor<TRes>;
  payload: TReq;
};
```

## 7. Client 应支持的能力

### Phase C1

- connect / disconnect
- publish
- request / response
- timeout

### Phase C2

- subscription / push
- reconnect
- retry policy

### Phase C3

- auth / metadata hook
- middleware / interceptors
- tracing / diagnostics hooks

## 8. 错误模型

`client` 也必须延续 `Result` 模型。

建议错误分层：

- transport error
- protocol error
- timeout
- cancellation
- decode mismatch
- unknown response type

## 9. 明确不做的事

`client` 不应：

- 直接暴露 `DataView`
- 直接要求应用操作 frame
- 重复实现 shape 校验
- 定义第二套协议 registry

## 10. 一句话定义

`packages/client` 是：

“基于 `core` 和 transport 的应用级消息会话层。”
