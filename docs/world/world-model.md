# FluxBin World Model

## 1. 目标

FluxBin 不只是一个“协议实现仓库”，它最终会演化成一个由多层包组成的体系。

目标不是把所有能力塞进一个包，而是把下面两类层次稳定分开：

1. 非边界层
2. 边界层

## 2. 世界边界

### 2.1 非边界层

非边界层包括：

- `packages/core`
- `packages/client`
- `packages/transport-*`
- `packages/devtools`

共同原则：

- 强类型
- 固定数据 Shape
- 零环境耦合
- 不触碰平台原生 API
- 只依赖协议规则与统一抽象接口

#### `packages/core`

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

- 不感知具体 transport
- 不感知业务 request/response 语义
- 不感知连接生命周期

#### `packages/client`

职责：

- 面向应用的消息 API
- request / response
- timeout / cancel
- retry / reconnect
- push / subscription
- auth / metadata hooks

原则：

- SDK 必须组合 `core + transport-* + env-*`
- SDK 不允许重做协议内核

#### `packages/transport-*`

职责：

- 只定义传输协议抽象和 frame 搬运流程
- 不直接接触平台原生 API
- 不重做 `shape`、`registry`、`frame` 规则

原则：

- transport 不重新解释 shape
- transport 不重做 registry
- transport 只搬运 frame / payload
- transport 不应该直接碰浏览器 / Node / Cloudflare / Bun 原生对象

#### `packages/devtools`

职责：

- frame inspect
- fixture generate
- benchmark
- pretty-print / debug
- docs sync / report

原则：

- tooling 服务开发体验
- tooling 不能反向主导 `core` API

### 2.2 边界层

边界层只由 `env-*` 包组成。

当前已落地：

- `packages/env-browser`
- `packages/env-node`

未来候选：

- `packages/env-cloudflare`
- `packages/env-bun`

这些包是唯一允许：

- 接触原生运行时 API
- 接触运行时特有类型
- 做环境 IO 适配

## 3. 当前已落地的包层次

```text
root/
  bench/

packages/
  core/
  client/
  transport-websocket/
  devtools/
  env-browser/
  env-node/
```

future candidates:

- `packages/transport-fetch`
- `packages/env-cloudflare`
- `packages/env-bun`
- `packages/bench`

## 4. 为什么不是只拆 `core + client`

如果只拆这两个包，短期看很省事，但会带来两个典型问题：

1. transport 职责容易临时塞进 `client`
2. 如果 transport 直接碰环境 API，就会变成 M*N 组合爆炸
3. devtools / benchmark / fixture 最后会继续堆在根目录

所以推荐先把世界边界定清，再决定哪些包首批真正实现。

## 5. 当前执行策略

当前建议：

- 已落地：`packages/core`
- 已落地：`packages/client`、`packages/transport-websocket`、`packages/devtools`
- 已落地第一批边界层：`packages/env-browser`、`packages/env-node`
- 仍待决定：`transport-fetch` 是否需要单独落包，`bench` 是否要从 root 迁入 packages

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

- websocket / http / 其他传输协议抽象
- frame bytes 搬运规则
- 但不直接接触真实环境 API

### `env-*` 支持

- 浏览器 / Node / Cloudflare / Bun 差异收敛
- 原生 API 适配
- 环境专属类型收敛

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

“`core/client/transport/devtools` 保持全域纯净，`env-*` 作为唯一边界层收敛所有环境差异。”
