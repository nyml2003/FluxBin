import type { Registry, Result } from "@fluxbin/core";

export type ClientTransportState = "idle" | "connecting" | "open" | "closed" | "error";

export type ClientTransport = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(frame: Uint8Array): Promise<void>;
  onFrame(handler: (frame: Uint8Array) => void): () => void;
  onStateChange?(handler: (state: ClientTransportState) => void): () => void;
};

export type ClientError = {
  code: "CLIENT_NOT_IMPLEMENTED";
  message: string;
};

export type CreateClientOptions = {
  metadata?: Record<string, string>;
  registry: Registry;
  requestTimeoutMs?: number;
  transport: ClientTransport;
};

export type FluxBinClient = {
  connect(): Promise<Result<void, ClientError>>;
  disconnect(): Promise<Result<void, ClientError>>;
};
