import React, { useEffect, useState } from 'react';

const SOCKET_URL = "ws://127.0.0.1:8080";
const HISTORY_MS = 20_000;
const STALE_MS = 3_000;

interface TelemetryMessage {
  type: "telemetry";
  timestamp: string;
  cpu: {
    usagePercent: number;
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
  };
}

interface TelemetryErrorMessage {
  type: "telemetry_error";
  timestamp: string;
  message: string;
}

type ServerMessage = TelemetryMessage | TelemetryErrorMessage;
type ConnectionStatus = "connecting" | "connected" | "reconnecting";

interface HistoryPoint {
  time: number;
  cpu: number | null;
  ram: number | null;
}

interface RecievedSample {
  message: TelemetryMessage;
  receivedAt: number;
}

// Quick validation functions to make sure network data is clean
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPercent(value: unknown): value is number {
  return isNonNegativeNumber(value) && value <= 100;
}

function isServerMessage(value: unknown): value is ServerMessage {
  if (!isRecord(value) || typeof value.timestamp !== "string" || !Number.isFinite(Date.parse(value.timestamp))) {
    return false;
  }

  if (value.type === "telemetry_error") {
    return typeof value.message === "string";
  }

  if (value.type !== "telemetry" || !isRecord(value.cpu) || !isRecord(value.memory)) {
  return false;
}

const { cpu, memory } = value as Record<string, any>;
return (
    isPercent(cpu.usagePercent) &&
    isPercent(memory.usagePercent) &&
    isNonNegativeNumber(memory.totalBytes) &&
    memory.totalbytes > 0 &&
    isNonNegativeNumber(memory.usedBytes) &&
    memory.usedBytes <= memory.totalBytes &&
    isNonNegativeNumber(memory.availableBytes) &&
    memory.availableBytes <= memory.totalBytes
);
}

// Helper to keep our timeline data capped at exactly 20 seconds
function trimHistory(points: HistoryPoint[], now: number): HistoryPoint[] {
  return points
    .filter((point) => point.time > now - HISTORY_MS)
    .slice(-200);
}

// Helper to convert raw bytes into readable Gigabytes
function formatGiB(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

// Helper to format timestamps into a clean digital clock
function formatTime(time: number): string {
  return new Date(time).toLocaleTimeString([], { 
    hour12: false, 
    hour: "2-digit", 
    minute: "2-digit", 
    second: "2-digit", 
  });
}

function useTelemetry() {
  const [connection, setConnection] =
    useState<ConnectionStatus>("connecting");
  const [latest, setLatest] = useState<RecievedSample | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let connectionTimer: number | undefined;
    let retryAttempt = 0;
    let lastValidAt = 0;
    let lastMessageAt = Date.now();

    function addGap(time: number) {
      setHistory((previous) =>
        trimHistory(
          [...previous, { time, cpu: null, ram: null }],
          time,
        ),
      );
    }

    function connect() {
      if (disposed) return;

      const current = new WebSocket(SOCKET_URL);
      socket = current;
      lastMessageAt = Date.now();

      // Avoid waiting indefinitely for a connection.
      connectionTimer = window.setTimeout(() => {
        if (current.readyState === WebSocket.CONNECTING) {
          current.close();
        }
      }, 5_000);

      current.onopen = () => {
        if (disposed) return;

        window.clearTimeout(connectionTimer);
        lastMessageAt = Date.now();
        setConnection("connected");
        setProblem(null);
      };

      current.onmessage = (event: MessageEvent<unknown>) => {
        if (disposed) return;

        try {
          if (typeof event.data !== "string") {
            throw new Error("Expected a text message.");
          }

          const parsed: unknown = JSON.parse(event.data);

          if (!isServerMessage(parsed)) {
            throw new Error("Unexpected telemetry structure.");
          }

          const receivedAt = Date.now();
          lastMessageAt = receivedAt;
          retryAttempt = 0;
          setNow(receivedAt);

          if (parsed.type === "telemetry_error") {
            setProblem(parsed.message);
            addGap(receivedAt);
            return;
          }

          const previousValidAt = lastValidAt;
          lastValidAt = receivedAt;

          setProblem(null);
          setLatest({ message: parsed, receivedAt });

          setHistory((previous) => {
            const points = [...previous];

            // Preserve a visible gap if the browser was paused or delayed.
            if (
              previousValidAt > 0 &&
              receivedAt - previousValidAt > STALE_MS
            ) {
              points.push({
                time: receivedAt - 1,
                cpu: null,
                ram: null,
              });
            }

            points.push({
              time: receivedAt,
              cpu: parsed.cpu.usagePercent,
              ram: parsed.memory.usagePercent,
            });

            return trimHistory(points, receivedAt);
          });
        } catch {
          setProblem("Received an invalid telemetry message.");
          addGap(Date.now());
        }
      };

      current.onerror = () => {
        if (disposed) return;

        setProblem("Cannot reach the local telemetry server.");
        // The close handler owns retry scheduling.
        current.close();
      };

      current.onclose = () => {
        if (disposed) return;

        window.clearTimeout(connectionTimer);
        socket = null;
        setConnection("reconnecting");
        addGap(Date.now());

        // Retry after 1, 2, 4, 8, then at most 15 seconds.
        const delay = Math.min(
          1_000 * 2 ** Math.min(retryAttempt, 4),
          15_000,
        );

        retryAttempt += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
    }

    connect();

    // Advance the timeline even if messages stop arriving.
    const clockTimer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);

      setHistory((previous) => {
        const points = trimHistory(previous, time);

        if (lastValidAt > 0 && time - lastValidAt > STALE_MS) {
          points.push({ time, cpu: null, ram: null });
        }

        return points.slice(-200);
      });

      // Recover from a connection that appears open but has gone silent.
      if (
        socket?.readyState === WebSocket.OPEN &&
        time - lastMessageAt > 10_000
      ) {
        socket.close(4000, "Telemetry stream timed out");
      }
    }, 1_000);

    return () => {
      disposed = true;
      window.clearInterval(clockTimer);
      window.clearTimeout(retryTimer);
      window.clearTimeout(connectionTimer);

      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  const stale =
    latest === null || now - latest.receivedAt > STALE_MS;

  return { connection, latest, history, problem, now, stale };
}

