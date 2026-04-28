import { describe, expect, it } from "vitest";
import { createRegistry } from "@fluxbin/core";
import { createFixture, formatPayload, inspectFrame } from "../src/index.js";

describe("devtools", () => {
  it("formats payloads for reading", () => {
    const formatted = formatPayload({ city: "上海", id: 1 });
    expect(formatted).toContain('"city": "上海"');
  });

  it("creates fixtures and inspects frames", () => {
    const registry = createRegistry();
    const fixture = createFixture(
      {
        name: "city.v1",
        payload: {
          city: "上海"
        },
        shape: {
          city: "utf8-string"
        },
        typeId: 5
      },
      registry
    );

    expect(fixture.payloadBytes.byteLength).toBeGreaterThan(0);
    expect(fixture.frameBytes.byteLength).toBeGreaterThan(fixture.payloadBytes.byteLength);

    const inspected = inspectFrame(fixture.frameBytes, registry);
    expect(inspected.registeredName).toBe("city.v1");
    expect(inspected.decodedPayload).toEqual({ city: "上海" });
  });

  it("handles invalid and unregistered frames", () => {
    const registry = createRegistry();

    const invalid = inspectFrame(new Uint8Array([1, 2, 3]), registry);
    expect(invalid.typeId).toBe(-1);

    const unregistered = inspectFrame(
      new Uint8Array([9, 0, 0, 0, 0, 0, 0, 0]),
      registry
    );
    expect(unregistered.typeId).toBe(9);
    expect(unregistered.registeredName).toBeUndefined();
  });

  it("throws when fixture payload or frame cannot be encoded", () => {
    const registry = createRegistry();

    expect(() =>
      createFixture(
        {
          payload: {
            ok: "bad" as unknown as boolean
          },
          shape: {
            ok: "bool"
          },
          typeId: 6
        },
        registry
      )
    ).toThrow("payload 编码失败");

    expect(() =>
      createFixture(
        {
          payload: {
            value: 1
          },
          shape: {
            value: "u32"
          },
          typeId: 7
        },
        createRegistry({
          limits: {
            maxFrameBytes: 8,
            maxPayloadBytes: 4
          }
        })
      )
    ).toThrow("frame 编码失败");
  });
});
