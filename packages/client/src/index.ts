/**
 * Client package entry.
 *
 * This file re-exports the application-facing SDK layer. The client layer owns
 * request/publish session semantics but does not own protocol encoding rules.
 */
export * from "./client.js";
export * from "./errors.js";
export * from "./types.js";