function App() {
  // Activating the master telemetry stream hook we built in the top half
  const { connection, latest, history, problem, now, stale } = useTelemetry();
  
  const telemetry = latest?.message;
  const fresh = connection === "connected" && !stale && !problem;

  return (
    <div className="min-h-screen bg-[#070b14] text-[#e2e8f0] p-6 font-sans">
      {/* Dashboard Top Header Control Panel */}
      <header className="max-w-6xl mx-auto flex justify-between items-center border-b border-[#1e293b] pb-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Edge Telemetry Control Center</h1>
          <p className="text-sm text-[#94a3b8] mt-1">Local workstation monitor via distributed sockets</p>
        </div>
        
        {/* System Network Connection Status Badge linked to hook state */}
        <div className="flex items-center gap-2 bg-[#0f172a] border border-[#1e293b] px-4 py-2 rounded-lg">
          <span className={`h-2.5 w-2.5 rounded-full ${fresh ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
          <span className="text-xs font-mono uppercase tracking-wider text-[#94a3b8]">
            {fresh ? 'Active Stream' : connection === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}
          </span>
        </div>
      </header>

        {/* Dynamic Statistics Bar Row */}
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-xl">
            <p className="text-xs text-[#94a3b8]">Total Capacity</p>
            <p className="text-xl font-mono font-bold mt-1 text-slate-200">
            {telemetry ? formatGiB(telemetry.memory.totalBytes) : 'N/A'}
            </p>
          </div>
          <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-xl">
            <p className="text-xs text-[#94a3b8]">Used Memory</p>
            <p className="text-xl font-mono font-bold mt-1 text-slate-200">
            {telemetry ? formatGiB(telemetry.memory.usedBytes) : 'N/A'}
            </p>
          </div>
          <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-xl">
            <p className="text-xs text-[#94a3b8]">Available Memory</p>
            <p className="text-xl font-mono font-bold mt-1 text-slate-200">
            {telemetry ? formatGiB(telemetry.memory.availableBytes) : 'N/A'}
            </p>
          </div>
          <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-xl">
            <p className="text-xs text-[#94a3b8]">Local Clock</p>
            <p className="text-xl font-mono font-bold mt-1 text-slate-400">
              {formatTime(now)}
            </p>
          </div>
        </div>

      {/* Main Grid Layout Panels */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 1: CPU Layout Panels */}
        <section className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">Processor Utilization</h2>
            <span className="text-xl font-mono text-cyan-400 font-bold">
              {telemetry ? `${telemetry.cpu.usagePercent.toFixed(1)}%` : '0.0%'}
            </span>
          </div>
          {/* Live Chart Graphic Placeholder */}
          <div className="h-48 bg-[#070b14] border border-[#1e293b] border-dashed rounded-lg flex items-center justify-center text-xs text-[#475569] font-mono">
            {/* TODO: link history timeline arrays to a re-charts sub-component widget */}
            [ CPU Chart Canvas Area ]
          </div>
        </section>

        {/* Panel 2: Memory/RAM Monitoring Card */}
        <section className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">System Memory Pool</h2>
            <span className="text-xl font-mono text-violet-400 font-bold">
              {telemetry ? `${telemetry.memory.usagePercent.toFixed(1)}%` : '0.0%'}
            </span>
          </div>
          {/* Live Chart Graphic Placeholder */}
          <div className="h-48 bg-[#070b14] border border-[#1e293b] border-dashed rounded-lg flex items-center justify-center text-xs text-[#475569] font-mono">
            {/* TODO: map background history arrays into linear graphic vectors */}
            [ RAM Chart Canvas Area ]
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;