import { describe, expect, it } from "vitest";
import { err, ok } from "../../../src/errors/result-factories.js";

describe("Result factories", () => {
  it("creates an ok result", () => {
    expect(ok(123)).toEqual({ ok: true, value: 123, error: null });
  });

  it("creates an error result", () => {
    expect(err({ code: "X" })).toEqual({ ok: false, value: null, error: { code: "X" } });
  });
});
