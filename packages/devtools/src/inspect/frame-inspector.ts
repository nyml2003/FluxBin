/**
 * frame inspect 工具。
 *
 * 这个文件负责把原始 frame bytes 转成更易读的结构信息。
 * 它依赖 core 的 frame/registry/payload 解码能力，但不定义协议规则。
 */
import { decodeFrame, decodePayload, type Registry } from "@fluxbin/core";
import type { InspectedFrame } from "../types.js";

export function inspectFrame(frameBytes: Uint8Array, registry: Registry): InspectedFrame {
  const decodedFrame = decodeFrame(frameBytes, registry.options);
  if (!decodedFrame.ok) {
    return {
      payloadByteLength: frameBytes.byteLength,
      typeId: -1
    };
  }

  const registered = registry.get(decodedFrame.value.frame.typeId);
  if (registered === undefined) {
    return {
      payloadByteLength: decodedFrame.value.frame.payloadLength,
      typeId: decodedFrame.value.frame.typeId
    };
  }

  const decodedPayload = decodePayload(
    registered.compiledShape,
    decodedFrame.value.frame.payload,
    registry.options
  );

  const inspected: InspectedFrame = {
    payloadByteLength: decodedFrame.value.frame.payloadLength,
    registeredTypeId: registered.typeId,
    typeId: decodedFrame.value.frame.typeId
  };

  const meta = registered.meta;
  if (meta !== undefined && meta.name !== undefined) {
    inspected.registeredName = meta.name;
  }

  if (decodedPayload.ok) {
    inspected.decodedPayload = decodedPayload.value.value;
  }

  return inspected;
}
