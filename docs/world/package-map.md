# FluxBin Package Map

这份文档先描述当前仓库真实布局，再列 future candidates。

## Root

root 目录只负责：

- workspace orchestration
- shared lint / tsconfig / test config
- docs
- `bench/`
- `examples/`
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

- 协议内核实现
- lazy reader / writer / registry / frame / scalar codecs

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

当前已落地：

- `packages/env-browser`
- `packages/env-node`

负责：

- 唯一边界层
- 原生 API 接入
- 环境类型收敛
- IO 适配

原则：

- 所有环境差异都收进这里
- `core/client/transport/devtools` 不再直接碰环境 API

## `bench/`

当前 bench 仍保留在 root：

```text
bench/
  index.ts
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

## Future Candidates

- `packages/transport-fetch`
  - request/response 型 transport 候选
- `packages/bench`
  - 如果后面需要把 benchmark 从 root 收进 packages，可单独迁移
- `packages/env-cloudflare`
- `packages/env-bun`
