export interface TeelemetryData {
  cpuLoad: number;
  ramTotal: number;
  ramUsed: number;
  ramUsedPercent: number;
}

export interface TelemetryMessage {
  type: 'telemetry' | 'error';
  timestamp: string;
  data?: TeelemetryData;
  message?: string;
}