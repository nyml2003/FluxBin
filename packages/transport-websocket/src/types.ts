/**
 * WebSocket transport 公共类型。
 *
 * 这个文件只定义 transport 层的连接状态、WebSocket 抽象和构造参数。
 * 它不引入 client 包类型，避免形成反向依赖。
 */
export type WebSocketTransportState = "idle" | "connecting" | "open" | "closed" | "error";

export type WebSocketEventMap = {
  close: { code?: number };
  error: { error?: unknown };
  message: { data: unknown };
  open: object;
};

export type WebSocketLike = {
  binaryType: string;
  close(): void;
  readyState: number;
  send(data: Uint8Array): void;
  addEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (event: WebSocketEventMap[K]) => void
  ): void;
  removeEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (event: WebSocketEventMap[K]) => void
  ): void;
};

export type WebSocketFactory = (
  url: string,
  protocols?: string | string[]
) => WebSocketLike;

export type WebSocketFrameTransport = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(frame: Uint8Array): Promise<void>;
  onFrame(handler: (frame: Uint8Array) => void): () => void;
  onStateChange?(handler: (state: WebSocketTransportState) => void): () => void;
};

export type CreateWebSocketTransportOptions = {
  protocols?: string | string[];
  url: string;
  webSocketFactory: WebSocketFactory;
};
