# FluxBin Spec Overview

FluxBin 是一个面向 Browser / Node 的极简二进制协议与惰性解析体系。

它的目标不是成为“大而全”的序列化框架，而是定义一套：

- 以 `ArrayBuffer` / `Uint8Array` / `DataView` 为唯一底层载体
- 以 `shape` 为唯一结构来源
- 以固定顺序、固定布局、固定类型规则为核心
- 支持增量流式切包
- 支持字段级惰性读取

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
2. 再加入 `f64` 和 `array`
3. 然后评审 `enum`
4. 最后单独评审 `variant`

`tuple` 更适合作为语法糖，而不是第一批核心能力。
