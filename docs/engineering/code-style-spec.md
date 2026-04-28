# 代码规范

## 目标

这份文档定义 FluxBin 的实现规范。

目标不是统一格式细节，而是保护已经定下来的架构方向：

- `shape` 单一结构来源
- frame / stream / registry / reader / writer 严格分层
- 流式推进和惰性读取共存
- 二进制布局固定、镜像、可验证
- 热路径对 Browser / Node 公共运行时友好

后续实现如果违反这里的规则，就不是“风格不同”，而是直接偏离协议架构。

## 规范等级

### 硬规则

必须执行。违反就需要重构，不接受“先这样写起来”。

### 软规则

默认执行。只有在明确收益更高时才允许例外，并且要写清理由。

本文里没有特殊说明的规则，一律按硬规则处理。

## 一、分层边界规范

### 1. `packages/core/src/shape`

允许：

- 定义 `ShapeNode`
- 校验 shape 合法性
- 递归深度与节点约束检查

禁止：

- 直接读写 frame 字节
- 直接操作流缓冲
- 偷带 registry 状态

### 2. `packages/core/src/registry`

允许：

- 维护 `typeId -> compiled shape`
- 注册合法性校验入口
- 路由查询
- 发布级协议治理

禁止：

- 直接操作流缓冲区
- 直接承担 payload 字段读取
- 偷带 writer 逻辑

### 3. `packages/core/src/frame`

允许：

- 定义默认 frame 格式
- 编码/解码 `typeId`
- 编码/解码 `payloadLength`
- frame 级边界判定

禁止：

- 解析 payload 内字段
- 感知业务 shape 语义

### 4. `packages/core/src/stream`

允许：

- 增量缓冲
- 粘包拆分
- 半包等待
- 已消费前缀裁剪

禁止：

- 解释 payload 字段语义
- 替 registry 做 `typeId` 治理

### 5. `packages/core/src/reader`

允许：

- payload 惰性读取
- 字段值缓存
- 字段偏移缓存
- 局部临时偏移读取

禁止：

- 修改主流式消费指针
- 用属性访问触发解析
- 直接管理 frame 生命周期

### 6. `packages/core/src/writer`

允许：

- shape 驱动编码
- 与 reader 共享 compiled shape
- 严格按字段顺序输出

禁止：

- 自动补默认值
- 自动跳过协议字段
- 动态重排字段

### 7. `packages/core/src/scalar`

允许：

- 标量读写原语
- `DataView` 统一封装
- 端序处理

禁止：

- 掺杂 registry、shape、stream 逻辑

### 8. `packages/core/src/errors`

允许：

- 错误码
- `Result` 类型
- `need-more-data` / `protocol-error` 结果建模

### 9. `packages/core/src/limits`

允许：

- 上限配置
- 长度约束
- 深度约束
- 输入防御

## 二、数据布局规范

### 1. 热路径优先稳定视图

热路径优先使用：

- `ArrayBuffer`
- `Uint8Array`
- `DataView`
- 稳定元素类型的普通数组

不优先使用：

- 深层对象图
- `Map`
- `Set`
- 动态形状对象

### 2. 热对象字段必须固定

`CompiledShape`、`StreamBufferState`、`LazyReaderState` 这类热对象必须：

- 构造时一次性初始化所有字段
- 后续不增加新字段
- 后续不删除字段

禁止：

- `delete`
- 条件式加字段
- 同类对象出现多种 shape

### 3. 同类数组元素类型必须稳定

允许：

- 偏移数组全是 number
- 缓存数组全是同一类结果
- 冷路径引用区明确标成 `unknown[]`

禁止：

- 一个热数组里混 number、object、function
- 用 `null` / object / number 混合表达多种状态

### 4. 冷热数据分离

热路径数据：

- 当前偏移
- 缓冲长度
- 字段偏移缓存
- 字段值缓存
- frame 长度信息

冷路径数据：

- debug name
- source note
- profiling tag
- 开发期统计

禁止把冷字段挂进热对象主结构。

## 三、命名规范

### 1. 协议原语命名

统一使用直接语义名：

- `typeId`
- `payloadLength`
- `cursor`
- `offsetCache`
- `valueCache`

禁止造词和悬空命名。

### 2. 编译层字段命名

统一使用直接名：

- `fieldKind`
- `fixedWidth`
- `staticByteLength`
- `tagType`
- `maxBufferedBytes`

禁止：

- 自造缩写
- 模糊双关命名
- “增强版”“优化版”这类悬空名字

### 3. 函数命名

优先动作导向：

- `compileShape`
- `registerShape`
- `decodeFrame`
- `pushChunk`
- `readField`
- `writePayload`

禁止：

- `handleStuff`
- `processData`
- `runMagic`

### 4. 缩写规则

允许固定术语缩写：

- `TS`
- `UTF8`
- `ABI`

禁止项目内部随意发明缩写。

