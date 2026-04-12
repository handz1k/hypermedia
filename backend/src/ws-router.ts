import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { HdaBroadcaster } from './hda-broadcaster.js';
import { SpaBroadcaster } from './spa-broadcaster.js';

const HDA_PROTOCOL = 'hda-ticker';
const SPA_PROTOCOL = 'spa-ticker';

export function createWsRouter(
  wss: WebSocketServer,
  hdaV2: HdaBroadcaster, 
  hdaV4: HdaBroadcaster, 
  spa: SpaBroadcaster,
): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const protocols = (req.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map(p => p.trim());

    // Protocol-based routing takes priority so spa-ticker on /ws goes to SPA
    if (protocols.includes(SPA_PROTOCOL)) {
      spa.addClient(ws);
    }
    // Path-based routing for htmx apps (no subprotocol)
    else if (req.url === '/ws/v4' || req.url === '/ws/beta') {
      hdaV4.addClient(ws);
    }
    else if (req.url === '/ws/v2' || req.url === '/ws' || protocols.includes(HDA_PROTOCOL)) {
      hdaV2.addClient(ws);
    }
    else {
      ws.close(4000, 'Unknown subprotocol or endpoint.');
    }
  });
}