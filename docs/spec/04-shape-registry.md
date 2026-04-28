# 04. Shape Registry

本节详细定义 FluxBin 的 Shape Registry。

Registry 不是一个简单的 `typeId -> shape` 映射表，而是协议运行时的中心编排层。

## 1. Registry 的职责

至少承担五件事：

1. 协议路由
2. shape 合法性校验
3. shape 编译
4. 类型绑定
5. 版本治理

### 1.1 协议路由

frame 读出 `typeId` 后，Registry 决定：

- 这个 `typeId` 是否已注册
- 它对应哪个 shape
- 应用哪个编译产物来解码 payload

### 1.2 shape 校验

注册时必须立即校验，而不是拖到运行时首次解码再报错。

至少要校验：

- `typeId` 唯一
- 字段类型属于允许集合
- 嵌套结构合法
- `enum` 值不冲突
- `variant` tag 不冲突
- 深度不超过上限

### 1.3 shape 编译

声明式 shape 必须先编译成执行期元信息。

否则后面会出现问题：

- 每次解码都重新解释 shape
- 惰性偏移跳读无法复用
- 编码和解码共享不了同一份结构计划

### 1.4 类型绑定

Registry 也是 TS 类型系统的连接点：

- `typeId`
- shape
- 实体类型
- 惰性读取对象类型

应由同一套注册 API 串起来。

### 1.5 版本治理

一旦某个 `typeId` 已发布，它就应该被视为稳定 ABI。

Registry 不应允许“静默改绑”。

## 2. 两层结构

推荐把 Registry 分成两层：

1. 声明层
2. 编译层

### 2.1 声明层

用户看到的是：

```ts
registry.register(1001, UserShape, { name: "user.v1" });
registry.register(1002, UserShapeV2, { name: "user.v2" });
```

这里输入的是：

- `typeId`
- 原始 shape
- 可选调试名

### 2.2 编译层

内部真正保存的是编译结果，而不是只保存原始 shape。

例如：

```ts
type CompiledShape = {
  fields: readonly CompiledField[];
  fixedWidth: boolean;
  staticByteLength: number | null;
  depth: number;
};
```

编译层是后续编码、解码、惰性访问共享的基础。

## 3. 为什么要编译

编译不是可选优化，而是核心设计的一部分。

原因有三类。

### 3.1 路由效率

收到一个 frame 后，不能递归解释原始 shape 才开始工作。

应该做到：

- 查表
- 拿到编译产物
- 立即进入切片与读取逻辑

### 3.2 惰性偏移管理

惰性读取某个字段时，需要知道：

- 目标字段前面有哪些字段
- 哪些字段是定长
- 哪些字段是变长
- 是否已有缓存偏移可以复用

这些都依赖编译后的字段计划。

### 3.3 读写镜像

编码和解码必须共享同一份结构知识。

否则就会出现：

- 写时按一套理解
- 读时按另一套理解

这种错误不能接受。

## 4. 编译产物应包含什么

建议至少包含：

- 字段顺序
- 字段种类
- 是否定长
- 定长字节数
- 嵌套编译结果
- 深度

示意：

```ts
type CompiledField =
  | { key: string; kind: "u8"; fixed: true; byteWidth: 1 }
  | { key: string; kind: "u16"; fixed: true; byteWidth: 2 }
  | { key: string; kind: "u32"; fixed: true; byteWidth: 4 }
  | { key: string; kind: "i32"; fixed: true; byteWidth: 4 }
  | { key: string; kind: "f64"; fixed: true; byteWidth: 8 }
  | { key: string; kind: "bool"; fixed: true; byteWidth: 1 }
  | { key: string; kind: "string"; fixed: false }
  | { key: string; kind: "shape"; fixed: boolean; shape: CompiledShape }
  | { key: string; kind: "array"; fixed: false; item: CompiledNode }
  | { key: string; kind: "tuple"; fixed: boolean; items: readonly CompiledNode[] }
  | { key: string; kind: "enum"; fixed: true; base: "u8" | "u16" | "u32" }
  | {
      key: string;
      kind: "variant";
      fixed: false;
      tagType: "u8" | "u16";
      branches: ReadonlyMap<number, CompiledShape>;
    };

type CompiledShape = {
  fields: readonly CompiledField[];
  fixedWidth: boolean;
  staticByteLength: number | null;
  depth: number;
};
```

## 5. 固定宽度计算

Registry 编译时应递归计算：

- 这个 shape 是否全定长
- 如果全定长，总字节数是多少

例子：

- `u32 + bool + i16` 是定长
- `u32 + utf8-string` 是变长
- `array<T>` 必定视为变长
- `variant` 默认视为变长

这个信息很关键，因为它决定：

- 能否 O(1) 定位字段
- 是否能提前知道结构总长度

## 6. 懒读取与偏移缓存

Registry 编译产物要为惰性读取服务。

当 shape 含变长字段时，后部字段偏移通常不能完全静态确定。

建议对象内部采用双缓存：

1. 值缓存
2. 字段起始偏移缓存

第一次访问后部字段时：

- 从最近已知位置顺序跳读
- 记录沿途字段起始偏移
- 后续读取复用缓存

这样可以兼顾：

- 初始零解码
- 后续访问性能

## 7. Registry API 建议

推荐最小接口：

```ts
type RegistryOptions = {
  endian: "little" | "big";
  limits: {
    maxFrameBytes: number;
    maxPayloadBytes: number;
    maxStringBytes: number;
    maxArrayLength: number;
    maxDepth: number;
    maxBufferedBytes: number;
  };
};

declare function createRegistry(options: RegistryOptions): Registry;

interface Registry {
  register<const S>(typeId: number, shape: S, meta?: { name?: string }): Registered<S>;
  has(typeId: number): boolean;
  get(typeId: number): CompiledEntry | undefined;
}
```

注意：

- `register` 应在注册时失败，而不是悄悄覆盖
- `meta.name` 只用于人类可读调试，不进入二进制协议

## 8. 发布约束

对已发布协议，Registry 应遵守：

- 同一 `typeId` 不能重新注册为不同 shape
- 同一 `typeId` 不能静默覆盖
- breaking change 必须使用新 `typeId`

推荐直接把这条做成 API 级硬限制。

## 9. Registry 与实现模块边界

推荐模块边界如下：

- `shape` 定义与校验
- `shape` 编译器
- `registry`
- frame 编解码
- payload 懒读取器
- 类型推导层

其中：

- `registry` 负责治理
- `compiler` 负责结构计划
- `reader` 负责实际读取

不要把三者完全揉成一个对象，否则后面很难演进。
