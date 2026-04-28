import { describe, expect, it } from "vitest";
import { decodeFrame } from "../../src/frame/decode-frame.js";
import { encodeFrame } from "../../src/frame/encode-frame.js";
import { decodePayload } from "../../src/reader/decode-payload.js";
import { createRegistry } from "../../src/registry/create-registry.js";
import { encodePayload } from "../../src/writer/encode-payload.js";

describe("Milestone A roundtrip", () => {
  it("roundtrips a nested shape with multibyte strings", () => {
    const registry = createRegistry();
    const registered = registry.register(1001, {
      id: "u32",
      profile: {
        age: "u8",
        city: "utf8-string"
      }
    });

    expect(registered.ok).toBe(true);
    if (!registered.ok) {
      return;
    }

    const payload = encodePayload(
      registered.value.compiledShape,
      {
        id: 77,
        profile: {
          age: 24,
          city: "上海"
        }
      },
      registry.options
    );
    expect(payload.ok).toBe(true);
    if (!payload.ok) {
      return;
    }

    const encodedFrame = encodeFrame(registered.value.typeId, payload.value, registry.options);
    expect(encodedFrame.ok).toBe(true);
    if (!encodedFrame.ok) {
      return;
    }

    const decodedFrame = decodeFrame(encodedFrame.value, registry.options);
    expect(decodedFrame.ok).toBe(true);
    if (!decodedFrame.ok) {
      return;
    }

    const decodedPayload = decodePayload(
      registered.value.compiledShape,
      decodedFrame.value.frame.payload,
      registry.options
    );
    expect(decodedPayload.ok).toBe(true);
    if (!decodedPayload.ok) {
      return;
    }

    expect(decodedPayload.value.value).toEqual({
      id: 77,
      profile: {
        age: 24,
        city: "上海"
      }
    });
  });
});
