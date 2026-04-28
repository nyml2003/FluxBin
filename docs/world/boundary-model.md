# Boundary Model

## 1. 核心结论

FluxBin 的最终边界模型应当是：

- `core`
- `client`
- `transport-*`
- `devtools`

全部属于**非边界层**。

只有：

- `env-browser`
- `env-node`
- `env-cloudflare`
- `env-bun`

这类 `env-*` 包属于**唯一边界层**。

## 2. 非边界层原则

非边界层必须满足：

- 强类型
- 固定数据 Shape
- 零环境耦合
- 不触碰任何平台原生 API
- 只依赖统一抽象接口与协议内核规则

这意味着：

- `client` 不是边界层
- `transport-*` 也不是边界层
- 即使 transport 在“搬运字节”，它也不应直接接触浏览器 / Node 原生对象

## 3. 边界层原则

只有 `env-*` 包可以：

- 接触浏览器原生 API
- 接触 Node 原生 API
- 接触 Cloudflare / Bun 运行时差异
- 承担环境特殊类型与 IO 适配

它们的职责是把运行时差异收敛掉，而不是把差异扩散到协议包里。

## 4. 依赖方向

```text
core <- client <- transport-* <- env-*
                  devtools ----^
```

更具体地说：

- `core` 定协议内核
- `client` 定会话语义
- `transport-*` 定传输抽象与 frame 过程
- `env-*` 才负责原生 IO 接入

## 5. 为什么要这样分

原因不是形式漂亮，而是为了同时解决 3 个问题：

1. 杜绝 M*N 组合爆炸
2. 避免跨环境类型污染
3. 保证内核长期纯净稳定

如果 transport 也直接碰平台 API，就会出现：

- `transport-websocket-browser`
- `transport-websocket-node`
- `transport-fetch-browser`
- `transport-fetch-cloudflare`

这种扩散最后一定失控。

## 6. 业务组合方式

业务侧应该按需组合：

- 非边界传输协议包
- 对应边界环境包

例如：

```text
client + transport-websocket + env-browser
client + transport-websocket + env-node
client + transport-fetch + env-cloudflare
```

这样做的意义是：

- 协议包本身不分裂
- 环境适配只在 `env-*` 收敛

## 7. 一句话定义

“非边界层只定义协议与抽象，边界层才接触真实环境。”
