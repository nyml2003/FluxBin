/**
 * client 公共类型定义。
 *
 * 这个文件定义 descriptor、transport 契约和最小 client API。
 * 它属于 SDK 层，不直接承载协议字节逻辑。
 */
import type { Registry, Result, Shape } from "@fluxbin/core";
import type { ClientError } from "./errors.js";

export type ClientTransportState = "idle" | "connecting" | "open" | "closed" | "error";

export type ClientTransport = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(frame: Uint8Array): Promise<void>;
  onFrame(handler: (frame: Uint8Array) => void): () => void;
  onStateChange?(handler: (state: ClientTransportState) => void): () => void;
};

export type MessageDescriptor<TPayload> = {
  name?: string;
  shape: Shape;
  typeId: number;
  _payload?: TPayload;
};

export type PublishMessage<TPayload> = {
  descriptor: MessageDescriptor<TPayload>;
  payload: TPayload;
};

export type RequestMessage<TRequest, TResponse> = {
  payload: TRequest;
  request: MessageDescriptor<TRequest>;
  response: MessageDescriptor<TResponse>;
  timeoutMs?: number;
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
  publish<TPayload>(message: PublishMessage<TPayload>): Promise<Result<void, ClientError>>;
  request<TRequest, TResponse>(message: RequestMessage<TRequest, TResponse>): Promise<Result<TResponse, ClientError>>;
};
