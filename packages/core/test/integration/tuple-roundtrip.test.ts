import { describe, expect, it } from "vitest";
import { decodeFrame } from "../../src/frame/decode-frame.js";
import { encodeFrame } from "../../src/frame/encode-frame.js";
import { decodePayload } from "../../src/reader/decode-payload.js";
import { createRegistry } from "../../src/registry/create-registry.js";
import { encodePayload } from "../../src/writer/encode-payload.js";

describe("tuple roundtrip", () => {
  it("roundtrips a typed tuple root through registry and frame", () => {
    const registry = createRegistry();
    const registered = registry.register(2001, {
      tuple: ["u32", "utf8-string", { active: "bool" }]
    });

    expect(registered.ok).toBe(true);
    if (!registered.ok) {
      return;
    }

    const payload = encodePayload(registered.value.compiledNode, [7, "flux", { active: true }], registry.options);
    expect(payload.ok).toBe(true);
    if (!payload.ok) {
      return;
    }

    const frame = encodeFrame(registered.value.typeId, payload.value, registry.options);
    expect(frame.ok).toBe(true);
    if (!frame.ok) {
      return;
    }

    const decodedFrame = decodeFrame(frame.value, registry.options);
    expect(decodedFrame.ok).toBe(true);
    if (!decodedFrame.ok) {
      return;
    }

    const decodedPayload = decodePayload(
      registered.value.compiledNode,
      decodedFrame.value.frame.payload,
      registry.options
    );
    expect(decodedPayload.ok).toBe(true);
    if (!decodedPayload.ok) {
      return;
    }

    expect(decodedPayload.value.value).toEqual([7, "flux", { active: true }]);
  });
});
