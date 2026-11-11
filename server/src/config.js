const os = require('os');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.0.21';
}

const localIp = getLocalIp();

module.exports = {
  HTTP_PORT: process.env.PORT || 5050,
  MQTT_PORT: process.env.MQTT_PORT || 1884,
  LOCAL_IP: process.env.LOCAL_IP || localIp,
  DEFAULT_MAC: process.env.DEFAULT_MAC || '2002F43005D3',
  UDP_LISTEN_PORT: 53294,
  UDP_BROADCAST_PORT: 53293,
};
