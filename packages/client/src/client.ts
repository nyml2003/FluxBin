import { err } from "@fluxbin/core";
import type { FluxBinClient, CreateClientOptions } from "./types.js";

function notImplementedResult() {
  return err({
    code: "CLIENT_NOT_IMPLEMENTED" as const,
    message: "Client behavior is not implemented yet."
  });
}

export function createClient(_options: CreateClientOptions): FluxBinClient {
  return {
    connect() {
      return Promise.resolve(notImplementedResult());
    },
    disconnect() {
      return Promise.resolve(notImplementedResult());
    }
  };
}
