# Local IoT Edge Dashboard

A real-time system monitoring dashboard built with Node.js, React, and TypeScript. The application collects CPU and memory statistics from a local Windows workstation and streams them to the browser over WebSockets.

The dashboard provides a live view of resource utilization, with a rolling history and automatic connection recovery.

## Features

- **Live telemetry:** CPU and RAM readings updated approximately once per second.
- **Rolling charts:** A 20-second view of utilization with average and peak values.
- **Memory overview:** Total, used, and remaining RAM displayed in GiB.
- **Data validation:** Incoming messages are checked before updating the interface.
- **Connection handling:** Automatic reconnection and stale-data detection.
- **Missing-data visibility:** Chart gaps distinguish unavailable readings from zero utilization.

## Technology Stack

| Component | Technologies |
| --- | --- |
| Backend | Node.js, TypeScript, systeminformation |
| Communication | WebSockets, ws |
| Frontend | React, TypeScript, Vite |
| Interface | Tailwind CSS, Recharts |

## Getting Started

### Prerequisites

- Windows
- Node.js and npm, using a Node.js version compatible with [Vite](https://vite.dev/guide/)

Clone or download the repository and open its root directory.

### Install Dependencies

```powershell
npm install
cd frontend
npm install
cd ..
```

### Start the Application

Run the backend from the repository root:

```powershell
npm run dev
```

In a second terminal, starting from the repository root, run the frontend:

```powershell
cd frontend
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The frontend connects to the telemetry server at `ws://127.0.0.1:8080`.

Keep both processes running while using the dashboard. Press `Ctrl+C` in each terminal to stop them.

### Frontend Build

From the `frontend` directory:

```powershell
npm run build
```

The generated files are written to `frontend/dist`. The telemetry backend runs separately.

## Data Flow

The backend collects system statistics and sends JSON messages through a persistent WebSocket connection. The frontend validates and normalizes each message, updates the current readings, and maintains the rolling chart history.

Average and peak values are calculated from valid samples within the current 20-second window. Remaining memory is calculated as total minus used RAM. History is held in browser memory and resets when the page reloads.

## Project Status

The local monitoring dashboard is functional and under active development, with ongoing refinements to usability and reliability.