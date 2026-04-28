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

### P1: `env-*` 包已起步，但边界层还没补全

- `env-browser`
- `env-node`

已经落包。

仍欠缺：

- `env-cloudflare`
- `env-bun`
- 更完整的边界适配面

### P1: `env-*` 边界层已起步，但还需要补完整

- `transport-websocket` 的去环境耦合已经完成
- 当前还需要补更多环境适配和对应测试

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

### P2: example 已经进入 env 注入阶段，但仍然只是最小版本

- 现在的 example 已经显式展示了 “协议包 + env 包” 的组合
- 但它仍然是最小 loopback 示例，不是更接近真实环境的完整样例

## 4. 推荐收尾顺序

1. 先统一文档边界原则
2. 再补齐 `env-*` 边界层和示例注入路径
3. 最后做语法和单文件 coverage 硬化

## 5. 一句话判断

FluxBin 现在不是“还缺大框架”，而是进入了：

“边界收口 + 工程纪律硬化 + 最后几块实现补全”阶段。
