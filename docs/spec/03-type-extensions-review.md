# 03. Type Extensions Review

本节记录在 Core 之上可考虑加入的类型扩展，以及当前建议。

## 1. `f64`

`f64` 值得支持，而且建议优先级很高。

原因：

- JS `number` 本身就是 IEEE 754 double
- 比 `f32` 更自然，避免中间数值模型错位
- 固定 8 字节，布局规则简单

建议定义：

- `f64` 按 IEEE 754 binary64 编码
- 走全局统一端序
- 占固定 8 字节

评审点：

- 是否允许 `NaN`
- 是否允许 `Infinity` / `-Infinity`
- 是否保留 `-0`

推荐默认：

- 协议层允许所有合法 bit pattern
- 业务层若需要更强约束，再单独限制

## 2. 数组支持

数组现在已经有第一版实现，但语义收口仍然重要。

当前实现分成两层：

### 2.1 顶层

- `typed`
  - 顶层 object
  - 顶层 object-array
  - 顶层 tuple
- `scalar`
  - 顶层单个原始值
- `scalar-array`
  - 顶层原始值数组

### 2.2 typed 字段内部

- `objectArray`
  - 元素是 object shape
- `scalarArray`
  - 元素是 primitive scalar

这样做的好处是：

- 顶层 payload category 清楚
- 字段级 node kind 也清楚
- 不会出现 `typedRawArray`、`raw typedArray` 这种打架命名

顶层 `scalar-array` 当前布局：

```text
[count:u32][items...]
```

typed 字段里的 `objectArray` / `scalarArray` 当前也采用：

```text
[count:u32][items...]
```

约束：

- `count` 表示元素个数
- 元素按声明顺序连续排列
- 元素之间无分隔符
- 不额外写 `typeSize`

为什么不建议额外写 `typeSize`：

- 固定宽度 scalar 的元素大小本来就由类型决定，重复
- 变长元素上 `typeSize` 根本不成立
- 如果后面真要增强“快速跳过整个数组块”，比 `typeSize` 更值得评估的是 `byteLength`

为什么值得支持：

- 真实协议里重复数据很常见
- 如果完全不支持数组，重复结构会被迫提升到 frame 层处理
- 这会让业务协议写起来很别扭

风险点：

- 惰性读取后部字段时，数组前缀会带来线性跳读成本
- 必须增加 `maxArrayLength` 上限

## 3. `tuple`

元组现在已经支持，而且应继续保留在 typed 家族里。

推荐理解方式：

- `tuple<[A, B, C]>` 本质上是匿名、定长、异构顺序结构

推荐布局：

```text
[A][B][C]
```

建议：

- 实现层应把它编译成统一节点树里的一个 node kind
- 它不是 raw 容器
- 它属于 typed 家族

顶层 typed 应允许：

- object
- object-array
- tuple

也就是：

```ts
// typed tuple root
{
  tuple: ["u32", "utf8-string", { tuple: ["bool", "i16"] }]
}
```

tuple 仍然很像“更直接的有序结构表达”，不是新的协议层机制。
这一点在当前实现里已经成立。

## 4. `enum`

`enum` 可以支持，但规范必须先回答一个问题：

- 它到底只是“命名整数”，还是带行为语义的高层类型？

FluxBin 更适合前者。

推荐定义：

```ts
{ enum: "u8" | "u16" | "u32", values: Record<string, number> }
```

布局：

- 直接编码为底层整数值
- 不写入名字
- 不写入额外元数据

注册时必须校验：

- 值唯一
- 值在底层整数范围内

## 5. `variant`

`variant` 是扩展里最需要单独评审的一项。

原因：

- 它会在字段内部重新引入“判别”
- 它比 enum 更接近“局部协议容器”
- 它会显著影响编译、惰性读取、偏移跳读和类型推导复杂度

推荐最小模型：

```ts
{
  variant: [
    { tag: 1, shape: ShapeA },
    { tag: 2, shape: ShapeB },
  ],
  tagType: "u8"
}
```

推荐布局：

```text
[tag:u8][payload...]
```

建议默认不带局部长度头。

优点：

- 更紧凑
- 与 FluxBin 极简方向一致

代价：

- 分支解析必须完全依赖对应 shape
- 跳过未知分支会更难

所以 `variant` 不应在没有评审前直接进入 Core。

## 6. 建议的引入顺序

建议顺序：

1. `f64`
2. 数组家族
3. `enum`
4. `variant`
5. `tuple`

原因：

- `f64` 增量最小
- 数组业务价值高，而且当前已经有第一版实现
- `enum` 规则可控
- `variant` 影响面最大

## 7. 建议的统一节点表达

FluxBin 下一步不应继续维持“object 专用 shape + 临时补丁节点”的方式。

建议直接转向统一 schema node：

```ts
type PrimitiveNode =
  | "u8"
  | "i8"
  | "u16"
  | "i16"
  | "u32"
  | "i32"
  | "bool"
  | "utf8-string"
  | "f64";

type ObjectSchema = {
  readonly [key: string]: SchemaNode;
};

type SchemaNode =
  | PrimitiveNode
  | ObjectSchema
  | { objectArray: ObjectSchema }
  | { scalarArray: PrimitiveNode }
  | { tuple: readonly SchemaNode[] }
  | { enum: "u8" | "u16" | "u32"; values: Record<string, number> }
  | {
      variant: readonly { tag: number; shape: Record<string, ShapeNode> }[];
      tagType: "u8" | "u16";
    };
```

关键点：

- 统一的是 schema node
- 不是 wire 里的递归 tag node

也就是说，不建议把协议改成：

```text
[nodeTag:u8][content...]
```

然后一路递归嵌套。

那会把 FluxBin 从“外部 schema 驱动的固定布局协议”改成“自描述协议”，方向会变。
