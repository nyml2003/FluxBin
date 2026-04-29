# 工程与工具链规范

## 目标

这份文档定义 FluxBin 的工程组织和工具链选择。

目标不是把工具堆满，而是把每个工具的职责切清楚：

- 谁负责类型检查
- 谁负责库构建
- 谁负责示例开发
- 谁负责测试
- 谁负责脚本执行
- 谁负责代码纪律

如果这些职责不切清楚，后面很容易出现：

- 构建器和测试器重叠
- `tsx` 被滥用成构建器
- 示例工程反向污染主包结构

## 工具链结论

当前建议采用：

- `TypeScript`
- `pnpm workspace`
- `tsc`
- `tsup` 或 `esbuild`
- `vitest`
- `eslint`
- `tsx`

如果后面确实需要浏览器 demo，再补 `vite`。

## 总体原则

1. 全仓库统一用 TypeScript。
2. `tsc` 只负责类型检查，不负责主构建。
3. `tsup` 或 `esbuild` 负责库构建。
4. `vitest` 负责测试。
5. `tsx` 只负责运行脚本，不负责正式打包。
6. `eslint` 负责边界纪律和实现规范。
7. demo 工具不能反向决定主库结构。

## 包管理与目录

### 选择

使用 `pnpm workspace`。

原因：

- monorepo 支持稳定
- 适合多包共享依赖
- 安装和链接速度好
- 对 `src` / `test` / `bench` / `docs` 的边界清楚

### 目录建议

当前仓库实际目录是：

```text
docs/
  spec/
  engineering/
  world/
packages/
  core/
    src/
    test/
  client/
    src/
    test/
  transport-websocket/
    src/
    test/
  devtools/
    src/
    test/
  env-browser/
    src/
    test/
  env-node/
    src/
    test/
bench/
  index.ts
examples/
scripts/
```

说明：

- `packages/core` 放协议运行时代码
- `packages/client` 放端到端 SDK
- `packages/transport-websocket` 是当前唯一已落地的 transport adapter
- `packages/devtools` 放调试与开发体验工具
- `bench/` 当前仍在 root
- `scripts/` 放代码生成、检查、文档验证脚本

future candidates:

- `packages/transport-fetch`
- `packages/bench`

当前仓库已经进入 `packages/*` 结构，root 负责 workspace orchestration，运行时代码以包为单位承载。

## TypeScript

### 原则

全仓库统一使用 TS。

适用范围：

- `packages/*/src/*`
- `packages/*/test/*`
- `bench/*.ts`
- `scripts/*`

### 配置原则

要求：

- `strict: true`
- `exactOptionalPropertyTypes: true`
- `noUncheckedIndexedAccess: true`
- `useUnknownInCatchVariables: true`

说明：

- `exactOptionalPropertyTypes` 对协议结构约束有价值
- `noUncheckedIndexedAccess` 对偏移和数组访问更安全

### `tsc` 职责

`tsc` 只负责：

- 类型检查
- 类型声明输出

不负责：

- 主 JS 构建
- 测试执行

## 库构建

### 职责

`tsup` 或 `esbuild` 负责库构建。

原因：

- 构建快
- 适合纯 TS 库产出
- 不需要把浏览器 dev server 语义带进主构建

### 不负责

- 不负责类型检查
- 不负责测试
- 不负责规范定义

## Vitest

### 职责

`vitest` 负责：

- 单元测试
- 集成测试
- Browser / Node 环境一致性测试

### 运行环境

建议：

- 默认 `node`
- 浏览器一致性测试按需启用 browser mode 或单独环境配置

原因：

- 大部分核心逻辑不应依赖 DOM
- FluxBin 是协议内核，不应默认绑定浏览器宿主语义

## ESLint

### 职责

`eslint` 负责：

- 代码风格底线
- 架构边界纪律
- 禁止写法检查

### 应重点检查

- 禁止 `any`
- 禁止未使用变量
- 禁止属性魔法解析
- 禁止跨层直接引用内部实现
- 禁止 `throw` 充当可预期失败控制流

### 原则

lint 不只是格式工具。

这里更重要的是做“边界保护器”。

## tsx

### 职责

`tsx` 只用于运行脚本。

适用范围：

- `scripts/*.ts`
- `bench/*.ts`
- 文档验证脚本

### 不允许

不把 `tsx` 当成：

- 正式构建器
- 库发布流程主入口
- 长期运行时依赖

## 命令建议

建议统一命令面：

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm lint`
- `pnpm bench`

语义：

- `typecheck` -> `tsc --noEmit`
- `build` -> 库构建
- `test` -> `vitest run`
- `lint` -> `eslint`
- `bench` -> benchmark 入口

如果后面加 demo，再补：

- `pnpm dev`

## 不要做的事

下面这些直接禁止：

1. 用示例 dev server 作为主库构建器
2. 用 `tsx` 代替正式构建流程
3. 让 demo 或 example 反向决定 `packages/*` 结构
4. 混用多套测试框架
5. 在 `packages/core` 里引入 transport 或宿主平台专属依赖

## 实施顺序

建议按这个顺序落地：

1. `pnpm workspace`
2. TypeScript 基础配置
3. `eslint`
4. `vitest`
5. 库构建器
6. `tsx` 脚本入口
7. benchmark

原因：

- 先把类型和边界立起来
- 再补测试
- 最后补构建和开发体验层

## 验证清单

工具链落地后至少确认：

1. `tsc` 可以独立跑完整类型检查
2. 构建器可以独立产出库包
3. `vitest` 可以在 `node` 环境跑 core 测试
4. Browser / Node 一致性测试可执行
5. `tsx` 只出现在脚本入口，不出现在正式构建链路

## 边界层补充

在最终 world 模型里：

- `packages/core`
- `packages/client`
- `packages/transport-*`
- `packages/devtools`

都属于非边界层。

只有：

- `packages/env-*`

属于边界层。

因此工具链和目录组织也应服从这条规则：

- transport 包不直接碰原生环境 API
- 原生 API 适配集中进 `env-*`
