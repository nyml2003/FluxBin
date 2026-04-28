export type Result<T, E> =
  | { ok: true; value: T; error: null }
  | { ok: false; value: null; error: E };

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T; error: null } {
  return result.ok;
}
