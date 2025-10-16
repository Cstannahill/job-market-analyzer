export interface LambdaProxy {
  statusCode?: number;
  body?: string;
}

export interface CommonPayload {
  data?: unknown[];
  items?: unknown[];
}
export type ApiResponse =
  | LambdaProxy
  | CommonPayload
  | unknown[]
  | Record<string, unknown>;
