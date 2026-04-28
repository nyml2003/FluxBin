# Current Gaps

## 1. 目标

这份文档只回答一个问题：

“到现在为止，FluxBin 还缺什么？”

它不是 roadmap 替代品，而是面向收尾阶段的高密度欠缺清单。

## 2. 当前已经完成的部分

- `packages/core` 已完成基础协议内核
- `packages/client` 已有最小会话层
- `packages/transport-websocket` 已有第一版实现
- `packages/devtools` 已有第一版 inspect / pretty / fixture
- `examples/basic-roundtrip` 已可运行
- root workspace、lint、test、coverage、build 都已接通

## 3. 当前仍欠缺的部分

### P0: 架构边界口径未完全统一

- world 文档还没有完全切到 “`env-*` 是唯一边界层”
- 现有 transport 文档仍残留旧口径

### P0: 非边界层仍有环境耦合

- `transport-websocket` 仍然直接接触 `globalThis.WebSocket`
- 这与“非边界层不碰平台原生 API”的最终原则不一致

### P0: 单文件 coverage 80% 尚未全面达标

- 当前全局 coverage 已过线
- 但仍有若干文件低于单文件 80%

### P1: `?. / ?? / ?` 仍然偏多

- 当前代码里还有较多可选链、nullish coalescing、可选属性
- 与“尽量不用这些语法”的最终工程风格不一致

### P1: `env-*` 包还不存在

- `env-browser`
- `env-node`
- `env-cloudflare`
- `env-bun`

目前都还只是概念，没有真正落包。

### P1: `client` 仍不是完整版本

还缺：

- reconnect
- subscription
- retry policy
- middleware / interceptors

### P2: `devtools` 仍是第一版

还缺：

- 更完整的 frame dump
- registry visualizer
- 无副作用 fixture 变体

### P2: example 还只是 in-memory roundtrip

- 现在的 example 是诚实的 demo
- 但还不是 “协议包 + env 包” 注入示例

## 4. 推荐收尾顺序

1. 先统一文档边界原则
2. 再引入 `env-*` 包并把 transport 去环境耦合
3. 最后做语法和单文件 coverage 硬化

## 5. 一句话判断

FluxBin 现在不是“还缺大框架”，而是进入了：

“边界收口 + 工程纪律硬化 + 最后几块实现补全”阶段。
