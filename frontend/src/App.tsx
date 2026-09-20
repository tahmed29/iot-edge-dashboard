import React, { useState } from 'react';

function App() {
  const [isConnected, setIsConnected] = useState<boolean>(false);

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
            <span className="text-xl font-mono text-cyan-400 font-bold">0.0%</span>
          </div>
          {/* Placeholder for Live Chart Graphic */}
          <div className="h-48 bg-[#070b14] border border-[#1e293b] border-dashed rounded-lg flex items-center justify-center text-xs text-[#475569] font-mono">
            {/* TODO: import recharts responsive container & link socket stream here */}
            [ CPU Chart Canvas Area ]
          </div>
        </section>

        {/* Panel 2: Memory/RAM Monitoring Card */}
        <section className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">System Memory Pool</h2>
            <span className="text-xl font-mono text-violet-400 font-bold">0.00 / 0.00 GB</span>
          </div>
          {/* Placeholder for Live Chart Graphic */}
          <div className="h-48 bg-[#070b14] border border-[#1e293b] border-dashed rounded-lg flex items-center justify-center text-xs text-[#475569] font-mono">
            {/* TODO: pass live ramUsedPercent array data into area chart */}
            [ RAM Chart Canvas Area ]
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;