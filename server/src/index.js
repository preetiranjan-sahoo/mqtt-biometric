const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { startBroker } = require('./mqttBroker');
const deviceManager = require('./deviceManager');
const { handleDiscoveryRequest, startUdpDiscovery } = require('./discovery');

const app = express();

const debugLogs = [];
const origLog = console.log;
const origWarn = console.warn;
const origErr = console.error;
console.log = (...args) => {
  debugLogs.push(`[${new Date().toISOString().slice(11, 19)}] [LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
  if (debugLogs.length > 300) debugLogs.shift();
  origLog(...args);
};
console.warn = (...args) => {
  debugLogs.push(`[${new Date().toISOString().slice(11, 19)}] [WARN] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
  if (debugLogs.length > 300) debugLogs.shift();
  origWarn(...args);
};
console.error = (...args) => {
  debugLogs.push(`[${new Date().toISOString().slice(11, 19)}] [ERR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
  if (debugLogs.length > 300) debugLogs.shift();
  origErr(...args);
};

// Comprehensive CORS configuration for LAN and multi-device access
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: false
}));

// Handle preflight for all routes
app.options('*', cors());

// Fallback headers middleware to guarantee cross-origin access across LAN
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  if (!req.url.startsWith('/api/events')) {
    console.log(`[HTTP] ${req.method} ${req.url}`);
  }
  next();
});

// ----------------------------------------------------
// 1. Biometric Device HTTP Discovery Endpoint
// Matches protocol: GET/POST /mqtt_address or /mqtt_address/
// ----------------------------------------------------
const discoveryHandler = (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const mac = (req.body && req.body.mac) || (req.query && req.query.mac) || config.DEFAULT_MAC;
  const configResponse = handleDiscoveryRequest(mac, clientIp);
  res.json(configResponse);
};

// Catch any request matching mqtt_address anywhere in path, or containing device payload with mac
app.use((req, res, next) => {
  if (req.url.includes('mqtt_address') || (req.body && req.body.mac && !req.url.startsWith('/api/'))) {
    return discoveryHandler(req, res);
  }
  next();
});

app.get('/mqtt_address', discoveryHandler);
app.get('/mqtt_address/', discoveryHandler);
app.post('/mqtt_address', discoveryHandler);
app.post('/mqtt_address/', discoveryHandler);

// ----------------------------------------------------
// 2. REST API for Dashboard & Frontend
// ----------------------------------------------------

// Server status & config
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    serverIp: config.LOCAL_IP,
    httpPort: config.HTTP_PORT,
    mqttPort: config.MQTT_PORT,
    defaultMac: config.DEFAULT_MAC,
    timestamp: new Date().toISOString()
  });
});

// List all devices
app.get('/api/devices', (req, res) => {
  const devices = deviceManager.getDevicesList();
  res.json(devices);
});

// Open door
app.post('/api/devices/:mac/open', async (req, res) => {
  const mac = req.params.mac;
  try {
    const result = await deviceManager.openDoor(mac);
    res.json({ success: true, message: 'Door unlock command sent successfully', result });
  } catch (err) {
    console.error(`[API] Error opening door on ${mac}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Query users from device (person.get)
app.get('/api/devices/:mac/users', async (req, res) => {
  const mac = req.params.mac;
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 100;
  try {
    const data = await deviceManager.getUsers(mac, page, pageSize);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error(`[API] Error fetching users from ${mac}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add user to device (person.add)
app.post('/api/devices/:mac/users', async (req, res) => {
  const mac = req.params.mac;
  const { name, account, cardNo, faceBase64, isAdmin } = req.body;
  try {
    const result = await deviceManager.addUser(mac, {
      name,
      account,
      cardNo,
      faceBase64,
      isAdmin: !!isAdmin
    });
    res.json({ success: true, message: 'User added successfully to device', result });
  } catch (err) {
    console.error(`[API] Error adding user on ${mac}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete user from device (person.del)
app.delete('/api/devices/:mac/users/:id', async (req, res) => {
  const mac = req.params.mac;
  const userId = req.params.id;
  const account = req.query.account || '';
  try {
    const result = await deviceManager.deleteUser(mac, userId, account);
    res.json({ success: true, message: 'User deleted successfully from device', result });
  } catch (err) {
    console.error(`[API] Error deleting user on ${mac}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear all users from device (person.clear)
app.post('/api/devices/:mac/users/clear', async (req, res) => {
  const mac = req.params.mac;
  try {
    const result = await deviceManager.clearAllUsers(mac);
    res.json({ success: true, message: 'All users cleared successfully', result });
  } catch (err) {
    console.error(`[API] Error clearing users on ${mac}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get device parameters (params.get)
app.get('/api/devices/:mac/params', async (req, res) => {
  const mac = req.params.mac;
  try {
    const params = await deviceManager.getDeviceParams(mac);
    res.json({ success: true, params });
  } catch (err) {
    console.error(`[API] Error getting params from ${mac}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get real-time event logs (punch history)
app.get('/api/logs', (req, res) => {
  res.json(deviceManager.getLogs());
});

app.get('/api/debug-log', (req, res) => {
  res.json(debugLogs);
});

// SSE Stream for live real-time events
app.get('/api/events', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);

  deviceManager.subscribeSSE(res);
});

// Root status endpoint (Port 5050 is exclusively for Backend API & MQTT)
app.get('/', (req, res) => {
  res.json({
    service: 'Biometric Terminal Backend API & MQTT Platform',
    status: 'running',
    backendPort: config.HTTP_PORT,
    mqttPort: config.MQTT_PORT,
    frontendUrl: 'http://localhost:3000',
    endpoints: {
      health: '/api/health',
      devices: '/api/devices',
      logs: '/api/logs',
      events: '/api/events',
      discovery: '/mqtt_address/'
    }
  });
});

// ----------------------------------------------------
// 3. Start Server & Services
// ----------------------------------------------------
const aedesBroker = startBroker(
  (clientId) => {
    if (clientId) {
      deviceManager.registerDevice(clientId, { status: 'online', lastSeen: Date.now() });
    }
  },
  (clientId) => {
    // client disconnected
  }
);

deviceManager.init(aedesBroker);
startUdpDiscovery();

app.listen(config.HTTP_PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  Biometric Device Platform is LIVE!`);
  console.log(`  Local IP:           http://${config.LOCAL_IP}:${config.HTTP_PORT}`);
  console.log(`  MQTT Broker:        mqtt://${config.LOCAL_IP}:${config.MQTT_PORT}`);
  console.log(`  Target Device MAC:  ${config.DEFAULT_MAC}`);
  console.log(`  Device Server Config (Enter in Device Menu):`);
  console.log(`    - Server IP/Address: ${config.LOCAL_IP}`);
  console.log(`    - Server Port:       ${config.HTTP_PORT}`);
  console.log(`    - Discovery URL:     http://${config.LOCAL_IP}:${config.HTTP_PORT}/mqtt_address/`);
  console.log(`=======================================================`);
});

// Also attempt to listen on standard port 80 for devices that default to port 80
try {
  const http80 = require('http').createServer(app);
  http80.listen(80, '0.0.0.0', () => {
    console.log('[HTTP] Also listening on port 80 (standard HTTP) for device discovery');
  }).on('error', () => {
    // Port 80 not available or needs admin rights, silently continue
  });
} catch (e) {}
