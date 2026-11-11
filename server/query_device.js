/**
 * Device Feature Inspector
 * Sends 'params.get' to the biometric terminal over MQTT and dumps all enabled options
 */
const mqtt = require('mqtt');
const config = require('./src/config');

const MAC = process.argv[2] || config.DEFAULT_MAC;
const PORT = process.argv[3] || config.MQTT_PORT;
const BROKER_URL = `mqtt://127.0.0.1:${PORT}`;

console.log(`=======================================================`);
console.log(`  Biometric Device Feature Inspector`);
console.log(`  Target MAC: ${MAC}`);
console.log(`  Broker URL: ${BROKER_URL}`);
console.log(`=======================================================`);

const client = mqtt.connect(BROKER_URL, {
  clientId: 'device_inspector_' + Math.floor(Math.random() * 1000),
  clean: true
});

client.on('connect', () => {
  console.log(`[Connected] Subscribing to device responses on iot/pub/0101/${MAC}/ ...`);
  client.subscribe(`iot/pub/0101/${MAC}/`, (err) => {
    if (err) {
      console.error('[Error] Subscription failed:', err);
      process.exit(1);
    }

    const querySn = 999;
    const packet = {
      sn: querySn,
      method: 'params.get',
      account: '',
      password: '',
      mac: MAC,
      params: {}
    };

    console.log(`[Sent] params.get command to iot/sub/0101/${MAC}/ ...`);
    client.publish(`iot/sub/0101/${MAC}/`, JSON.stringify(packet));

    // Wait 8 seconds for response
    setTimeout(() => {
      console.log('\n[Timeout] No response received within 8 seconds. Is the device connected to this port?');
      client.end();
      process.exit(0);
    }, 8000);
  });
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    if (data.method === 'params.get' || (data.sn === 999 && data.data)) {
      console.log('\n================ DEVICE PARAMETERS RECEIVED ================');
      console.log(JSON.stringify(data.data, null, 2));
      console.log('============================================================\n');

      const d = data.data || {};
      console.log('--- FEATURE CAPABILITY REPORT ---');
      console.log(`• Face Recognition:     ${d.enable_face ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`• IC Card Reader:       ${d.enable_iccard ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`• Fingerprint Scanner:  ${d.enable_finger ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`• Camera QR Scanner:    ${d.enable_qrcode_reader ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`• Screen QR Display:    ${d.enable_display_qrcode ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`• Keypad/Common PIN:    ${d.enable_common_pwd ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`• Personal Password:    ${d.enable_user_pwd ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`• Remote Door Unlock:   ${d.enable_remote_open !== undefined ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}`);
      console.log(`• Voice / TTS Prompts:  ${d.enable_tts ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`• Volume Level:         ${d.volume !== undefined ? d.volume + '%' : 'N/A'}`);
      console.log(`• Face Threshold Score: ${d.recognize_score !== undefined ? d.recognize_score : 'N/A'}`);
      console.log('---------------------------------');
      client.end();
      process.exit(0);
    }
  } catch (e) {
    console.error('Error parsing response:', e);
  }
});

