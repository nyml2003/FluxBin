import { describe, expect, it } from "vitest";
import { decodeFrame } from "../../src/frame/decode-frame.js";
import { encodeFrame } from "../../src/frame/encode-frame.js";
import { decodePayload } from "../../src/reader/decode-payload.js";
import { createRegistry } from "../../src/registry/create-registry.js";
import { encodePayload } from "../../src/writer/encode-payload.js";

describe("frame + registry integration", () => {
  it("roundtrips payload bytes through a registered shape", () => {
    const registry = createRegistry();
    const registered = registry.register(42, {
      id: "u32",
      name: "utf8-string"
    });

    expect(registered.ok).toBe(true);
    if (!registered.ok) {
      return;
    }

    const payload = encodePayload(registered.value.compiledNode, { id: 9, name: "flux" }, registry.options);
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

    expect(decodedFrame.value.frame.payloadKind).toBe("typed");
    const entry = registry.get(decodedFrame.value.frame.typeTag);
    expect(entry).toBeDefined();
    if (!entry) {
      return;
    }

    const decodedPayload = decodePayload(entry.compiledNode, decodedFrame.value.frame.payload, registry.options);
    expect(decodedPayload.ok).toBe(true);
    if (!decodedPayload.ok) {
      return;
    }

    expect(decodedPayload.value.value).toEqual({ id: 9, name: "flux" });
  });

  it("enforces registry string limits during payload encode and decode", () => {
    const registry = createRegistry({
      limits: {
        maxStringBytes: 1
      }
    });
    const registered = registry.register(43, {
      name: "utf8-string"
    });

    expect(registered.ok).toBe(true);
    if (!registered.ok) {
      return;
    }

    const encoded = encodePayload(registered.value.compiledNode, { name: "ab" }, registry.options);
    expect(encoded.ok).toBe(false);

    const shortEncoded = encodePayload(registered.value.compiledNode, { name: "a" }, registry.options);
    expect(shortEncoded.ok).toBe(true);
    if (!shortEncoded.ok) {
      return;
    }

    const tampered = new Uint8Array(shortEncoded.value);
    tampered[0] = 2;

    const decoded = decodePayload(registered.value.compiledNode, tampered, registry.options);
    expect(decoded.ok).toBe(false);
  });

  it("roundtrips a typed object-array root through registry", () => {
    const registry = createRegistry();
    const registered = registry.register(44, {
      objectArray: {
        id: "u32",
        name: "utf8-string"
      }
    });

    expect(registered.ok).toBe(true);
    if (!registered.ok) {
      return;
    }

    const payload = encodePayload(
      registered.value.compiledNode,
      [
        { id: 1, name: "a" },
        { id: 2, name: "上海" }
      ],
      registry.options
    );
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

    const decodedPayload = decodePayload(registered.value.compiledNode, decodedFrame.value.frame.payload, registry.options);
    expect(decodedPayload.ok).toBe(true);
    if (!decodedPayload.ok) {
      return;
    }

    expect(decodedPayload.value.value).toEqual([
      { id: 1, name: "a" },
      { id: 2, name: "上海" }
    ]);
  });
});
