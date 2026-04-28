/**
 * payload pretty-print 工具。
 *
 * 这个文件把对象 payload 格式化成更适合开发时阅读的字符串。
 * 它不承担协议编码职责，只负责展示。
 */
export function formatPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}
