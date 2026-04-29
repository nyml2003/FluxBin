# FluxBin

FluxBin 是一个面向 Browser / Node 的极简二进制协议设计方案。

当前仓库的已落地包结构是：

- `packages/core`
- `packages/client`
- `packages/transport-websocket`
- `packages/devtools`
- `packages/env-browser`
- `packages/env-node`
- root `bench/`

当前文档入口：

- [Spec Overview](./docs/spec/00-overview.md)
- [World Docs](./docs/world/README.md)
- [Current Gaps](./docs/overview/current-gaps.md)

说明：

- `transport-fetch`
- `packages/bench`

目前仍属于 future candidate，不是当前仓库中的实际目录。

建议阅读顺序：

1. [Core Model](./docs/spec/01-core-model.md)
2. [Binary And Streaming](./docs/spec/02-binary-and-streaming.md)
3. [Type Extensions Review](./docs/spec/03-type-extensions-review.md)
4. [Shape Registry](./docs/spec/04-shape-registry.md)
5. [Versioning And Limits](./docs/spec/05-versioning-and-limits.md)
6. [World Model](./docs/world/world-model.md)
7. [Package Map](./docs/world/package-map.md)
8. [Boundary Model](./docs/world/boundary-model.md)
9. [Client API Draft](./docs/world/client-api-draft.md)
10. [Current Gaps](./docs/overview/current-gaps.md)

当前文档组织目标：

- 先讲稳定核心
- 再讲类型扩展
- 再讲包世界和 SDK 边界
- 最后展开注册表、演进和安全边界
