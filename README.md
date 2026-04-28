# FluxBin

FluxBin 是一个面向 Browser / Node 的极简二进制协议设计方案。

完整方案已从单文件改为渐进式披露文档，入口在：

- [Spec Overview](./docs/spec/00-overview.md)

建议阅读顺序：

1. [Core Model](./docs/spec/01-core-model.md)
2. [Binary And Streaming](./docs/spec/02-binary-and-streaming.md)
3. [Type Extensions Review](./docs/spec/03-type-extensions-review.md)
4. [Shape Registry](./docs/spec/04-shape-registry.md)
5. [Versioning And Limits](./docs/spec/05-versioning-and-limits.md)

当前文档组织目标：

- 先讲稳定核心
- 再讲类型扩展
- 最后展开注册表、演进和安全边界
