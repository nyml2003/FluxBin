/**
 * env-node 包入口。
 *
 * 这个包是 Node 边界层，负责原生环境 API 和 loopback IO 模拟的注入适配。
 */
export * from "./loopback-websocket-boundary.js";
export * from "./node-websocket-factory.js";
export * from "./types.js";
