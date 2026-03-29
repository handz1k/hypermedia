import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { HdaBroadcaster } from './hda-broadcaster.js';
import { SpaBroadcaster } from './spa-broadcaster.js';

const HDA_PROTOCOL = 'hda-ticker';
const SPA_PROTOCOL = 'spa-ticker';

export function createWsRouter(
  wss: WebSocketServer,
  hda: HdaBroadcaster,
  spa: SpaBroadcaster,
): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const protocols = (req.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map(p => p.trim());

    if (protocols.includes(HDA_PROTOCOL)) {
      hda.addClient(ws);
    } else if (protocols.includes(SPA_PROTOCOL)) {
      spa.addClient(ws);
    } else {
      ws.close(4000, 'Unknown subprotocol. Use hda-ticker or spa-ticker.');
    }
  });
}
