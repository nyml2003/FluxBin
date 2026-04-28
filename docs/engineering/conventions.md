# FluxBin Engineering Conventions

工程规范已拆分到独立文档：

- [代码规范](./code-style-spec.md)
- [风格 DNA](./style-dna.md)
- [工程与工具链规范](./engineering-toolchain-spec.md)

这份文件保留为兼容入口，避免旧链接失效。

当前最重要的工程约束有五条：

1. `shape` 是唯一结构来源，禁止平行维护协议接口。
2. 可预期失败统一走 `Result<T, E>`，不用 `throw` 做常规控制流。
3. 流式层必须显式表达 `need-more-data`，不能把半包当异常。
4. 惰性读取只能通过显式 API 触发，禁止属性魔法。
5. reader / writer / registry / stream 边界必须保持分离。
