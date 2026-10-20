// The `CampaignChannel` Durable Object (ruling 20): one per campaign id, holding every open page's WebSocket (hibernation API).
// Kept apart from `live.ts` because this file imports `cloudflare:workers`, which the Node tests cannot load.
import { DurableObject } from 'cloudflare:workers'

/** Sends each published event to every connected page. Hibernates between events; its sockets stay open. */
export class CampaignChannel extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const { 0: client, 1: server } = new WebSocketPair()
      this.ctx.acceptWebSocket(server)
      return new Response(null, { status: 101, webSocket: client })
    }
    if (request.method === 'POST' && new URL(request.url).pathname === '/publish') {
      const message = await request.text()
      for (const socket of this.ctx.getWebSockets()) {
        try {
          socket.send(message)
        } catch (error) {
          console.error('live: send failed', error instanceof Error ? error.message : error) // one dead socket must not starve the rest
        }
      }
      return new Response(null, { status: 204 })
    }
    return new Response('Not found', { status: 404 })
  }

  // Pages only listen; anything they send is ignored.
  webSocketMessage(): void {}
  webSocketClose(socket: WebSocket, code: number, reason: string): void {
    // Echo the close so the runtime releases the socket; a reserved code (1005/1006) cannot be sent back.
    try {
      socket.close(code >= 1000 && code < 1005 ? code : 1000, reason)
    } catch {
      // already closed
    }
  }
  webSocketError(socket: WebSocket): void {
    try {
      socket.close(1011, 'error')
    } catch {
      // already closed
    }
  }
}
