/**
 * Simulated Biometric Device (Jasta MQTT Protocol)
 * Device MAC: 2002F43005D3
 * Connects to mqtt://127.0.0.1:1884
 */

const mqtt = require('mqtt');
const MAC = '2002F43005D3';
const BROKER_URL = 'mqtt://127.0.0.1:1884';

const SUB_TOPIC = `iot/sub/0101/${MAC}/`;
const PUB_TOPIC = `iot/pub/0101/${MAC}/`;

console.log(`[Simulator] Starting mock device for MAC: ${MAC}`);
const client = mqtt.connect(BROKER_URL, {
  clientId: MAC,
  clean: true
});

const mockUsers = [
  {
    id: 1,
    name: 'Admin User',
    account: 'admin_001',
    card_no: 'A1B2C3D4',
    type: 240,
    face_cnt: 1,
    card_cnt: 1,
    finger_cnt: 0
  },
  {
    id: 2,
    name: 'Sarah Connor',
    account: 'sarah_c',
    card_no: '87654321',
    type: 240,
    face_cnt: 0,
    card_cnt: 1,
    finger_cnt: 1
  }
];

client.on('connect', () => {
  console.log(`[Simulator] Connected to MQTT Broker at ${BROKER_URL}`);

  // 1. Subscribe to server commands
  client.subscribe(SUB_TOPIC, (err) => {
    if (err) console.error('[Simulator] Subscribe error:', err);
    else console.log(`[Simulator] Subscribed to commands on: ${SUB_TOPIC}`);
  });

  // 2. Send initial registration
  const regPayload = {
    sn: 100,
    method: 'dev.register',
    mac: MAC,
    params: {
      device_type: 0,
      device_ip: '192.168.0.150',
      hardware_type: 'JSD-X50',
      software_version: 'V6.0',
      chip_type: 'ssd222d',
      enable_finger: true,
      enable_lift: false,
      enable_voip: true
    }
  };
  client.publish(PUB_TOPIC, JSON.stringify(regPayload));
  console.log(`[Simulator] Published dev.register`);

  // 3. Send periodic heartbeat
  setInterval(() => {
    const hbPayload = {
      sn: Math.floor(Math.random() * 10000),
      method: 'dev.heartbeat',
      mac: MAC,
      params: {
        timestamp: Math.floor(Date.now() / 1000),
        ip: '192.168.0.150',
        network_type: 0
      }
    };
    client.publish(PUB_TOPIC, JSON.stringify(hbPayload));
    console.log(`[Simulator] Sent heartbeat`);
  }, 15000);
});

client.on('message', (topic, message) => {
  try {
    const cmd = JSON.parse(message.toString());
    console.log(`[Simulator] Received command from server -> Method: ${cmd.method} SN: ${cmd.sn}`);

    if (cmd.method === 'door.open') {
      console.log('>>> [Simulator] BEEP! Door unlocked! <<<');
      const resp = {
        sn: cmd.sn,
        method: 'door.open',
        mac: MAC,
        data: {
          result: 0
        }
      };
      client.publish(PUB_TOPIC, JSON.stringify(resp));
    } else if (cmd.method === 'person.get') {
      const resp = {
        sn: cmd.sn,
        method: 'person.get',
        mac: MAC,
        data: {
          total: mockUsers.length,
          persons: mockUsers
        }
      };
      client.publish(PUB_TOPIC, JSON.stringify(resp));
    } else if (cmd.method === 'person.add') {
      const newPersons = cmd.params?.persons || [];
      for (const p of newPersons) {
        mockUsers.push({
          id: mockUsers.length + 1,
          name: p.name,
          account: p.account,
          card_no: p.card_no,
          type: Number(p.type) || 240,
          face_cnt: 0,
          card_cnt: p.card_no ? 1 : 0,
          finger_cnt: 0
        });
      }
      const resp = {
        sn: cmd.sn,
        method: 'person.add',
        mac: MAC,
        data: [
          {
            id: mockUsers.length,
            account: newPersons[0]?.account || '',
            result: 0
          }
        ]
      };
      client.publish(PUB_TOPIC, JSON.stringify(resp));
      console.log(`[Simulator] Added user successfully. Total users: ${mockUsers.length}`);
    } else if (cmd.method === 'person.del') {
      const ids = cmd.params?.ids || [];
      const idx = mockUsers.findIndex((u) => ids.includes(u.id));
      if (idx !== -1) mockUsers.splice(idx, 1);
      const resp = {
        sn: cmd.sn,
        method: 'person.del',
        mac: MAC,
        data: [
          {
            id: ids[0] || 1,
            result: 0
          }
        ]
      };
      client.publish(PUB_TOPIC, JSON.stringify(resp));
      console.log(`[Simulator] Deleted user ID ${ids.join(',')}. Remaining: ${mockUsers.length}`);
    }
  } catch (err) {
    console.error('[Simulator] Error handling command:', err);
  }
});

