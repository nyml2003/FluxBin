import { describe, expect, it } from "vitest";
import { createOptions } from "../../../src/limits/default-limits.js";
import { decodePayload } from "../../../src/reader/decode-payload.js";
import { compileShape } from "../../../src/shape/compile-shape.js";
import { encodePayload } from "../../../src/writer/encode-payload.js";

describe("payload encode/decode errors", () => {
  it("rejects missing or invalid field values during encode", () => {
    const compiled = compileShape({
      active: "bool",
      name: "utf8-string"
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const missingField = encodePayload(compiled.value, { active: true }, createOptions());
    expect(missingField.ok).toBe(false);

    const invalidField = encodePayload(compiled.value, { active: "yes", name: "flux" }, createOptions());
    expect(invalidField.ok).toBe(false);
  });

  it("rejects trailing bytes and invalid nested objects during decode/encode", () => {
    const compiled = compileShape({
      profile: {
        age: "u8"
      }
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const invalidObject = encodePayload(compiled.value, { profile: "bad" }, createOptions());
    expect(invalidObject.ok).toBe(false);

    const payload = new Uint8Array([7, 99]);
    const decoded = decodePayload(compiled.value, payload, createOptions());
    expect(decoded.ok).toBe(false);
  });

  it("encodes all supported scalar branches successfully", () => {
    const compiled = compileShape({
      active: "bool",
      count: "u8",
      delta: "i8",
      id: "u32",
      level: "u16",
      offset: "i16",
      score: "i32",
      title: "utf8-string",
      nested: {
        city: "utf8-string"
      }
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const encoded = encodePayload(
      compiled.value,
      {
        active: true,
        count: 1,
        delta: -1,
        id: 9,
        level: 2,
        offset: -2,
        score: -3,
        title: "flux",
        nested: {
          city: "上海"
        }
      },
      createOptions()
    );

    expect(encoded.ok).toBe(true);
  });

  it("rejects out-of-range numeric fields and invalid string fields", () => {
    const numericShape = compileShape({
      count: "u8"
    });
    expect(numericShape.ok).toBe(true);
    if (!numericShape.ok) {
      return;
    }

    const numericFailure = encodePayload(
      numericShape.value,
      {
        count: 256
      },
      createOptions()
    );
    expect(numericFailure.ok).toBe(false);

    const stringShape = compileShape({
      title: "utf8-string"
    });
    expect(stringShape.ok).toBe(true);
    if (!stringShape.ok) {
      return;
    }

    const stringFailure = encodePayload(
      stringShape.value,
      {
        title: 123
      },
      createOptions()
    );
    expect(stringFailure.ok).toBe(false);
  });

  it("encodes and decodes tuple roots, and rejects tuple shape mismatches", () => {
    const compiled = compileShape({
      tuple: ["u32", "utf8-string", { tuple: ["bool", "i16"] }]
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const encoded = encodePayload(compiled.value, [9, "上海", [true, -2]], createOptions());
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const decoded = decodePayload(compiled.value, encoded.value, createOptions());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }

    expect(decoded.value.value).toEqual([9, "上海", [true, -2]]);

    const wrongLength = encodePayload(compiled.value, [9, "上海"], createOptions());
    expect(wrongLength.ok).toBe(false);

    const wrongType = encodePayload(compiled.value, [9, "上海", "bad"], createOptions());
    expect(wrongType.ok).toBe(false);
  });

  it("encodes and decodes objectArray and scalarArray fields", () => {
    const compiled = compileShape({
      ids: { scalarArray: "u32" },
      users: {
        objectArray: {
          active: "bool",
          name: "utf8-string"
        }
      }
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const encoded = encodePayload(
      compiled.value,
      {
        ids: [1, 2, 3],
        users: [
          { active: true, name: "a" },
          { active: false, name: "上海" }
        ]
      },
      createOptions()
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }

    const decoded = decodePayload(compiled.value, encoded.value, createOptions());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }

    expect(decoded.value.value).toEqual({
      ids: [1, 2, 3],
      users: [
        { active: true, name: "a" },
        { active: false, name: "上海" }
      ]
    });

    const badScalarArray = encodePayload(compiled.value, { ids: "bad", users: [] }, createOptions());
    expect(badScalarArray.ok).toBe(false);

    const badObjectArray = encodePayload(compiled.value, { ids: [], users: ["bad"] }, createOptions());
    expect(badObjectArray.ok).toBe(false);
  });

  it("encodes objectArray roots and rejects invalid array root inputs", () => {
    const compiled = compileShape({
      objectArray: {
        id: "u32",
        name: "utf8-string"
      }
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    const encoded = encodePayload(
      compiled.value,
      [
        { id: 1, name: "a" },
        { id: 2, name: "b" }
      ],
      createOptions()
    );
    expect(encoded.ok).toBe(true);

    const invalidRoot = encodePayload(compiled.value, { id: 1 }, createOptions());
    expect(invalidRoot.ok).toBe(false);
  });

  it("rejects tuple root with non-array input and enforces array limits", () => {
    const tupleCompiled = compileShape({
      tuple: ["u32", "utf8-string"]
    });
    expect(tupleCompiled.ok).toBe(true);
    if (!tupleCompiled.ok) {
      return;
    }

    const invalidTupleRoot = encodePayload(tupleCompiled.value, { id: 1 }, createOptions());
    expect(invalidTupleRoot.ok).toBe(false);

    const arrayCompiled = compileShape({
      ids: { scalarArray: "u32" }
    });
    expect(arrayCompiled.ok).toBe(true);
    if (!arrayCompiled.ok) {
      return;
    }

    const limitedOptions = createOptions({
      limits: {
        maxArrayLength: 1
      }
    });
    const oversizedArray = encodePayload(arrayCompiled.value, { ids: [1, 2] }, limitedOptions);
    expect(oversizedArray.ok).toBe(false);
  });

  it("grows internal writer capacity for large arrays and enforces payload/string limits", () => {
    const largeArrayCompiled = compileShape({
      ids: { scalarArray: "u32" },
      labels: { scalarArray: "utf8-string" }
    });
    expect(largeArrayCompiled.ok).toBe(true);
    if (!largeArrayCompiled.ok) {
      return;
    }

    const largeArrayEncoded = encodePayload(
      largeArrayCompiled.value,
      {
        ids: Array.from({ length: 400 }, (_, index) => index),
        labels: ["a", "b", "c"]
      },
      createOptions()
    );
    expect(largeArrayEncoded.ok).toBe(true);

    const payloadTooLarge = encodePayload(
      largeArrayCompiled.value,
      {
        ids: [1],
        labels: ["a"]
      },
      createOptions({
        limits: {
          maxPayloadBytes: 4
        }
      })
    );
    expect(payloadTooLarge.ok).toBe(false);

    const stringTooLarge = encodePayload(
      largeArrayCompiled.value,
      {
        ids: [],
        labels: ["ab"]
      },
      createOptions({
        limits: {
          maxStringBytes: 1
        }
      })
    );
    expect(stringTooLarge.ok).toBe(false);
  });
});
