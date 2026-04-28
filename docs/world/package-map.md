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

- WebSocket 连接与 frame 搬运

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

- request/response 型传输适配

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
4. transport 先冻结边界，再逐个实现