## 四、结构与状态规范

### 1. 禁止隐式解析

禁止：

- `Proxy`
- `Object.defineProperty`
- 读取属性时自动触发字段解码

所有读取必须显式进入：

- `get(...)`
- `read(...)`
- `decode...(...)`

### 2. 派生信息必须来自编译产物

允许：

- 通过 `CompiledShape` 计算字段偏移
- 通过 `CompiledField` 驱动编码

禁止：

- reader 运行时重新解释原始 shape
- writer 运行时绕开 compiled shape 自己猜布局

### 3. 流控制必须显式

半包状态、完整 frame、协议错误必须明确区分。

禁止：

- 用异常表达半包
- 用 `undefined` 混合表达成功和失败

## 五、类型规范

### 1. TypeScript 一律严格模式

要求：

- `strict: true`
- 不用 `any`
- 尽量避免不必要的类型断言

### 2. 公共接口必须结构明确

公共类型要明确字段，不返回模糊对象。

优先：

```ts
type FrameHeader = {
  typeId: number;
  payloadLength: number;
};
```

不优先：

```ts
type FrameHeader = Record<string, unknown>;
```

### 3. Result 优先

默认使用固定键集的判别联合：

```ts
type Result<T, E> =
  | { ok: true; value: T; error: null }
  | { ok: false; value: null; error: E };
```

说明：

- 固定的是键集合：`ok` / `value` / `error`
- 不能写成固定 `ok: true`，否则失败态无法表达

规则：

- 可预期失败优先返回 `Result`
- 不用 `throw new Error(...)` 作为常规控制流
- `Error` 只留给真正不可恢复、不可继续的程序级异常

### 4. 状态机优先枚举值或稳定常量

frame 状态、reader 状态、错误码一律使用稳定常量或枚举。

禁止裸字符串散落在实现里。

## 六、函数与控制流规范

### 1. 热路径函数要短

热路径函数只做一层职责。

例如：

- `readU32`
- `decodeFrameHeader`
- `advanceCursor`
- `resolveFieldOffset`

不要写一个函数同时做：

- 注册治理
- 流缓冲推进
- 字段级解码

### 2. 早返回优先

guard 场景下优先早返回，减少多层嵌套。

### 3. 分支条件必须可解释

复杂分支前要能回答：

- 这是谁的职责
- 这个条件在保护什么
- 不满足时为什么应该直接退出

## 七、注释规范

### 1. 注释只写必要信息

允许写：

- 为什么这样做
- 哪个边界不能破
- 哪个顺序不能改

不要写：

- 一眼能看懂的行为解释
- 废话式注释

### 2. 热路径优先用命名解释，不靠长注释解释

如果一段代码必须靠大段注释才能理解，先改命名和拆函数。

### 3. 边界规则允许写硬注释

例如：

```ts
// payloadLength 超限时必须先终止当前 frame，不能继续探测后续字节。
```

这种注释是有价值的。

## 八、文件与目录规范

### 1. 文件命名

优先：

- `shape-compiler.ts`
- `frame-codec.ts`
- `stream-buffer.ts`
- `lazy-reader.ts`
- `result.ts`

不要用：

- `utils.ts`
- `helpers.ts`
- `misc.ts`

### 2. 目录组织

一个目录只服务一个稳定边界。

shape、registry、frame、stream、reader、writer 不混放。

### 3. 测试文件命名

统一：

- `*.test.ts`

按边界命名：

- `shape-compiler.test.ts`
- `frame-codec.test.ts`
- `stream-buffer.test.ts`
- `lazy-reader.test.ts`

## 九、测试规范

### 1. 每个核心能力都要测两层

- 结构正确性
- 状态推进正确性

### 2. Stream 必测

至少测：

- 半包
- 粘包
- 裁剪
- 超限拒绝

### 3. Reader 必测

至少测：

- 首次读取
- 值缓存
- 偏移缓存
- 局部偏移恢复

### 4. Registry 必测

至少测：

- 重复 `typeId` 拒绝
- 非法 shape 拒绝
- 版本改绑拒绝

## 十、禁止写法清单

下面这些写法直接禁止：

1. 属性访问隐式解析
2. 热路径动态 shape 变化
3. stream 承担 registry 职责
4. registry 承担 reader 职责
5. writer 绕开 compiled shape 直接猜布局
6. `Map` / `Set` 进入最热字段访问路径
7. `utils.ts` / `helpers.ts` 式杂物文件
8. 大函数同时处理注册、流、字段解析三层职责
9. 用 `throw new Error(...)` 代替可预期失败的 `Result`

## 十一、提交前检查

每次提交前至少确认：

1. 有没有破坏分层边界
2. 有没有引入隐式解析
3. 有没有让热路径对象 shape 变得不稳定
4. 有没有把可预期失败写成异常控制流
5. 测试是否覆盖新增边界或状态转移
