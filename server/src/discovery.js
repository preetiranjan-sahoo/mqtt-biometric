const dgram = require('dgram');
const config = require('./config');
const deviceManager = require('./deviceManager');

function handleDiscoveryRequest(mac, clientIp) {
  const cleanMac = (mac || config.DEFAULT_MAC).toUpperCase();
  console.log(`[Discovery] Configuration requested by MAC: ${cleanMac} from IP: ${clientIp}`);

  // Register or update device
  deviceManager.registerDevice(cleanMac, {
    ip: clientIp,
    status: 'online',
    lastSeen: Date.now()
  });

  return {
    result: 0,
    mqtt: {
      host: config.LOCAL_IP,
      port: String(config.MQTT_PORT),
      client_id: cleanMac,
      user_name: 'device_user',
      password: 'device_password',
      sub: `iot/sub/0101/${cleanMac}/`,
      pub: `iot/pub/0101/${cleanMac}/`,
      enable_tls: false,
      enable_heartbeat: true
    }
  };
}

function startUdpDiscovery() {
  try {
    const udpServer = dgram.createSocket('udp4');

    udpServer.on('error', (err) => {
      console.warn('[UDP Discovery Error]', err.message);
      udpServer.close();
    });

    udpServer.on('message', (msg, rinfo) => {
      try {
        console.log(`[UDP Discovery] Received broadcast from ${rinfo.address}:${rinfo.port}`);
        const data = JSON.parse(msg.toString());
        const mac = data.mac || config.DEFAULT_MAC;
        const responseData = handleDiscoveryRequest(mac, rinfo.address);
        const replyBuffer = Buffer.from(JSON.stringify(responseData));

        // Reply directly to the device or broadcast on device listening port 53294
        udpServer.send(replyBuffer, 0, replyBuffer.length, config.UDP_LISTEN_PORT, rinfo.address, (err) => {
          if (err) console.error('[UDP Discovery Send Error]', err);
          else console.log(`[UDP Discovery] Replied to ${rinfo.address}:${config.UDP_LISTEN_PORT}`);
        });
      } catch (e) {
        console.warn('[UDP Discovery] Failed to parse message:', e.message);
      }
    });

    udpServer.bind(config.UDP_BROADCAST_PORT, '0.0.0.0', () => {
      udpServer.setBroadcast(true);
      console.log(`[UDP Discovery] Listening on UDP port ${config.UDP_BROADCAST_PORT}`);
    });
  } catch (err) {
    console.warn('[UDP Discovery] Could not initialize UDP socket:', err.message);
  }
}

module.exports = {
  handleDiscoveryRequest,
  startUdpDiscovery
};

