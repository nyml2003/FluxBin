/**
 * frame checksum 工具。
 *
 * 这里使用稳定的 32-bit FNV-1a 作为当前 envelope 的完整性校验函数。
 * 它不是加密摘要，但足够承担当前协议层的损坏检测职责。
 */
export function computeFrameChecksum(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}
