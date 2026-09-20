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

// Helper to keep our timeline data capped at exactly 20 seconds
function trimHistory(points: any[], now: number): any[] {
  const HISTORY_MS = 20_000;
  return points.filter((point) => point.time >= now - HISTORY_MS).slice(-200);
}

function App() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [serverData, setServerData] = useState<any>(null);

  useEffect(() => {
    // Establish WebSocket connection to the server
    const socket = new WebSocket('ws://localhost:8080'); 

    socket.onopen = () => {
      console.log('Connected to backend telemetry stream!');
      setIsConnected(true);
    }

    socket.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Incoming raw hardware sample:', parsed);
      setServerData(parsed); // saving payload to local state
    }

    socket.onclose = () => {
      console.log('Socket closed.');
      setIsConnected(false);
    }

    return () => socket.close(); 
  }, []);

  return (
    <div className="min-h-screen bg-[#070b14] text-[#e2e8f0] p-6 font-sans">
      {/* Dashboard Top Header Control Panel */}
      <header className="max-w-6xl mx-auto flex justify-between items-center border-b border-[#1e293b] pb-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Edge Telemetry Control Center</h1>
          <p className="text-sm text-[#94a3b8] mt-1">Local workstation monitor via distributed sockets</p>
        </div>
        
        {/* System Network Connection Status Badge */}
        <div className="flex items-center gap-2 bg-[#0f172a] border border-[#1e293b] px-4 py-2 rounded-lg">
          <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
          <span className="text-xs font-mono uppercase tracking-wider text-[#94a3b8]">
            {isConnected ? 'Active Stream' : 'Disconnected'}
          </span>
        </div>
      </header>

      {/* Main Grid Layout Panels */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 1: CPU Layout Panels */}
        <section className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">Processor Utilization</h2>
            <span className="text-xl font-mono text-cyan-400 font-bold">
              {serverData?.data ? `${serverData.data.cpuLoad}%` : '0.0%'}
            </span>
          </div>
          {/* Live Chart Graphic */}
          <div className="h-48 bg-[#070b14] border border-[#1e293b] border-dashed rounded-lg flex items-center justify-center text-xs text-[#475569] font-mono">
            [ TODO: replace placeholder with chart engine canvas ]
          </div>
        </section>

        {/* Panel 2: Memory/RAM Monitoring Card */}
        <section className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">System Memory Pool</h2>
            <span className="text-xl font-mono text-violet-400 font-bold">
              {serverData?.data ? `${serverData.data.ramUsedPercent}%` : '0.0%'}
            </span>
          </div>
          {/* Live Chart Graphic */}
          <div className="h-48 bg-[#070b14] border border-[#1e293b] border-dashed rounded-lg flex items-center justify-center text-xs text-[#475569] font-mono">
            [ TODO: pass history array into graph rows ]
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;