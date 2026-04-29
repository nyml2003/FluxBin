# FluxBin Current Status And Next Steps

## 1. 目标

这份文档是 FluxBin 当前阶段的唯一收口文档。

它同时回答三件事：

1. 现在已经做到哪里了
2. 现在还缺什么
3. 下一步应该按什么顺序继续做

如果 `roadmap`、world docs、README 与这里冲突，以这里描述的当前状态为准。

## 2. 当前状态

### 2.1 工程状态

当前仓库已经不是“搭骨架阶段”，而是进入了“协议内核已成型，继续做硬化和外层能力扩展”的阶段。

当前工程基线：

- `pnpm typecheck` 可通过
- `pnpm lint` 可通过
- `pnpm test` 可通过
- `pnpm bench` 可运行

### 2.2 当前真实目录结构

当前已落地包结构：

- `packages/core`
- `packages/client`
- `packages/transport-websocket`
- `packages/devtools`
- `packages/env-browser`
- `packages/env-node`
- root `bench/`

当前仍不是实际目录，只是 future candidate：

- `packages/transport-fetch`
- `packages/bench`
- `packages/env-cloudflare`
- `packages/env-bun`

### 2.3 当前已完成的能力

#### 协议内核

`packages/core` 当前已经具备：

- shape validation / compilation
- registry
- scalar codecs
- frame envelope
- stream buffer
- eager payload decode
- lazy payload reader
- payload writer
- raw top-level value / raw top-level scalar-array

#### 当前已支持的结构和负载模式

- typed object
- typed tuple
- typed `objectArray`
- typed `scalarArray`
- raw scalar
- raw top-level `scalar-array`

#### 当前已支持的 raw 顶层标量类型

- `u8`
- `i8`
- `u16`
- `i16`
- `u32`
- `i32`
- `bool`
- `utf8-string`

#### 协议外层生存性保护

当前已经有：

- frame `magic / version / flags / checksum`
- payload / frame size limits
- stream half-frame waiting
- sticky frame splitting
- resync replay
- truncated tail recovery
- structured `need-more-data`

#### 最近已经补强的硬化内容

最近一轮协议内核硬化已经补上：

- 更细的错误码，不再把多种场景都塞进 `INVALID_FIELD_VALUE`
- scalar codec 的 big-endian / signed boundary 回归测试
- typed eager / lazy / raw 三条路径的一致性回归
- stream strict / resync 的边界测试

## 3. 当前仍欠缺的部分

### P0: 协议内核还需要继续硬化，但已经不是大重构阶段

更准确地说，当前缺的不是“大框架”，而是：

- core error 类型体系仍然过于松散
- 每个错误缺少明确、独立、只包含自身语义字段的类型定义
- 更系统的 malformed payload 防御测试
- 更清晰的错误处理文档

这意味着后续应优先做“语义收口和防御加固”，而不是继续大改结构。

### P1: `env-*` 边界层只覆盖 browser / node

当前已落地：

- `env-browser`
- `env-node`

当前不在本轮范围：

- `env-cloudflare`
- `env-bun`

仍值得继续补的，是 browser / node 侧更完整的边界适配和测试覆盖。

### P1: `client` 仍然只是最小版本

当前 `client` 还缺：

- reconnect
- subscription
- retry policy
- middleware / interceptors

### P1: replay / persistence 语义还没补完

目前已经有：

- append-friendly frame log 语义
- stream buffer
- resync replay

但仍然缺：

- `env-node` 侧真实文件适配
- 基于持久化 offset 的增量 replay
- 更强的坏帧诊断信息

### P2: `devtools` 仍是第一版

还缺：

- 更完整的 frame dump
- registry visualizer
- 无副作用 fixture 变体

### P2: example 仍然只是最小演示

- 当前 example 已能展示 “协议包 + env 包” 的组合
- 但仍然是最小 loopback 示例，不是更接近真实环境的完整样例

## 4. 当前阶段判断

一句话判断：

FluxBin 现在不是“还缺大框架”，而是进入了：

“协议内核已成型，接下来优先做错误语义、限制、防御和环境侧补完”阶段。

## 5. 下一步完整计划

### Step 1: Core Error Hardening

目标：

- 先把协议内核的错误模型、坏输入防御和错误语义文档作为同一条主线收口
- 把 error 体系从“松散大对象”推进到“每个错误独立类型、字段只承载自身语义”的状态
- 用测试把新的错误语义锁死
- 让文档能准确说明每种错误该如何处理

建议动作：

- 为每个 `ERROR_CODES` 建立一对一错误类型
- 只保留最小公共基底，例如 `code / kind / message`
- 只有真正需要的错误才带：
  - `offset`
  - `expectedBytes`
  - `availableBytes`
  - 或其他专属字段
- `need-more-data` 保持独立错误族，不把它的字段强塞给其他错误
- 先完成 core error 模型重构，再继续往 dispatch / 推导类型推进
- 把 malformed payload 防御测试从“点状补丁”提升成系统防线，重点覆盖：

- trailing garbage
- truncated nested payload
- oversized string length header
- oversized array count
- bool 非法值
- tuple length mismatch
- header 合法但 payload body 畸形

并要求：

- eager typed decode
- lazy reader
- raw codec
- stream strict / resync

这些路径对同类坏输入给出一致错误语义，并锁住新的独立错误类型字段。
- 同步补错误语义文档，让调用方知道：

- 错误码说明
- 每个错误类型的专属字段说明
- `need-more-data` 与其他协议错误的边界
- 哪些错误是可恢复的
- 哪些错误应直接丢弃当前 frame / payload

### Step 2: Dispatch And Release-Readiness Pass

目标：

- 在前一阶段地基稳定之后，再收口上层 dispatch 入口和发布前复核
- 不再让上层自己处理 `registry.get(...) === undefined`
- 明确 `UNKNOWN_TYPE_ID` 的统一出口
- 做完 dispatch 收口后，立刻执行一次全量复核

建议动作：

- 给 registry 增加 `Result` 风格查询入口
- 给 typed frame -> payload decode 增加统一 dispatch helper
- 并在同一阶段完成发布前复核，确认 `core` 已经可以作为稳定底座继续往外扩：

- 全量 `typecheck / lint / test / bench`
- coverage 薄弱区再看是否值得补最后一轮
- benchmark fixture 是否需要继续固定化
- 最终检查是否还存在重复语义实现

## 6. 推荐顺序

建议按这个顺序继续：

1. 先做 Core Error Hardening
2. 再做 Dispatch And Release-Readiness Pass

原因：

- 先把错误模型地基修正
- 同时把测试和文档一起锁住，避免拆开返工
- 再收口 dispatch 入口并完成整体复核

## 7. 现在不建议优先做的事

当前不建议优先投入：

- `transport-fetch` 落包
- `packages/bench` 迁移
- `f64 / enum / variant` 扩展类型推进

原因不是这些不重要，而是当前更高优先级的问题仍然是：

- 协议内核硬化
- 环境持久化补完
- client 能力补全
