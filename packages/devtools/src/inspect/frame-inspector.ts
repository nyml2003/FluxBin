/**
 * frame inspect 工具。
 *
 * 这个文件负责把原始 frame bytes 转成更易读的结构信息。
 * 它依赖 core 的 frame/registry/payload 解码能力，但不定义协议规则。
 */
import {
  decodeFrame,
  decodePayload,
  decodeRawValue,
  getRawTypeFromCode,
  type Registry
} from "@fluxbin/core";
import type { InspectedFrame } from "../types.js";

export function inspectFrame(frameBytes: Uint8Array, registry: Registry): InspectedFrame {
  const decodedFrame = decodeFrame(frameBytes, registry.options);
  if (!decodedFrame.ok) {
    return {
      payloadKind: "invalid",
      payloadByteLength: frameBytes.byteLength,
      typeTag: -1
    };
  }

  if (decodedFrame.value.frame.payloadKind === "raw") {
    const rawType = getRawTypeFromCode(decodedFrame.value.frame.typeTag);
    const inspectedRaw: InspectedFrame = {
      flags: decodedFrame.value.frame.flags,
      headerChecksum: decodedFrame.value.frame.headerChecksum,
      payloadKind: "raw",
      payloadByteLength: decodedFrame.value.frame.payloadLength,
      payloadChecksum: decodedFrame.value.frame.payloadChecksum,
      protocolVersion: decodedFrame.value.frame.version,
      typeTag: decodedFrame.value.frame.typeTag
    };

    if (rawType !== undefined) {
      inspectedRaw.rawType = rawType;
      const rawValue = decodeRawValue(rawType, decodedFrame.value.frame.payload, registry.options);
      if (rawValue.ok) {
        inspectedRaw.rawValue = rawValue.value;
      }
    }

    return inspectedRaw;
  }

  const registered = registry.get(decodedFrame.value.frame.typeTag);
  if (registered === undefined) {
    return {
      flags: decodedFrame.value.frame.flags,
      headerChecksum: decodedFrame.value.frame.headerChecksum,
      payloadKind: "typed",
      payloadByteLength: decodedFrame.value.frame.payloadLength,
      payloadChecksum: decodedFrame.value.frame.payloadChecksum,
      protocolVersion: decodedFrame.value.frame.version,
      typeTag: decodedFrame.value.frame.typeTag
    };
  }

  const decodedPayload = decodePayload(
    registered.compiledNode,
    decodedFrame.value.frame.payload,
    registry.options
  );

  const inspected: InspectedFrame = {
    payloadKind: "typed",
    payloadByteLength: decodedFrame.value.frame.payloadLength,
    payloadChecksum: decodedFrame.value.frame.payloadChecksum,
    protocolVersion: decodedFrame.value.frame.version,
    registeredTypeId: registered.typeId,
    flags: decodedFrame.value.frame.flags,
    headerChecksum: decodedFrame.value.frame.headerChecksum,
    typeTag: decodedFrame.value.frame.typeTag
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
