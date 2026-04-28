/**
 * WebSocket transport 包入口。
 *
 * 这个包导出第一个具体 transport adapter。
 * 它只关心连接与 frame 搬运，不定义 client 会话语义。
 */
export * from "./types.js";
export * from "./websocket-transport.js";
