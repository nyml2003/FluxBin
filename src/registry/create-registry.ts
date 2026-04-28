import { ERROR_CODES } from "../errors/error-codes.js";
import { createOptions } from "../limits/default-limits.js";
import { err, ok, protocolError } from "../errors/result-factories.js";
import { compileShape } from "../shape/compile-shape.js";
import type { Shape } from "../shape/shape-node.js";
import type { Registry, RegistryMeta, RegistryOptions, RegistryOptionsInput, RegisteredShape } from "./registry-types.js";

export function createRegistry(options?: RegistryOptionsInput): Registry {
  const createdOptions = createOptions(options);
  const frozenLimits = Object.freeze(createdOptions.limits);
  const resolvedOptions = Object.freeze({
    ...createdOptions,
    limits: frozenLimits
  }) as RegistryOptions;
  const entries = new Map<number, RegisteredShape>();

  function register<const S extends Shape>(typeId: number, shape: S, meta?: RegistryMeta) {
    if (!Number.isInteger(typeId) || typeId < 0) {
      return err(protocolError(ERROR_CODES.INVALID_FIELD_VALUE, "typeId must be a non-negative integer.", null));
    }

    if (entries.has(typeId)) {
      return err(
        protocolError(ERROR_CODES.DUPLICATE_TYPE_ID, `typeId ${String(typeId)} is already registered.`, null)
      );
    }

    const compiled = compileShape(shape, resolvedOptions.limits);
    if (!compiled.ok) {
      return compiled;
    }

    const entry: RegisteredShape<S> = {
      compiledShape: compiled.value,
      shape,
      typeId
    };
    if (meta !== undefined) {
      entry.meta = meta;
    }

    entries.set(typeId, entry);
    return ok(entry);
  }

  return {
    get(typeId: number) {
      return entries.get(typeId);
    },
    has(typeId: number) {
      return entries.has(typeId);
    },
    options: resolvedOptions,
    register
  };
}
