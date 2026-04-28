# 01. Core Model

本节只定义 FluxBin 最小且稳定的核心模型。

## 1. 环境与实现约束

- 运行环境限定为 Browser / Node 通用 TS/JS
- 禁止使用 `Proxy`
- 禁止使用 `Object.defineProperty`
- 禁止依赖属性劫持、反射拦截、元编程代理来实现惰性解析
- 数据底层限定为 `ArrayBuffer`、`Uint8Array`、`DataView`
- 访问接口必须是显式方法，不允许通过属性访问隐式触发读取

这意味着 FluxBin 的“懒”必须是显式的，而不是魔法式的。

## 2. Core 类型白名单

Core 层建议支持：

- `u8`
- `i8`
- `u16`
- `i16`
- `u32`
- `i32`
- `bool`
- `utf8-string`
- nested `shape`
- `tuple`
- `object-array`
- `scalar-array`

此外，Core 层允许这些基础类型作为 `raw` 顶层负载直接传输：

- `u8`
- `i8`
- `u16`
- `i16`
- `u32`
- `i32`
- `bool`
- `utf8-string`

Core 层当前也允许 raw 顶层原始值数组：

- `u8[]`
- `i8[]`
- `u16[]`
- `i16[]`
- `u32[]`
- `i32[]`
- `bool[]`
- `utf8-string[]`

### 2.1 bool

- `bool` 固定按 `u8` 编码
- `0` 表示 `false`
- `1` 表示 `true`
- 其他值视为协议错误

### 2.2 utf8-string

固定布局：

```text
[byteLength:u32][utf8 bytes...]
```

约束：

- `byteLength` 表示字节长度，不表示字符数
- `0` 长度合法
- 非法 UTF-8 字节序列视为协议错误

## 3. shape 的角色

`shape` 是 FluxBin 的单一结构来源。

同一份 `shape` 同时定义：

- 二进制字段顺序
- 字段类型
- 嵌套结构
- TS 静态类型推导输入

因此禁止：

- 一份 shape + 一份独立 interface 分别维护
- 运行时布局和类型声明脱节

补充：

- `shape` 只约束 `typed` 模式
- `raw` 模式下不使用 `shape`
- `raw` 当前承载：
  - 单个顶层原始值
  - 顶层原始值数组
- `raw` 不承载结构化业务消息

下一步设计里，`typed` 的 schema 方向会从“纯 object”扩成“统一节点”：

- primitive
- object
- object-array
- scalar-array
- tuple

这里说的“统一节点”是 schema/编译模型层的统一。

不是：

- 在 wire 里给每个节点都写一个 `u8` 类型 tag

FluxBin 的默认 payload 仍然尽量保持：

- 不自描述
- 固定布局
- 由外部 schema 决定解释方式

## 4. shape 的最小表达

推荐把 `shape` 视为纯声明式对象：

```ts
const UserShape = {
  id: "u32",
  active: "bool",
  name: "utf8-string",
  profile: {
    age: "u8",
    city: "utf8-string",
  },
} as const;
```

这里没有：

- 字段元数据
- 结构 ID
- 排列 hint
- 编码策略 tag

Core shape 应尽量保持干净。

但在下一步扩展里，顶层 typed schema 不再只限于 object。

建议的 typed root 方向：

```ts
type TypedRootNode =
  | ObjectSchema
  | { objectArray: ObjectSchema }
  | { tuple: readonly SchemaNode[] };
```

例子：

```ts
// typed object
{
  id: "u32",
  name: "utf8-string"
}

// typed object-array
{
  objectArray: {
    id: "u32",
    name: "utf8-string"
  }
}

// typed tuple
{
  tuple: ["u32", "bool", "utf8-string"]
}
```

## 5. null 的处理

Core 层不建议引入独立 `null` 字段类型。

原因：

- 若 `null` 占 0 字节，会让字段存在感退化
- 若 `null` 需要额外 tag，会引入动态联合语义
- 这与 FluxBin 的“固定 shape、固定布局”方向冲突

因此“空值语义”建议通过以下方式表达：

- 不同 `typeId`
- 外层状态字段
- 业务层协议约定

## 6. Core 层设计原则

Core 层的判断标准不是“功能是否丰富”，而是：

- 布局是否固定
- 编码是否镜像
- 解码是否可验证
- 惰性读取是否可显式控制
- TS 类型是否能稳定推导

只要破坏这几条，就不应进入 Core。
