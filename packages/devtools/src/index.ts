/**
 * Devtools 包入口。
 *
 * 这个包提供开发辅助工具：frame inspect、payload pretty-print、fixture 生成。
 * 它依赖 `@fluxbin/core`，但不承载运行时协议实现。
 */
export * from "./fixtures/create-fixture.js";
export * from "./inspect/frame-inspector.js";
export * from "./pretty/format-payload.js";
export * from "./types.js";
