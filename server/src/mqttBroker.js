const aedes = require('aedes')();
const net = require('net');
const config = require('./config');

let server = null;

function startBroker(onClientConnected, onClientDisconnected) {
  server = net.createServer(aedes.handle);

  server.listen(config.MQTT_PORT, '0.0.0.0', () => {
    console.log(`[MQTT Broker] Running on port ${config.MQTT_PORT} (TCP)`);
  });

  aedes.on('client', (client) => {
    console.log(`[MQTT Broker] Client connected: ${client ? client.id : 'unknown'}`);
    if (onClientConnected && client) {
      onClientConnected(client.id);
    }
  });

  aedes.on('clientDisconnect', (client) => {
    console.log(`[MQTT Broker] Client disconnected: ${client ? client.id : 'unknown'}`);
    if (onClientDisconnected && client) {
      onClientDisconnected(client.id);
    }
  });

  aedes.on('publish', (packet, client) => {
    if (client && !packet.topic.startsWith('$SYS')) {
      // debug log without spamming too much
      // console.log(`[MQTT Broker] Published on ${packet.topic} by ${client.id}`);
    }
  });

  server.on('error', (err) => {
    console.error('[MQTT Broker Error]', err);
  });

  return aedes;
}

module.exports = {
  startBroker,
  getAedes: () => aedes
};

