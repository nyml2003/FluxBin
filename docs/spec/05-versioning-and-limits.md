# 05. Versioning And Limits

本节定义协议演进、错误模型和安全上限。

## 1. 版本演进原则

FluxBin 不追求“同一 shape 内的宽松兼容”。

如果已经成立以下前提：

- payload 不自描述
- 不允许动态可选字段
- 不自动忽略多余字段
- 字段顺序固定

那么最稳的演进方式就是：

- breaking change 直接分配新 `typeId`

### 1.1 什么算 breaking change

以下变化都应视为 breaking change：

- 修改字段顺序
- 修改字段类型
- 增加字段
- 删除字段
- 修改字段语义
- 修改 `enum` 值映射
- 修改 `variant` tag 分配

结论：

- 一个 `typeId` 对应一个稳定 ABI

补充：

- 外层 frame envelope 也有独立 `version`
- envelope 级 breaking change 不应偷偷复用旧 version
- `typed` 模式的结构演进由 `typeId` 承载
- `raw` 模式不使用 `typeId`
- 新增基础原始类型时，应显式评估是否同时进入 `raw` 顶层支持面

## 2. 错误模型

至少区分三种状态：

1. 成功
2. 等待更多数据
3. 协议错误

不要把“半包”混进“异常”。

### 2.1 成功

- 成功切出一个完整 frame
- 成功路由到 shape
- 成功完成编码或构造惰性对象

### 2.2 等待更多数据

适用于：

- 头部不足
- payload 未收齐
- 当前轮次还不能安全推进

### 2.3 协议错误

适用于：

- 未知 `typeId`
- 非法 `magic`
- 不支持的 `version`
- 非法 `flags`
- `headerChecksum` 不匹配
- `payloadChecksum` 不匹配
- 长度头超限
- 非法 UTF-8
- `bool` 非法值
- `enum` 值越界或未定义
- `variant` tag 未注册
- 解析中越界

建议实现层定义稳定错误码。

## 2.4 当前 envelope 版本策略

当前实现采用：

- 固定 `magic`
- 固定 `version = 1`
- `payloadChecksum`
- `headerChecksum`
- 显式 resync

因此未来如果要调整 envelope 字段布局，应优先：

1. 先升级 `version`
2. 再实现双版本解码或迁移策略
3. 不要在同一 version 下静默修改头部布局

## 3. 安全上限

必须提供上限控制，至少包括：

- `maxFrameBytes`
- `maxPayloadBytes`
- `maxStringBytes`
- `maxArrayLength`
- `maxDepth`
- `maxBufferedBytes`

这些上限不应散落在业务代码中，应成为 Registry 或 codec 配置的一部分。

## 4. 推荐策略

建议策略：

- 任一长度头一旦超过上限，立即判为协议错误
- 累计缓冲超过上限仍未形成合法 frame，立即拒绝
- 递归深度超过上限时，注册失败
- 数组元素数超过上限时，解码失败

## 5. Core 与扩展的冻结顺序

建议分阶段冻结：

### 阶段一

- Core 标量
- nested shape
- frame
- stream
- registry

### 阶段二

- `f64`
- `array<T>`

### 阶段三

- `enum`
- `tuple`

### 阶段四

- `variant`

原因：

- 先冻结不会反复震荡的底层边界
- 再引入高价值但实现面可控的扩展
- 最后处理会重塑结构系统的能力
