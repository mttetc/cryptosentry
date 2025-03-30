import { SSEEventType } from '../schemas/sse';

export function encodeSSE(type: SSEEventType, data: any): Uint8Array {
  return new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}
