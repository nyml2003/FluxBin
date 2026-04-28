/**
 * fixture 生成工具。
 *
 * 这个文件负责根据 descriptor + payload 生成一组可复用夹具：
 * payload bytes、frame bytes，以及 inspect 结果。它属于工具层，用来辅助测试和示例。
 */
import { encodeFrame, encodePayload, type Registry, type TypedRootNode } from "@fluxbin/core";
import { inspectFrame } from "../inspect/frame-inspector.js";

type FixtureDescriptor<TPayload> = {
  name?: string;
  payload: TPayload;
  shape: TypedRootNode;
  typeId: number;
};

export function createFixture<TPayload>(
  descriptor: FixtureDescriptor<TPayload>,
  registry: Registry
) {
  const existing = registry.get(descriptor.typeId);
  if (existing === undefined) {
    const meta = descriptor.name === undefined ? undefined : { name: descriptor.name };
    registry.register(descriptor.typeId, descriptor.shape, meta);
  }

  const registered = registry.get(descriptor.typeId);
  if (registered === undefined) {
    throw new Error("无法为 fixture 注册 descriptor。");
  }

  const payloadBytes = encodePayload(registered.compiledNode, descriptor.payload, registry.options);
  if (!payloadBytes.ok) {
    throw new Error("fixture payload 编码失败。");
  }

  const frameBytes = encodeFrame(descriptor.typeId, payloadBytes.value, registry.options);
  if (!frameBytes.ok) {
    throw new Error("fixture frame 编码失败。");
  }

  const inspected = inspectFrame(frameBytes.value, registry);
  return {
    frameBytes: frameBytes.value,
    inspected,
    payloadBytes: payloadBytes.value
  };
}
