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

## 2. `array<T>`

数组可以支持，但建议只先支持“同构变长数组”。

推荐布局：

```text
[count:u32][item1][item2][item3]...
```

约束：

- `count` 表示元素个数
- 元素按声明顺序连续排列
- 元素之间无分隔符

为什么值得支持：

- 真实协议里重复数据很常见
- 如果完全不支持数组，重复结构会被迫提升到 frame 层处理
- 这会让业务协议写起来很别扭

风险点：

- 惰性读取后部字段时，数组前缀会带来线性跳读成本
- 必须增加 `maxArrayLength` 上限

## 3. `tuple`

元组可以支持，但不建议作为第一优先级核心能力。

推荐理解方式：

- `tuple<[A, B, C]>` 本质上是匿名、定长、异构顺序结构

推荐布局：

```text
[A][B][C]
```

建议：

- 实现层可把它编译为匿名 shape
- 语义上更像“写法优化”，不是全新协议机制

因此它更适合作为语法糖。

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
2. `array<T>`
3. `enum`
4. `variant`
5. `tuple` 作为语法糖补入

原因：

- `f64` 增量最小
- `array<T>` 业务价值高
- `enum` 规则可控
- `variant` 影响面最大

## 7. 建议的统一形状表达

可评审的 shape node 方向如下：

```ts
type ShapeNode =
  | "u8"
  | "i8"
  | "u16"
  | "i16"
  | "u32"
  | "i32"
  | "f64"
  | "bool"
  | "utf8-string"
  | { [key: string]: ShapeNode }
  | { array: ShapeNode }
  | { tuple: readonly ShapeNode[] }
  | { enum: "u8" | "u16" | "u32"; values: Record<string, number> }
  | {
      variant: readonly { tag: number; shape: Record<string, ShapeNode> }[];
      tagType: "u8" | "u16";
    };
```

这只是设计草案，不是最终冻结格式。
