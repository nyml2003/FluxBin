# FluxBin World Model

## 1. 目标

FluxBin 不只是一个“协议实现仓库”，它最终会演化成一个由多层包组成的体系。

目标不是把所有能力塞进一个包，而是把下面四层稳定分开：

1. Protocol Core
2. Transport Adapters
3. End-to-End SDK
4. Tooling / Dev Experience

## 2. 世界边界

### 2.1 Protocol Core

核心职责：

- shape authoring
- shape validation / compilation
- registry
- scalar codecs
- frame codecs
- stream buffer
- lazy reader
- payload writer
- limits / errors / `Result`

原则：

- 核心层不感知具体 transport
- 核心层不感知业务 request/response 语义
- 核心层不感知连接生命周期

### 2.2 Transport Adapters

职责：

- 把“字节帧”放进具体传输介质
- 管理连接或请求生命周期
- 将 transport 事件桥接给 `client`

原则：

- transport 不重新解释 shape
- transport 不重做 registry
- transport 只搬运 frame / payload

### 2.3 End-to-End SDK

职责：

- 面向应用的消息 API
- request / response
- timeout / cancel
- retry / reconnect
- push / subscription
- auth / metadata hooks

原则：

- SDK 必须组合 `core + transport-*`
- SDK 不允许重做协议内核

### 2.4 Tooling / Dev Experience

职责：

- frame inspect
- fixture generate
- benchmark
- pretty-print / debug
- docs sync / report

原则：

- tooling 服务开发体验
- tooling 不能反向主导 `core` API

## 3. 推荐包层次

```text
packages/
  core/
  client/
  transport-websocket/
  transport-fetch/
  devtools/
  bench/
```

## 4. 为什么不是只拆 `core + client`

如果只拆这两个包，短期看很省事，但会带来两个典型问题：

1. transport 职责容易临时塞进 `client`
2. devtools / benchmark / fixture 最后会继续堆在根目录

所以推荐先把世界边界定清，再决定哪些包首批真正实现。

## 5. 当前执行策略

当前建议：

- 第一批真正迁移和实现：`packages/core`
- 第一批只建骨架不做完整实现：`packages/client`
- transport 和 devtools 先冻结文档边界，再按优先级逐步补

## 6. 世界分层和特性分层要一致

### `core` 支持

- scalar
- frame
- stream
- lazy reader
- writer
- registry
- type extensions

### `transport-*` 支持

- websocket / http / 其他传输桥接

### `client` 支持

- request-response
- subscriptions
- timeout / cancel
- retry / reconnect
- auth / metadata

### `devtools` 支持

- inspect
- fixtures
- bench
- diagnostics

## 7. 一句话定义

FluxBin world 应该是：

“`core` 定协议，`transport` 搬字节，`client` 给应用，`devtools` 服务开发。”
