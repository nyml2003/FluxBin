import { ERROR_CODES } from "../errors/error-codes.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import type { FluxBinError } from "../errors/error-types.js";
import type { Result } from "../types/result.js";
import { readU8 } from "./read-scalars.js";
import { writeU8 } from "./write-scalars.js";

export type BoolReadResult = Result<{ nextOffset: number; value: boolean }, FluxBinError>;
export type BoolWriteResult = Result<number, FluxBinError>;

export function readBool(view: DataView, offset: number): BoolReadResult {
  const result = readU8(view, offset);
  if (!result.ok) {
    return result;
  }

  if (result.value.value === 0) {
    return ok({ nextOffset: result.value.nextOffset, value: false });
  }

  if (result.value.value === 1) {
    return ok({ nextOffset: result.value.nextOffset, value: true });
  }

  return err(
    protocolError(
      ERROR_CODES.BOOL_VALUE_INVALID,
      `Bool value must be 0 or 1, received ${String(result.value.value)}.`,
      offset
    )
  );
}

export function writeBool(view: DataView, offset: number, value: boolean): BoolWriteResult {
  let numericValue = 0;
  if (value) {
    numericValue = 1;
  }

  return writeU8(view, offset, numericValue);
}
