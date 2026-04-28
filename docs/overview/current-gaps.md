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

### P0: 单文件 coverage 门槛已过线，但还可以继续提高断言质量

- 当前全局 coverage 已过线
- 当前纳入统计的单文件 coverage 也已全部达到 80%+
- 后续更值得继续补的是“错误语义断言更严格”，而不是单纯追执行路径

### P1: `?. / ?? / ?` 仍然偏多

- 当前代码里还有较多可选链、nullish coalescing、可选属性
- 与“尽量不用这些语法”的最终工程风格不一致

### P1: `env-*` 包已起步，但当前只覆盖 browser / node

- `env-browser`
- `env-node`

已经落包。

当前明确不进入本轮范围：

- `env-cloudflare`
- `env-bun`

仍值得继续补的，是 browser / node 侧更完整的边界适配面。

### P1: `env-*` 边界层已起步，但还需要补完整

- `transport-websocket` 的去环境耦合已经完成
- 当前还需要补更多环境适配和对应测试

### P1: `client` 仍不是完整版本

还缺：

- reconnect
- subscription
- retry policy
- middleware / interceptors

### P1: `typed + raw + envelope + log replay` 第一批已经落地，但环境侧持久化还没补完

- `typed`：`typeId + shape + payload`
- `raw`：顶层基础值，不走 registry
- 当前已支持的 raw 顶层类型：
  - `u8`
  - `i8`
  - `u16`
  - `i16`
  - `u32`
  - `i32`
  - `bool`
  - `utf8-string`

目前已经有：

- append-friendly frame log 语义
- stream buffer
- resync replay
- truncated tail recovery
- typed `tuple`
- typed `objectArray`
- typed `scalarArray`
- raw top-level `scalar-array`

接下来更高优先级的缺口变成：

- `env-node` 侧真实文件适配
- 基于持久化 offset 的增量 replay
- 更强的坏帧诊断信息

### P2: `devtools` 仍是第一版

还缺：

- 更完整的 frame dump
- registry visualizer
- 无副作用 fixture 变体

### P2: example 已经进入 env 注入阶段，但仍然只是最小版本

- 现在的 example 已经显式展示了 “协议包 + env 包” 的组合
- 但它仍然是最小 loopback 示例，不是更接近真实环境的完整样例

## 4. 推荐收尾顺序

1. 先补环境侧文件适配和持久化 offset 语义
2. 再继续收紧公开类型面
3. 最后补 client / devtools 的更完整能力

## 5. 一句话判断

FluxBin 现在不是“还缺大框架”，而是进入了：

“协议外层和回放语义已成型，接下来是环境持久化适配、类型面收紧和产品能力扩展”阶段。
