export interface LambdaProxy {
  statusCode?: number;
  body?: string;
  headers?: Record<string, string>;
}

export interface CommonPayload {
  data?: unknown[];
  items?: unknown[];
  [key: string]: unknown;
}

export type ApiResponse =
  | LambdaProxy
  | CommonPayload
  | unknown[]
  | Record<string, unknown>;
