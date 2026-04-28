export type WebSocketTransportState = "idle" | "connecting" | "open" | "closed" | "error";

export type CreateWebSocketTransportOptions = {
  protocols?: string | string[];
  url: string;
};
