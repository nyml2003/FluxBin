import { describe, expect, it } from "vitest";
import { createOptions } from "../../../src/limits/default-limits.js";
import { createLazyPayloadReader } from "../../../src/reader/lazy-payload.js";
import { compileShape } from "../../../src/shape/compile-shape.js";
import { encodePayload } from "../../../src/writer/encode-payload.js";

describe("lazy payload reader", () => {
  it("lazily reads object fields, nested shapes, and arrays", () => {
    const compiled = compileShape({
      active: "bool",
      ids: { scalarArray: "u32" },
      profile: {
        city: "utf8-string",
        scores: { scalarArray: "u16" }
      },
      users: {
        objectArray: {
          id: "u32",
          name: "utf8-string"
        }
      }
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const options = createOptions();
    const encoded = encodePayload(
      compiled.value,
      {
        active: true,
        ids: [1, 2, 3],
        profile: {
          city: "上海",
          scores: [7, 8]
        },
        users: [
          { id: 1, name: "a" },
          { id: 2, name: "b" }
        ]
      },
      options
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const reader = createLazyPayloadReader(compiled.value, encoded.value, options);
    expect(reader.kind).toBe("shape");
    if (reader.kind !== "shape") {
      return;
    }

    const active = reader.get("active");
    expect(active).toEqual({ ok: true, value: true, error: null });

    const profile = reader.get("profile");
    expect(profile.ok).toBe(true);
    if (!profile.ok) {
      return;
    }
    if (typeof profile.value !== "object" || profile.value === null || !("kind" in profile.value)) {
      return;
    }
    if (profile.value.kind !== "shape") {
      return;
    }

    const city = profile.value.get("city");
    expect(city).toEqual({ ok: true, value: "上海", error: null });

    const users = reader.get("users");
    expect(users.ok).toBe(true);
    if (!users.ok) {
      return;
    }
    if (typeof users.value !== "object" || users.value === null || !("length" in users.value)) {
      return;
    }

    const userCount = users.value.length();
    expect(userCount).toEqual({ ok: true, value: 2, error: null });
    const firstUser = users.value.get(0);
    expect(firstUser.ok).toBe(true);

    const materialized = reader.materialize();
    expect(materialized.ok).toBe(true);
    if (!materialized.ok) {
      return;
    }

    expect(materialized.value).toEqual({
      active: true,
      ids: [1, 2, 3],
      profile: {
        city: "上海",
        scores: [7, 8]
      },
      users: [
        { id: 1, name: "a" },
        { id: 2, name: "b" }
      ]
    });
  });

  it("lazily reads tuple roots and nested tuples", () => {
    const compiled = compileShape({
      tuple: ["u32", { tuple: ["bool", "utf8-string"] }, { objectArray: { id: "u32" } }]
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const options = createOptions();
    const encoded = encodePayload(compiled.value, [9, [true, "ok"], [{ id: 1 }, { id: 2 }]], options);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const reader = createLazyPayloadReader(compiled.value, encoded.value, options);
    expect(reader.kind).toBe("tuple");
    if (reader.kind !== "tuple") {
      return;
    }
    expect(reader.length()).toBe(3);

    const nestedTuple = reader.get(1);
    expect(nestedTuple.ok).toBe(true);
    const materialized = reader.materialize();
    expect(materialized.ok).toBe(true);
    if (!materialized.ok) {
      return;
    }

    expect(materialized.value).toEqual([9, [true, "ok"], [{ id: 1 }, { id: 2 }]]);
  });

  it("surfaces lazy access errors on malformed payloads", () => {
    const compiled = compileShape({
      profile: {
        city: "utf8-string"
      }
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const reader = createLazyPayloadReader(compiled.value, new Uint8Array([5, 0, 0, 0, 0x41]), createOptions());
    if (reader.kind !== "shape") {
      return;
    }
    const profile = reader.get("profile");
    expect(profile.ok).toBe(false);
  });

  it("reports unknown keys, out-of-bounds access, and malformed array lengths", () => {
    const objectCompiled = compileShape({
      ids: { scalarArray: "u32" }
    });
    expect(objectCompiled.ok).toBe(true);
    if (!objectCompiled.ok) {
      return;
    }

    const options = createOptions();
    const encoded = encodePayload(objectCompiled.value, { ids: [1, 2] }, options);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const objectReader = createLazyPayloadReader(objectCompiled.value, encoded.value, options);
    if (objectReader.kind !== "shape") {
      return;
    }
    const missingField = objectReader.get("missing");
    expect(missingField.ok).toBe(false);
    if (!missingField.ok) {
      expect(missingField.error.code).toBe("UNKNOWN_FIELD");
    }

    const ids = objectReader.get("ids");
    expect(ids.ok).toBe(true);
    if (!ids.ok) {
      return;
    }
    if (typeof ids.value !== "object" || ids.value === null || !("kind" in ids.value)) {
      return;
    }
    if (ids.value.kind !== "scalar-array") {
      return;
    }

    const outOfBounds = ids.value.get(9);
    expect(outOfBounds.ok).toBe(false);

    const malformedArrayReader = createLazyPayloadReader(
      objectCompiled.value,
      new Uint8Array([9, 0, 0, 0]),
      createOptions({
        limits: {
          maxArrayLength: 1
        }
      })
    );
    if (malformedArrayReader.kind !== "shape") {
      return;
    }
    const malformedIds = malformedArrayReader.get("ids");
    expect(malformedIds.ok).toBe(false);
    if (!malformedIds.ok) {
      expect(malformedIds.error.code).toBe("ARRAY_LENGTH_EXCEEDED");
    }

    const tupleCompiled = compileShape({
      tuple: ["u32", "bool"]
    });
    expect(tupleCompiled.ok).toBe(true);
    if (!tupleCompiled.ok) {
      return;
    }

    const tupleEncoded = encodePayload(tupleCompiled.value, [1, true], options);
    expect(tupleEncoded.ok).toBe(true);
    if (!tupleEncoded.ok) {
      return;
    }

    const tupleReader = createLazyPayloadReader(tupleCompiled.value, tupleEncoded.value, options);
    if (tupleReader.kind !== "tuple") {
      return;
    }
    const invalidIndex = tupleReader.get(5);
    expect(invalidIndex.ok).toBe(false);
  });

  it("lazily reads object-array roots and caches length/index access", () => {
    const compiled = compileShape({
      objectArray: {
        id: "u32",
        profile: {
          city: "utf8-string"
        }
      }
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const options = createOptions();
    const encoded = encodePayload(
      compiled.value,
      [
        { id: 1, profile: { city: "上海" } },
        { id: 2, profile: { city: "杭州" } }
      ],
      options
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const reader = createLazyPayloadReader(compiled.value, encoded.value, options);
    expect(reader.kind).toBe("object-array");
    if (reader.kind !== "object-array") {
      return;
    }

    const length = reader.length();
    expect(length).toEqual({ ok: true, value: 2, error: null });

    const second = reader.get(1);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    if (typeof second.value !== "object" || second.value === null || !("kind" in second.value)) {
      return;
    }
    if (second.value.kind !== "shape") {
      return;
    }

    const city = second.value.get("profile");
    expect(city.ok).toBe(true);
  });

  it("materializes scalar-array children and top-level object-array values", () => {
    const compiled = compileShape({
      ids: { scalarArray: "utf8-string" },
      flags: { scalarArray: "bool" }
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const options = createOptions();
    const encoded = encodePayload(
      compiled.value,
      {
        ids: ["a", "b", "上海"],
        flags: [true, false, true]
      },
      options
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const reader = createLazyPayloadReader(compiled.value, encoded.value, options);
    if (reader.kind !== "shape") {
      return;
    }

    const ids = reader.get("ids");
    expect(ids.ok).toBe(true);
    if (!ids.ok) {
      return;
    }
    if (typeof ids.value !== "object" || ids.value === null || !("kind" in ids.value)) {
      return;
    }
    if (ids.value.kind !== "scalar-array") {
      return;
    }

    const length = ids.value.length();
    expect(length).toEqual({ ok: true, value: 3, error: null });
    const first = ids.value.get(0);
    expect(first).toEqual({ ok: true, value: "a", error: null });
    const materializedIds = ids.value.materialize();
    expect(materializedIds).toEqual({ ok: true, value: ["a", "b", "上海"], error: null });

    const topArrayCompiled = compileShape({
      objectArray: {
        id: "u32",
        active: "bool"
      }
    });
    expect(topArrayCompiled.ok).toBe(true);
    if (!topArrayCompiled.ok) {
      return;
    }

    const topArrayEncoded = encodePayload(
      topArrayCompiled.value,
      [
        { id: 1, active: true },
        { id: 2, active: false }
      ],
      options
    );
    expect(topArrayEncoded.ok).toBe(true);
    if (!topArrayEncoded.ok) {
      return;
    }

    const topArrayReader = createLazyPayloadReader(topArrayCompiled.value, topArrayEncoded.value, options);
    if (topArrayReader.kind !== "object-array") {
      return;
    }

    const topArrayMaterialized = topArrayReader.materialize();
    expect(topArrayMaterialized).toEqual({
      ok: true,
      value: [
        { id: 1, active: true },
        { id: 2, active: false }
      ],
      error: null
    });
  });
});
