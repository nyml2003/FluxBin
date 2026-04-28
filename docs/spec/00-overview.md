# FluxBin Spec Overview

FluxBin 是一个面向 Browser / Node 的极简二进制协议与惰性解析体系。

它的目标不是成为“大而全”的序列化框架，而是定义一套：

- 以 `ArrayBuffer` / `Uint8Array` / `DataView` 为唯一底层载体
- 以 `shape` 为唯一结构来源
- 以固定顺序、固定布局、固定类型规则为核心
- 以带 `magic / version / checksum` 的 envelope 保证帧级完整性
- 支持增量流式切包
- 支持坏帧后的重新同步
- 支持字段级惰性读取
- 支持 `typed` 与 `raw` 两类顶层负载模式
  - 当前设计下一步会把它收口成 `typed / scalar / scalar-array`

的协议内核。

## 阅读顺序

按渐进式披露组织：

1. [01 Core Model](./01-core-model.md)
2. [02 Binary & Streaming](./02-binary-and-streaming.md)
3. [03 Type Extensions Review](./03-type-extensions-review.md)
4. [04 Shape Registry](./04-shape-registry.md)
5. [05 Versioning & Limits](./05-versioning-and-limits.md)

## 核心判断

FluxBin 的设计中心不是“如何支持更多类型”，而是“如何让协议形状、字节布局、类型系统和流式解析保持一致”。

因此它优先保证：

- 协议可预测
- 编解码可镜像
- 惰性读取可验证
- 流式处理可持续推进
- 同一协议内核可同时服务“正式业务消息”和“原始值传输”

并刻意延后或收紧：

- 自描述协议
- 宽松兼容
- 隐式魔法访问
- 任意复杂数据模型

## 当前分层

文档中使用三层能力分组：

- Core
  - 可以直接实现、优先落地的最小协议面
- Structured Extensions
  - 在不破坏核心模型前提下的可控扩展
- Review Required
  - 会显著影响协议表达能力和实现复杂度、需要单独评审的能力

## 当前建议

如果要推进实现，建议顺序是：

1. 先稳定 Core
2. 再加入 `f64`
3. 然后评审 `enum`
4. 最后单独评审 `variant`

当前实现已经支持 `tuple`。
当前实现也已经支持数组节点的第一版：

- typed `objectArray`
- typed `scalarArray`
- top-level raw `scalar-array`

## 顶层负载模式

FluxBin 当前实现仍以双轨为主：

- `typed`
  - 走 `typeId + shape + payload`
  - 用于正式业务协议、路由、多结构消息
- `raw`
  - 直接发送顶层原始值
  - 不走 registry
  - 不要求 shape

当前 `raw` 顶层支持面：

- `u8`
- `i8`
- `u16`
- `i16`
- `u32`
- `i32`
- `bool`
- `utf8-string`

原则：

- 正式协议消息优先使用 `typed`
- 简单原始值传输优先使用 `raw`

下一步的设计收口方向是：

- `typed`
  - 任何走 registry / schema 的顶层负载
  - 顶层允许：
    - object
    - object-array
    - tuple
- `scalar`
  - 顶层单个原始值
- `scalar-array`
  - 顶层原始值数组

这里的关键点不是“每个节点在字节流里先写一个类型 tag”，而是：

- schema / compiled node 需要统一节点模型
- wire format 仍然尽量保持不自描述
