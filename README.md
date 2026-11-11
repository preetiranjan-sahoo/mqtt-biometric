# Biometric Device Access Control Platform (Jasta MQTT Protocol)

This application connects to and manages your Jasta biometric terminal (**MAC: `2002F43005D3`**) using Node.js, Express, an embedded MQTT broker, and a modern React.js web interface.

---

## 🚀 Features

- **Embedded MQTT Broker**: Runs directly inside Node.js on port **`1884`** (no external broker or Docker needed, avoiding port 1883 conflicts).
- **Remote Door Unlock**: Instant one-click **"Open Door"** button with real-time feedback via `door.open`.
- **User Management**:
  - View all registered users on the terminal (`person.get`).
  - Add new personnel with Card Number, PIN, and Name (`person.add`).
  - Delete users directly from the device (`person.del`).
- **Live Attendance & Punch Feed**: Real-time event log for every card swipe, face scan, or keypad unlock (`post.record`) streamed over Server-Sent Events (SSE).
- **HTTP Auto-Discovery**: Provides `/mqtt_address/` on port **`5050`** for devices that configure broker settings automatically over HTTP.

---

## ⚙️ Network Configuration

| Service | Port | Address / URL |
| :--- | :--- | :--- |
| **Web UI & REST API** | `5050` | `http://192.168.0.21:5050` (or `http://localhost:5050`) |
| **MQTT Broker (TCP)** | `1884` | `mqtt://192.168.0.21:1884` |
| **Device Discovery URL**| `5050` | `http://192.168.0.21:5050/mqtt_address/` |
| **Target Device MAC** | — | `2002F43005D3` |

---

## 🏃 Quick Start

### 1. Start the Platform Server
In your terminal, run:
```bash
npm start
```
*(Or simply double-click **`start-server.bat`**)*

Then open your browser at:
👉 **`http://localhost:5050`**

---

### 2. Connect Your Biometric Device (`2002F43005D3`)

On the physical device's touch screen:
1. Enter the device **Menu** -> **Network Settings** -> **Server Address Configuration**.
2. Set the server configuration:
   - **Server IP**: `192.168.0.21`
   - **MQTT Port**: `1884`
   - *(Or if using HTTP discovery)*: `http://192.168.0.21:5050/mqtt_address/`
3. Save and restart/reconnect the device.
4. Once connected, the Web UI at `http://localhost:5050` will automatically show the green **ONLINE** badge for `2002F43005D3`.

---

### 3. Optional: Test with Device Simulator
If you want to test the UI buttons, user sync, and door unlock without the physical terminal powered on:
```bash
node server/simulate_device.js
```
The simulator will register `2002F43005D3`, send heartbeats, and respond to door unlock commands and user additions in real time.

