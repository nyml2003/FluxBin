# FluxBin Test Specification

本文档定义 FluxBin 的测试范围、测试层次和验收重点。

## 1. 测试目标

FluxBin 的测试不是只证明“能跑通”，而是要证明：

- 布局正确
- 读写镜像正确
- 流式推进正确
- 懒解析正确
- 注册治理正确
- 边界输入受控

此外还要证明：

- 可预期失败都能被 `Result` 明确表达
- 半包状态不会伪装成异常或成功

## 2. 测试层次

### 2.1 Unit

覆盖最小算法和标量行为：

- 标量读写
- UTF-8 长度头处理
- shape 编译
- registry 注册规则
- frame 长度判定
- `Result` 结构正确性

### 2.2 Integration

覆盖跨模块联动：

- frame + registry + reader
- stream + frame splitter + registry
- writer + reader 镜像

### 2.3 Environment

覆盖 Browser / Node 一致性：

- 同一输入编码结果一致
- 同一字节流解码结果一致
- 错误行为一致

### 2.4 Benchmark

覆盖性能回归观察：

- 大量小 frame
- 单个较大 payload
- 高频字段访问
- 深嵌套结构访问

benchmark 不作为功能正确性证明，但必须作为性能回归哨兵。

## 3. Core 类型测试

每个 Core 类型至少覆盖：

- 最小值
- 常规值
- 最大值
- 非法输入

### 3.1 整型

对 `u8` / `i8` / `u16` / `i16` / `u32` / `i32`：

- 编码结果字节正确
- 解码结果值正确
- 边界值不丢失

### 3.2 bool

必须覆盖：

- `0 -> false`
- `1 -> true`
- `2` 及其他值触发协议错误

### 3.3 utf8-string

必须覆盖：

- 空串
- ASCII
- 中文
- emoji / 多字节字符
- 非法 UTF-8 输入

## 4. Shape 测试

必须覆盖：

- 平面 shape
- 嵌套 shape
- 定长 shape
- 含变长字段的 shape

验证点：

- 字段顺序严格按定义输出
- 嵌套布局直接拼接
- 编译结果定长/变长判定正确

## 5. Registry 测试

必须覆盖：

- 首次注册成功
- 重复 `typeId` 注册失败
- 未注册 `typeId` 查询行为
- 不合法 shape 注册失败

并验证失败都走：

- `{ ok: false; value: null; error: ... }`

如果扩展启用，还要覆盖：

- enum 值冲突
- variant tag 冲突
- 超深嵌套拒绝注册

## 6. Frame 测试

默认 frame：

```text
[typeId:u32][payloadLength:u32][payload]
```

必须覆盖：

- 正常单 frame
- 空 payload
- `payloadLength` 与实际长度一致
- `payloadLength` 超限
- 头部不完整

并验证：

- 头部不完整返回 `Result` 失败或 `need-more-data`，而不是抛异常

## 7. Stream 测试

必须覆盖三类典型流行为。

### 7.1 半包

例如：

- 头部拆成两片
- payload 拆成多片

要求：

- 返回 need-more-data
- 不越界消费
- 新分片到达后可继续

并验证：

- `need-more-data` 的结果形状固定
- 不与协议错误混淆

### 7.2 粘包

例如：

- 两个或多个 frame 一次性推入

要求：

- 可按顺序切出多个完整 frame
- 切出顺序不乱

### 7.3 裁剪

要求：

- 已消费前缀可被释放
- 未消费尾部必须保留

## 8. Lazy Reader 测试

这是高优先级测试区。

必须覆盖：

- 初始化时不解码普通字段
- 首次访问字段时才解码
- 二次访问命中值缓存
- 后部字段访问可建立偏移缓存
- 局部临时偏移不污染主流指针

还要覆盖：

- 先访问后部字段
- 再访问前部字段
- 交错访问多个字段

确保缓存逻辑不会错乱。

对失败路径还要覆盖：

- 访问不存在字段时返回结构化错误
- 变长字段长度非法时返回结构化错误

## 9. Encode/Decode Mirror 测试

每种 shape 都应至少有一组往返测试：

- `encode(value) -> bytes -> decode(bytes)`

并验证：

- 值等价
- 布局等价
- 嵌套结构不变形

建议增加：

- `decode(bytes) -> encode(value)` 的字节回放测试

确保写回字节与原布局一致。

## 10. 上限与防御测试

必须覆盖：

- 超大 `payloadLength`
- 超大字符串长度
- 超大数组长度
- 超深嵌套
- 缓冲累计超限

要求：

- 明确报错
- 不出现死循环
- 不出现越界访问
- 不使用异常作为常规控制流

## 11. 扩展类型测试

### 11.1 `f64`

若启用，必须覆盖：

- 普通小数
- 大数
- `NaN`
- `Infinity`
- `-Infinity`
- `-0`

### 11.2 `array<T>`

若启用，必须覆盖：

- 空数组
- 单元素数组
- 多元素数组
- 数组后接其他字段

### 11.3 `enum`

若启用，必须覆盖：

- 有效值
- 未定义值
- 重复映射拒绝注册

### 11.4 `variant`

若启用，必须覆盖：

- 每个 tag 分支
- 非法 tag
- 分支 payload 错误

## 12. Browser / Node 一致性

必须至少验证：

- 同一 shape 编码结果一致
- 同一 frame 流解码结果一致
- 错误码或错误类别一致

不要默认认为 `TextEncoder` / `TextDecoder` 在所有细节上天然一致，必须用测试锁住。

## 13. 验收门槛

某阶段功能合入前，至少满足：

- 对应 unit test 全通过
- 至少一组 integration test 覆盖到该能力
- 负例测试存在
- Browser / Node 双环境通过
- 对应 `Result` 结果形状已锁定测试

对流式和懒解析能力，再额外要求：

- 半包场景有测试
- 偏移缓存行为有测试
- 回归测试覆盖已修复过的 bug
