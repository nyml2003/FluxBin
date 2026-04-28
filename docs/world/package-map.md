# FluxBin Package Map

## Root

root 目录只负责：

- workspace orchestration
- shared lint / tsconfig / test config
- docs
- repo-level scripts

root 不负责承载长期业务运行时代码。

## `packages/core`

建议内容：

```text
packages/core/
  src/
    errors/
    frame/
    limits/
    reader/
    registry/
    scalar/
    shape/
    stream/
    types/
    writer/
    index.ts
  test/
    unit/
    integration/
    environment/
```

负责：

- 当前根 `src/*` 的协议内核

## `packages/client`

建议内容：

```text
packages/client/
  src/
    client.ts
    session.ts
    request-response.ts
    subscription.ts
    types.ts
    index.ts
  test/
```

负责：

- 应用侧端到端 API

不负责：

- 重做 `shape`
- 重做 `registry`
- 重做 `frame`
- 直接接触平台原生 API

## `packages/transport-websocket`

建议内容：

```text
packages/transport-websocket/
  src/
    websocket-transport.ts
    types.ts
    index.ts
  test/
```

负责：

- WebSocket 传输协议抽象
- frame 搬运流程

不负责：

- 直接接触浏览器 / Node 原生 WebSocket
- 解释 payload 业务语义

## `packages/transport-fetch`

建议内容：

```text
packages/transport-fetch/
  src/
    fetch-transport.ts
    types.ts
    index.ts
  test/
```

负责：

- request/response 型传输协议抽象

不负责：

- 直接接触具体环境 fetch 实现

## `packages/devtools`

建议内容：

```text
packages/devtools/
  src/
    inspect/
    fixtures/
    pretty/
    index.ts
```

负责：

- inspect / pretty / fixture / debug tooling

不负责：

- 直接接触环境原生 IO

## `packages/env-*`

建议内容：

```text
packages/env-browser/
  src/
    websocket-factory.ts
    fetch-adapter.ts
    types.ts
    index.ts

packages/env-node/
  src/
    websocket-factory.ts
    stream-adapter.ts
    types.ts
    index.ts
```

负责：

- 唯一边界层
- 原生 API 接入
- 环境类型收敛
- IO 适配

原则：

- 所有环境差异都收进这里
- `core/client/transport/devtools` 不再直接碰环境 API

## `packages/bench`

建议内容：

```text
packages/bench/
  src/
    scalar.bench.ts
    frame.bench.ts
    stream.bench.ts
```

负责：

- benchmark harness

## `examples/*`

如果后面需要 examples，建议独立于 packages：

```text
examples/
  client-playground/
  protocol-inspector/
```

用途：

- demo
- 手动验收
- playground

## 当前迁移原则

1. 先把当前 `src/*` 迁到 `packages/core/src/*`
2. root 保留聚合配置和 workspace 命令
3. `client` 先建骨架，不抢 `core` 职责
4. `transport-*` 保持非边界层，不直接碰环境 API
5. `env-*` 作为唯一边界层单独演进
