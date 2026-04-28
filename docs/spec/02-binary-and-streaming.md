# 02. Binary And Streaming

本节定义 FluxBin 的字节布局、frame、流式推进和惰性读取边界。

## 1. 字节布局规则

- 整体为紧凑连续字节流
- 不做内存对齐
- 不插入 padding
- 不插入空白填充
- 字段顺序严格遵循 `shape` 书写顺序

嵌套 `shape` 的字节体直接拼接到父结构末尾，不允许插入：

- 子结构长度头
- 子结构 ID
- 分隔符
- 字段名

## 2. 端序

FluxBin 单个编解码体系内只允许一种全局端序：

- `little-endian`
- `big-endian`

约束：

- 端序属于 codec / registry 级配置
- 同一连接、同一注册表、同一流内不得混用
- 读写两端必须一致

推荐默认值：

- `little-endian`

## 3. 默认 frame envelope

裸 payload 不自描述，因此默认要求外层 envelope：

```text
[magic:4 bytes]
[version:u8]
[payloadKind:u8]
[flags:u16]
[typeIdOrRawType:u32]
[payloadLength:u32]
[payloadChecksum:u32]
[headerChecksum:u32]
[payload:bytes]
```

说明：

- `magic` 是固定同步头，当前实现为 `FLXB`
- `version` 是 envelope 版本号，当前实现为 `1`
- `payloadKind` 决定当前 frame 是 `typed` 还是 `raw`
- `flags` 当前保留，现阶段要求为 `0`
- `typeIdOrRawType`：
  - `typed` 模式下表示 `typeId`
  - `raw` 模式下表示 `rawType`
- `flags` 当前还承担一个最小语义：
  - `0` 表示普通 payload
  - `RAW_ARRAY` 表示顶层 raw scalar-array
- `payloadLength` 决定 payload 边界
- `payloadChecksum` 用于检测 payload 损坏
- `headerChecksum` 用于检测头部损坏
- `payload` 内部不再携带结构信息

### 3.1 `typed` 模式

- 走 `typeId + shape + payload`
- 由 registry 路由和解释

### 3.2 `raw` 模式

- 走 `rawType + payload`
- 不使用 registry
- 允许：
  - 顶层单个原始值
  - 顶层原始值数组

raw scalar-array 当前布局：

```text
[count:u32][items...]
```

## 4. 流式推进规则

FluxBin 面向增量输入：

- 分片可以连续推入内部缓冲区
- 解析器应在可能时立即切出完整 frame
- 不等待“完整大包集合”或流结束

主流程以全局消费偏移推进：

- 已消费字节可被裁剪释放
- 不允许依赖全局回滚
- 半包时停止当前轮次并等待新分片
- 发现坏帧后允许通过 `magic` 重新扫描同步点

当前实现已经提供显式 stream buffer API，至少支持：

- `append`
- `readFrame(strict)`
- `readFrame(resync)`
- `readAvailableFrames`
- `discard`
- `clear`

## 4.1 append-friendly log format

当前实现同时确定了一条最小 file/log 语义：

- 一个 log record 就是一整个 frame envelope
- 多条 record 直接顺序拼接
- 不额外包一层 log header
- 追加写入时直接 append 新 frame bytes

这让同一套 envelope 可以同时服务：

- websocket transport
- 字节流切包
- 文件日志回放

## 5. 半包与错误

必须严格区分：

- 正常等待更多数据
- 协议错误

半包属于前者，不属于后者。

典型“等待更多数据”场景：

- 头部不足完整 envelope
- `payloadLength` 已知但 payload 未收齐

典型“协议错误”场景：

- `magic` 不匹配
- `version` 不支持
- `flags` 非法
- `payloadLength` 超限
- `headerChecksum` 不匹配
- `payloadChecksum` 不匹配
- 未知 `typeId`
- 读取越界
- `bool` 非 `0/1`
- 非法 UTF-8

## 6. 重新同步

FluxBin 当前已经提供显式 resync 能力，用于文件 / 流式 / 持久化场景：

- 先扫描下一个 `magic`
- 尝试按完整 envelope 解码
- 若 checksum / version / flags 不合法，则继续向后扫描
- 若只看到部分 `magic` 前缀，则返回“等待更多数据”

这意味着：

- WebSocket 这类天然分帧传输通常只需要严格 `decodeFrame`
- 文件和字节流场景可以使用 resync API 从坏帧后继续恢复

当前实现还提供了显式 log replay 能力，至少支持：

- chunk append
- 连续 replay 完整记录
- 跳过坏帧后继续恢复
- 返回 `truncatedTailBytes`
- 返回 replay entry 的 `absoluteOffset`

## 7. 惰性读取边界

FluxBin 允许 payload 字段按需读取，但不是所有内容都能延后。

允许立即读取：

- `typeId` 或 `rawType`
- `payloadLength`
- frame 完整性
- payload 切片边界

允许延后读取：

- payload 内普通字段
- 嵌套 shape 内容
- 变长字段内容

换句话说：

- frame envelope 层必须急读
- payload 层可以懒读
## 8. 惰性读取的临时偏移

惰性读取可以使用局部临时偏移，但必须满足：

- 不修改主流式消费指针
- 使用后立刻恢复
- 局部跳读对外部流状态不可见

这是“流式切包”和“字段级懒读”能同时成立的关键约束。

## 9. 惰性对象的内存生命周期

惰性对象只能绑定到已经完整定界的 payload 切片。

必须满足：

- 对象存活期间，其底层字节仍然有效
- 不得在对象未完成字段访问前复用那段内存
- 若主缓冲区要裁剪，必须先转移该 payload 对应字节

因此实现层通常有两种策略：

1. frame 切出后复制到稳定缓冲
2. frame 切出后保留原缓冲引用直到对象释放

这是实现策略，不是协议差异。
