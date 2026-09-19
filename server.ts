import { WebSocketServer, WebSocket } from 'ws';
import si from 'systeminformation';

const HOST = '127.0.0.1';
const PORT = 8080;
const ALLOWED_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

interface TelemetryMessage {
  type: 'telemetry';
  timestamp: string;
  data: {
    cpuLoad: number;
    ramTotal: number;
    ramUsed: number;
    ramUsedPercent: number;
  };
}

interface TelemetryErrorMessage {
  type: 'error';
  message: string;
}

let stopping = false;

const wss = new WebSocketServer({
  host: HOST,
  port: PORT,
  perMessageDeflate: false,
  maxPayload: 1024,
  verifyClient: (info: { origin: string }) => {
    return !stopping && (!info.origin || ALLOWED_ORIGINS.has(info.origin));
  }
});

function roundPercent(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}

function broadcast(message: TelemetryMessage | TelemetryErrorMessage): void {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

async function collectAndBroadcast(): Promise<void> {
  if (stopping) return;
  try {
    const [load, mem] = await Promise.all([
      si.currentLoad(),
      si.mem()
    ]);

    const ramUsedPercent = roundPercent((mem.active / mem.total) * 100);

    broadcast({
      type: 'telemetry',
      timestamp: new Date().toISOString(),
      data: {
        cpuLoad: roundPercent(load.currentLoad),
        ramTotal: mem.total,
        ramUsed: mem.active,
        ramUsedPercent
      }
    });
  } catch (error) {
    broadcast({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown telemetry error'
    });
  }
}

const intervalId = setInterval(() => {
  collectAndBroadcast().catch(() => {});
}, 1000);

wss.on('listening', () => {
  console.log(`[Telemetry Server] Running smoothly at ws://${HOST}:${PORT}`);
});

function gracefulShutdown(signal: string): void {
  if (stopping) return;
  stopping = true;
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  clearInterval(intervalId);
  wss.close(() => {
    console.log('[Server] WebSocket closed. Exiting process clean.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));