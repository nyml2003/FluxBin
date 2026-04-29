# FluxBin Roadmap

本文档定义 FluxBin 的实现路线、阶段目标和验收标准。

原则：

- 先做不会反复返工的底层边界
- 先做 Core，再做扩展
- 每阶段都必须能验证，不做空转里程碑

## Phase 0: Project Skeleton

目标：

- 建立最小仓库结构
- 建立构建、类型检查、测试运行骨架
- 固化基础 lint / tsconfig / test runner

产物：

- `src/` 初始目录
- `test/` 初始目录
- TypeScript 配置
- 测试配置

不做：

- 协议实现
- 复杂类型体操

验收：

- 空项目可完成 `typecheck`
- 空测试可运行
- Browser / Node 双环境测试基线可执行

## Phase 1: Core Types And Scalar IO

目标：

- 实现 Core 标量类型定义
- 实现底层标量读写原语
- 冻结端序处理方式

范围：

- `u8` / `i8`
- `u16` / `i16`
- `u32` / `i32`
- `bool`
- `utf8-string`

产物：

- `ShapeNode` Core 版本
- `DataView` 基础读写器
- `bool` / `utf8-string` 规则实现

不做：

- frame
- registry
- lazy reader

验收：

- 所有 Core 标量有对称编解码测试
- `bool` 非法值有错误测试
- `utf8-string` 空串、中文、多字节内容可通过

## Phase 2: Shape Validation And Compilation

目标：

- 实现 shape 合法性校验
- 实现 shape 编译产物
- 计算定长/变长信息

产物：

- shape validator
- `CompiledShape`
- `CompiledField`

不做：

- 增量流
- typeId 路由

验收：

- 非法 shape 注册前即可失败
- 可区分定长与变长 shape
- 嵌套深度上限可生效

## Phase 3: Registry Skeleton

目标：

- 建立 `typeId -> compiled shape` 注册表
- 拒绝重复注册
- 暴露最小查询接口

产物：

- `createRegistry`
- `register`
- `get`
- `has`

不做：

- 流式切包
- payload 懒读

验收：

- 同一 `typeId` 重复注册失败
- unknown `typeId` 查询行为明确
- registry 持有编译产物而不是裸 shape

## Phase 4: Frame Codec

目标：

- 实现默认 frame 格式
- 支持 frame 级编码与解码

默认格式：

```text
[typeId:u32][payloadLength:u32][payload]
```

产物：

- frame encoder
- frame decoder
- 长度边界检查

不做：

- 增量缓冲
- payload 字段级惰性读取

验收：

- 单包 encode/decode 对称
- `payloadLength` 超限时失败
- 空 payload 行为明确

## Phase 5: Incremental Stream Buffer

目标：

- 支持分片推入
- 支持半包等待
- 支持粘包拆分
- 支持已消费字节裁剪

产物：

- stream buffer
- frame splitter
- need-more-data 结果模型

不做：

- payload 懒解析

验收：

- 单 frame 被拆成多片时可恢复
- 多个 frame 粘连时可连续切出
- 已消费前缀可裁剪

## Phase 6: Payload Reader And Lazy Access

目标：

- 实现 payload 惰性读取对象
- 实现值缓存和偏移缓存
- 明确字段访问 API

产物：

- lazy reader
- `get()` / `read()` 风格访问接口
- offset cache

不做：

- `array`
- `enum`
- `variant`

验收：

- 对象初始化不解码普通字段
- 首次访问后值可缓存
- 访问后部字段时偏移缓存可复用

## Phase 7: Writer Mirror

目标：

- 实现 shape 驱动 payload 编码
- 与 reader 共享编译产物
- 完成 frame + payload 写入镜像

产物：

- payload writer
- frame writer 整合

验收：

- 任意 Core shape 满足 encode -> decode 对称
- 嵌套 shape 写入顺序与读取顺序一致

## Phase 8: `f64`

目标：

- 引入 `f64`
- 明确 `NaN` / `Infinity` / `-0` 规则

验收：

- 正常双精度数值可往返
- 特殊值策略已写入 spec 和测试

## Phase 9: `array<T>`

目标：

- 引入同构变长数组
- 明确 `count:u32 + items...` 布局

产物：

- array shape node
- array reader / writer
- `maxArrayLength` 约束

验收：

- 空数组、单元素、多元素可往返
- 过长数组会失败
- 数组后的后续字段仍能正确读取

## Phase 10: `enum`

目标：

- 引入命名整数枚举
- 明确底层存储宽度与注册校验

验收：

- enum 值映射唯一
- 未定义值行为明确

## Phase 11: `variant` Review And Implementation

前置条件：

- 单独评审通过

目标：

- 定义 `tag + payload` 结构
- 冻结 tag 类型和分支约束

验收：

- 分支路由正确
- 非法 tag 失败
- lazy reader 与 variant 共存行为明确

## Phase 12: Hardening

目标：

- 完善错误码
- 压实边界测试
- 补 benchmark
- 补 Browser / Node 一致性验证

验收：

- 关键路径都有负例测试
- 基准测试可重复运行
- 两端环境行为一致

## 里程碑建议

建议先以三个里程碑管理：

### Milestone A

- Phase 0 - 4

结果：

- 可以定义 shape、注册 shape、编码/解码完整 frame

### Milestone B

- Phase 5 - 7

结果：

- 可以做流式切包和 payload 惰性读取

### Milestone C

- Phase 8 - 12

结果：

- 可以引入扩展类型并把实现打磨到可发布状态

## World Phases

除了协议能力阶段，FluxBin 还需要一条包世界迁移路线。

状态说明：

- `completed`：仓库中已经落地
- `partial`：部分落地，但还有结构收尾
- `in-progress`：方向明确，但还未收口

下面这些 World Phases 应视为迁移记录，不全是“未来才会做”的事项。

### W1: `packages/core` Migration [`completed`]

目标：

- 把历史 root `src/*` 和 `test/*` 迁到 `packages/core`
- root 只保留 workspace orchestration

验收：

- `packages/core` 单独可 build / test / typecheck
- root workspace 聚合命令可运行

### W2: `packages/client` Skeleton [`completed`]

目标：

- 建立 `client` 包骨架
- 冻结 `client -> core -> transport` 依赖方向

验收：

- `client` API draft 落文档
- `client` 不重实现 shape / registry / frame

### W3: First Transport Adapter [`completed`]

目标：

- 实现第一个 transport 包，优先 `transport-websocket`

验收：

- transport 可以发送和接收 framed bytes
- transport 不污染 `core`

### W4: Devtools And Bench [`partial`]

目标：

- 建立 `devtools` / `bench` 世界边界

验收：

- `devtools` 已独立落包
- benchmark 当前仍在 root `bench/`
- 是否迁到 `packages/bench` 仍待单独决定

### W5: `env-*` Boundary Layer [`partial`]

目标：

- 引入唯一边界层：
  - `env-browser`
  - `env-node`
  - `env-cloudflare`
  - `env-bun`

验收：

- `env-browser` / `env-node` 已落地
- `transport-*` 不再直接碰环境原生 API
- `env-cloudflare` / `env-bun` 仍是 future candidate

### W6: Final Hardening [`in-progress`]

目标：

- 尽量减少 `?. / ?? / ?`
- 单文件覆盖率 >= 80%
- 文档、代码、world 边界完全一致
