const config = require('./config');

const PASS_TYPES = {
  0: 'Card Swipe',
  1: 'Mobile Remote Unlock',
  4: 'Face Recognition',
  8: 'Backend Remote Unlock',
  9: 'Fingerprint',
  11: 'Close Range Open',
  12: 'Bluetooth',
  13: 'Fire Alarm',
  14: 'Anti-Theft Alarm',
  15: 'Door Sensor Alarm',
  16: 'Snapshot Record',
  21: 'ID Card Swipe'
};

class DeviceManager {
  constructor() {
    this.aedes = null;
    this.devices = new Map();
    this.pendingRequests = new Map(); // sn -> { resolve, reject, timer }
    this.snCounter = 1;
    this.logs = [];
    this.sseClients = new Set();
    this.knownAccounts = new Map(); // mac -> Set of accounts
    this.adminAccounts = new Map(); // mac -> admin account string (e.g. '2324')
    this.userCache = new Map(); // mac -> array of active user objects
    this.activeFetchPromises = new Map(); // mac -> Promise
    this.lastPunchUserId = new Map(); // mac -> numeric userId of last punch
  }

  addAdminAccount(mac, account) {
    if (!mac || !account) return;
    this.adminAccounts.set(mac.toUpperCase(), String(account).trim());
  }

  getAdminAccount(mac) {
    const cleanMac = (mac || '').toUpperCase();
    if (this.adminAccounts.has(cleanMac)) {
      return this.adminAccounts.get(cleanMac);
    }
    const known = this.knownAccounts.get(cleanMac);
    if (known && known.size > 0) {
      return Array.from(known)[0];
    }
    return '';
  }

  addKnownAccount(mac, account) {
    if (!mac || !account) return;
    const cleanMac = mac.toUpperCase();
    const cleanAcc = String(account).trim();
    if (!cleanAcc) return;
    if (!this.knownAccounts.has(cleanMac)) {
      this.knownAccounts.set(cleanMac, new Set());
    }
    this.knownAccounts.get(cleanMac).add(cleanAcc);
  }

  getKnownAccount(mac) {
    const cleanMac = (mac || '').toUpperCase();
    return this.getAdminAccount(cleanMac);
  }

  async ensureRemoteOpenEnabled(mac) {
    try {
      await this.sendCommand(mac, 'params.set', { enable_remote_open: 7 }, 4000);
      console.log(`[DeviceManager] Ensured enable_remote_open: 7 on ${mac}`);
    } catch (e) {
      console.warn(`[DeviceManager] Could not set enable_remote_open on ${mac}:`, e.message);
    }
  }

  init(aedesInstance) {
    this.aedes = aedesInstance;
    console.log('[DeviceManager] Attached to in-process Aedes MQTT Broker');

    this.aedes.on('client', (client) => {
      const clientId = client.id;
      console.log(`[DeviceManager] Client connected: ${clientId}`);
      if (clientId && clientId !== 'antigravity_backend') {
        const dev = this.devices.get(clientId) || this.registerDevice(clientId);
        dev.status = 'online';
        dev.lastSeen = Date.now();
        this.devices.set(clientId, dev);
        this.broadcastEvent({ type: 'device_connected', mac: clientId, device: dev });
      }
    });

    this.aedes.on('clientDisconnect', (client) => {
      const clientId = client.id;
      console.log(`[DeviceManager] Client disconnected: ${clientId}`);
      if (clientId && this.devices.has(clientId)) {
        const dev = this.devices.get(clientId);
        dev.status = 'offline';
        this.devices.set(clientId, dev);
        this.broadcastEvent({ type: 'device_disconnected', mac: clientId, device: dev });
      }
    });

    this.aedes.on('publish', (packet, client) => {
      if (packet.topic.startsWith('$SYS')) return;
      if (packet.topic.startsWith('iot/pub/')) {
        this.handleIncomingMessage(packet.topic, packet.payload);
      }
    });

    // Check device heartbeats every 30s
    setInterval(() => {
      const now = Date.now();
      for (const [mac, dev] of this.devices.entries()) {
        if (dev.lastSeen && now - dev.lastSeen > 90000) {
          if (dev.status === 'online') {
            dev.status = 'offline';
            this.broadcastEvent({ type: 'device_offline', mac, device: dev });
          }
        }
      }
    }, 30000);
  }

  getNextSn() {
    if (this.snCounter > 999999) this.snCounter = 1;
    return this.snCounter++;
  }

  registerDevice(mac, extraInfo = {}) {
    if (!mac) return null;
    const cleanMac = mac.toUpperCase();
    const existing = this.devices.get(cleanMac) || {};
    const updated = {
      mac: cleanMac,
      ip: extraInfo.ip || existing.ip || 'Unknown',
      status: extraInfo.status || existing.status || 'online',
      hardwareType: extraInfo.hardware_type || existing.hardwareType || 'JSD Biometric Terminal',
      softwareVersion: extraInfo.software_version || existing.softwareVersion || 'V6.0',
      lastSeen: extraInfo.lastSeen || Date.now(),
      ...existing,
      ...extraInfo
    };
    this.devices.set(cleanMac, updated);
    return updated;
  }

  handleIncomingMessage(topic, payload) {
    try {
      const data = JSON.parse(payload.toString());
      const mac = (data.mac || this.extractMacFromTopic(topic) || '').toUpperCase();
      const method = data.method;
      const sn = data.sn;

      if (mac) {
        const dev = this.devices.get(mac) || this.registerDevice(mac);
        dev.status = 'online';
        dev.lastSeen = Date.now();
        this.devices.set(mac, dev);
      }

      console.log(`[DeviceManager] Inbound [${topic}] Method: ${method || 'response'} SN: ${sn}`);

      // Handle matching pending request response
      if (sn && this.pendingRequests.has(sn)) {
        const { resolve, timer } = this.pendingRequests.get(sn);
        clearTimeout(timer);
        this.pendingRequests.delete(sn);
        resolve(data);
        return;
      }

      // Handle spontaneous requests/events initiated by device
      switch (method) {
        case 'dev.heartbeat':
          this.handleHeartbeat(mac, data);
          break;
        case 'dev.register':
          this.handleRegistration(mac, data, topic);
          break;
        case 'post.record':
          this.handlePunchRecord(mac, data, topic);
          break;
        case 'network_info.report':
          this.handleNetworkReport(mac, data);
          break;
        default:
          console.log(`[DeviceManager] Inbound event: ${method}`);
      }
    } catch (err) {
      console.error('[DeviceManager] Failed to parse inbound packet:', err.message);
    }
  }

  extractMacFromTopic(topic) {
    const parts = topic.split('/');
    if (parts.length >= 4) {
      return parts[3];
    }
    return null;
  }

  handleHeartbeat(mac, packet) {
    const params = packet.params || {};
    const dev = this.devices.get(mac) || this.registerDevice(mac);
    dev.status = 'online';
    dev.lastSeen = Date.now();
    if (params.ip) dev.ip = params.ip;
    if (params.network_type !== undefined) dev.networkType = params.network_type;
    if (params.sim_ccid) dev.simCcid = params.sim_ccid;
    this.devices.set(mac, dev);

    this.broadcastEvent({
      type: 'heartbeat',
      mac,
      ip: dev.ip,
      timestamp: dev.lastSeen
    });
  }

  handleRegistration(mac, packet, topic) {
    const params = packet.params || {};
    const dev = this.registerDevice(mac, {
      status: 'online',
      lastSeen: Date.now(),
      ip: params.device_ip || 'Unknown',
      hardwareType: params.hardware_type || 'JSD Biometric Terminal',
      softwareVersion: params.software_version || 'V6.0',
      chipType: params.chip_type,
      enableFinger: params.enable_finger,
      enableLift: params.enable_lift,
      enableVoip: params.enable_voip
    });

    const resp = {
      sn: packet.sn,
      method: 'dev.register',
      mac: mac,
      data: {
        device_status: 1,
        device_name: 'eSSL Biometric',
        device_type: '0'
      }
    };
    this.publishToDevice(mac, resp);

    this.broadcastEvent({
      type: 'device_registered',
      mac,
      device: dev
    });
  }

  handlePunchRecord(mac, packet, topic) {
    const params = packet.params || {};
    const passTypeName = PASS_TYPES[params.pass_type] || (params.pass_type === 4 ? 'Face Recognition' : 'Card Swipe');
    const logItem = {
      id: params.id || Date.now(),
      mac,
      userId: params.user_id,
      account: params.account,
      name: params.name || 'Unknown',
      cardNo: params.card_no || '',
      passType: params.pass_type,
      passTypeName,
      passStatus: params.pass_status === 0 ? 'Allowed' : 'Denied',
      score: params.score,
      snapshot: params.snapshot_base64 ? `data:image/jpeg;base64,${params.snapshot_base64}` : null,
      timestamp: params.created_at ? new Date(params.created_at * 1000).toISOString() : new Date().toISOString()
    };

    if (params.account) {
      this.addKnownAccount(mac, params.account);
      this.addAdminAccount(mac, params.account);
    }
    if (params.user_id) {
      this.lastPunchUserId.set(mac, params.user_id);
    }
    console.log(`[DeviceManager] Punch record from ${mac}: account="${params.account}", userId=${params.user_id}, name="${params.name}"`);

    this.logs.unshift(logItem);
    if (this.logs.length > 500) this.logs.pop();

    const resp = {
      sn: packet.sn,
      method: 'post.record',
      mac: mac,
      data: {
        result: 0,
        id: params.id || 1
      }
    };
    this.publishToDevice(mac, resp);

    this.broadcastEvent({
      type: 'punch_record',
      record: logItem
    });
  }

  handleNetworkReport(mac, packet) {
    const params = packet.params || {};
    const dev = this.devices.get(mac) || this.registerDevice(mac);
    if (params.ip) dev.ip = params.ip;
    if (params.network_type !== undefined) dev.networkType = params.network_type;
    this.devices.set(mac, dev);
  }

  publishToDevice(mac, payloadObj) {
    if (!this.aedes) {
      console.error('[DeviceManager] Aedes broker is not attached!');
      return false;
    }
    const topic = `iot/sub/0101/${mac}/`;
    const str = JSON.stringify(payloadObj);
    console.log(`[DeviceManager] Outbound [${topic}] -> SN: ${payloadObj.sn} Method: ${payloadObj.method}`);

    this.aedes.publish(
      {
        topic,
        payload: Buffer.from(str),
        qos: 0,
        retain: false
      },
      (err) => {
        if (err) console.error('[DeviceManager] Publish error:', err);
      }
    );
    return true;
  }

  sendCommand(mac, method, params = {}, timeoutMs = 8000, account = '') {
    return new Promise((resolve, reject) => {
      const cleanMac = mac.toUpperCase();
      const sn = this.getNextSn();
      const acc = (account !== null && account !== undefined) ? account : '';
      const packet = {
        sn,
        method,
        account: acc,
        password: '',
        mac: cleanMac,
        params
      };

      const timer = setTimeout(() => {
        this.pendingRequests.delete(sn);
        reject(new Error(`Command '${method}' to device ${cleanMac} timed out. Is device connected to MQTT port ${config.MQTT_PORT}?`));
      }, timeoutMs);

      this.pendingRequests.set(sn, { resolve, reject, timer });
      this.publishToDevice(cleanMac, packet);
    });
  }

  // --- High-level actions ---

  async openDoor(mac) {
    const cleanMac = mac.toUpperCase();

    // Ensure remote door opening is enabled in device hardware settings
    await this.ensureRemoteOpenEnabled(cleanMac);

    // Get candidate accounts that actually exist on this device
    const knownSet = this.knownAccounts.get(cleanMac);
    const candidateAccounts = Array.from(new Set([
      ...(knownSet ? Array.from(knownSet) : []),
      '1120',
      '2324',
      'admin',
      ''
    ]));

    let lastError = null;
    for (const acc of candidateAccounts) {
      try {
        console.log(`[DeviceManager] Unlocking door on ${cleanMac} with account "${acc}"...`);
        const res = await this.sendCommand(cleanMac, 'door.open', { type: 1 }, 6000, acc);
        if (res.data && res.data.result === 0) {
          // Success! Save working account as preferred
          if (acc) this.addKnownAccount(cleanMac, acc);
          this.logs.unshift({
            id: Date.now(),
            mac: cleanMac,
            userId: 'Admin',
            account: acc || 'admin',
            name: 'Web UI Admin',
            cardNo: '',
            passType: 8,
            passTypeName: 'Remote Unlock',
            passStatus: 'Allowed',
            score: null,
            snapshot: null,
            timestamp: new Date().toISOString()
          });
          this.broadcastEvent({
            type: 'door_opened',
            mac: cleanMac,
            timestamp: new Date().toISOString()
          });
          return { success: true, raw: res };
        }
        lastError = res.data?.result;
      } catch (err) {
        lastError = err.message;
      }
    }
    throw new Error(`Device rejected door open (code: ${lastError})`);
  }

  async getUsers(mac, page = 1, pageSize = 100) {
    const cleanMac = mac.toUpperCase();
    if (this.activeFetchPromises.has(cleanMac)) {
      console.log(`[DeviceManager] Fetch already in progress for ${cleanMac}. Returning active query.`);
      return this.activeFetchPromises.get(cleanMac);
    }
    const p = this._executeGetUsers(cleanMac, page, pageSize)
      .finally(() => this.activeFetchPromises.delete(cleanMac));
    this.activeFetchPromises.set(cleanMac, p);
    return p;
  }

  async _executeGetUsers(cleanMac, page = 1, pageSize = 100) {
    let allRaw = [];
    const safePageSize = 100;

    // Primary query account is '' (server superuser), followed by fallback accounts
    const candidateAccounts = ['', 'admin'];

    let res = null;
    let explicitTotal = null;

    // Helper to extract list and any explicit total count from device response
    const parseQueryResponse = (queryResponse) => {
      if (!queryResponse || !queryResponse.data) return null;
      let list = [];
      let total = null;

      if (Array.isArray(queryResponse.data)) {
        list = queryResponse.data;
        if (queryResponse.total !== undefined && typeof queryResponse.total === 'number') {
          total = queryResponse.total;
        }
      } else if (Array.isArray(queryResponse.data.persons)) {
        list = queryResponse.data.persons;
        total = queryResponse.data.total !== undefined ? queryResponse.data.total : queryResponse.total;
      }

      return { list, total };
    };

    // 1. Try querying with operator accounts
    for (const acc of candidateAccounts) {
      try {
        console.log(`[DeviceManager] Querying person.get on ${cleanMac} with operator account "${acc}"...`);
        const queryRes = await this.sendCommand(cleanMac, 'person.get', {
          page: 1,
          page_size: safePageSize,
          with_image: false,
          user_id: 0
        }, 6000, acc);

        console.log(`[DeviceManager] person.get (acc: "${acc}") response:`, JSON.stringify(queryRes.data));
        const parsed = parseQueryResponse(queryRes);
        if (parsed && parsed.list.length > 0) {
          allRaw = parsed.list;
          explicitTotal = parsed.total;
          res = queryRes;
          if (acc) {
            this.addAdminAccount(cleanMac, acc);
            this.addKnownAccount(cleanMac, acc);
          }
          break;
        } else if (acc === '' && (queryRes.data?.result === 8 || (Array.isArray(queryRes.data) && queryRes.data.length === 0))) {
          // Device explicitly confirmed 0 users (result: 8 = "No personnel data found")
          console.log(`[DeviceManager] Superuser confirmed 0 users (result: ${queryRes.data?.result ?? 0})`);
          this.userCache.set(cleanMac, []);
          return {
            total: 0,
            rawTotal: 0,
            persons: []
          };
        }
      } catch (err) {
        console.warn(`[DeviceManager] Query with account "${acc}" failed:`, err.message);
      }
    }

    // 1b. ONLY if table query failed to get any response (!res), query target IDs directly!
    if (!res && allRaw.length === 0) {
      const lastPunched = this.lastPunchUserId.get(cleanMac);
      const targetIds = Array.from(new Set([lastPunched, 20, 1, 2])).filter((id) => id !== undefined && id !== null && id > 0);
      console.log(`[DeviceManager] Full table returned 0. Querying target IDs [${targetIds.join(', ')}] directly on ${cleanMac}...`);
      for (const targetId of targetIds) {
        try {
          const uRes = await this.sendCommand(cleanMac, 'person.get', {
            user_id: targetId,
            page: 1,
            page_size: 10,
            with_image: false
          }, 3000, '');
          console.log(`[DeviceManager] user_id: ${targetId} response:`, JSON.stringify(uRes.data));
          const parsed = parseQueryResponse(uRes);
          if (parsed && parsed.list.length > 0) {
            allRaw.push(...parsed.list);
            res = uRes;
            const u = parsed.list[0];
            if (u && u.account) {
              this.addAdminAccount(cleanMac, u.account);
              this.addKnownAccount(cleanMac, u.account);
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // 2. Multi-page pagination:
    // If Page 1 returned safePageSize (100) items, the page buffer was completely full,
    // which means there are more pages of users on the device!
    const shouldPaginate = res && (
      allRaw.length === safePageSize ||
      (explicitTotal !== null && explicitTotal > allRaw.length)
    );

    if (shouldPaginate) {
      let pageNum = 2;
      const opAccount = this.getAdminAccount(cleanMac);
      const maxPages = 50; // Allows up to 5,000 users

      while (pageNum <= maxPages) {
        try {
          console.log(`[DeviceManager] Fetching page ${pageNum} from ${cleanMac} (current loaded: ${allRaw.length})...`);
          await new Promise((r) => setTimeout(r, 150)); // Gentle throttle for device MQTT buffer

          const nextRes = await this.sendCommand(cleanMac, 'person.get', {
            page: pageNum,
            page_size: safePageSize,
            with_image: false,
            user_id: 0
          }, 6000, '');

          const parsed = parseQueryResponse(nextRes);
          const nextList = parsed ? parsed.list : [];

          if (!nextList || nextList.length === 0) {
            console.log(`[DeviceManager] Page ${pageNum} returned 0 records. End of user table reached.`);
            break;
          }

          allRaw = allRaw.concat(nextList);
          console.log(`[DeviceManager] Page ${pageNum} returned ${nextList.length} records. Total so far: ${allRaw.length}`);

          // If this page returned fewer records than the maximum page size, it was the final page
          if (nextList.length < safePageSize) {
            break;
          }

          // If device gave an explicit total and we reached it, stop
          if (explicitTotal !== null && allRaw.length >= explicitTotal) {
            break;
          }

          pageNum++;
        } catch (err) {
          console.warn(`[DeviceManager] Page ${pageNum} error or timeout:`, err.message);
          break;
        }
      }
    }

    // 3. Fallback: ONLY if table query failed to get any response from device (!res)
    if (!res && allRaw.length === 0) {
      console.log(`[DeviceManager] Fallback: probing individual IDs 1..10 on ${cleanMac}...`);
      for (let probeId = 1; probeId <= 10; probeId++) {
        try {
          const probeRes = await this.sendCommand(cleanMac, 'person.get', {
            user_id: probeId,
            page: 1,
            page_size: 10
          }, 1500, '');
          const pList = probeRes.data && Array.isArray(probeRes.data.persons)
            ? probeRes.data.persons
            : (Array.isArray(probeRes.data) ? probeRes.data : []);
          if (pList.length > 0 && pList[0].id) {
            const p = pList[0];
            const hasName = typeof p.name === 'string' && p.name.trim().length > 0;
            const hasAccount = typeof p.account === 'string' && p.account.trim().length > 0;
            const hasFace = Number(p.face_cnt) > 0;
            const hasCard = (typeof p.card_no === 'string' && p.card_no.trim().length > 0) || Number(p.card_cnt) > 0;
            if (hasName || hasAccount || hasFace || hasCard) {
              allRaw.push(p);
              if (p.account) {
                this.addAdminAccount(cleanMac, p.account);
                this.addKnownAccount(cleanMac, p.account);
              }
            }
          }
        } catch (e) {
          // ignore timeout on missing ID
        }
      }
      explicitTotal = allRaw.length;
    }

    // Filter out uninitialized firmware memory slots & keep genuinely enrolled users
    const activePersons = allRaw.map((p) => {
      if (!p) return null;
      const name = (typeof p.name === 'string' && p.name.trim()) || '';
      const account = (typeof p.account === 'string' && p.account.trim()) || '';
      const card = (typeof p.card_no === 'string' && p.card_no.trim()) || '';
      const hasFace = Number(p.face_cnt) > 0;
      const hasFinger = Number(p.finger_cnt) > 0;
      const hasPwd = Number(p.pwd_cnt) > 0;
      const hasCard = card.length > 0 || Number(p.card_cnt) > 0;

      // An uninitialized hardware slot has no name, no account, and no credentials
      if (!name && !account && !hasCard && !hasFace && !hasFinger && !hasPwd) {
        return null;
      }

      return {
        ...p,
        name: name || account || `User #${p.id}`,
        account: account || name || String(p.id)
      };
    }).filter(Boolean);

    // Deduplicate by account / ID
    const seenAccounts = new Set();
    const uniquePersons = [];
    for (const p of activePersons) {
      const key = (p.account && String(p.account).trim()) || String(p.id);
      if (!seenAccounts.has(key)) {
        seenAccounts.add(key);
        uniquePersons.push(p);
      }
    }

    if (uniquePersons.length > 0) {
      const validAccs = uniquePersons.map((p) => p.account).filter(Boolean);
      this.knownAccounts.set(cleanMac, new Set(validAccs));

      const adminUser = uniquePersons.find((p) => Number(p.type) === 240 && p.account) || uniquePersons[0];
      if (adminUser && adminUser.account) {
        this.addAdminAccount(cleanMac, adminUser.account);
      }
      this.userCache.set(cleanMac, uniquePersons);
    } else {
      this.userCache.set(cleanMac, []);
    }

    console.log(`[DeviceManager] Successfully loaded ${uniquePersons.length} users from ${cleanMac} (total raw: ${allRaw.length})`);

    return {
      total: uniquePersons.length,
      rawTotal: allRaw.length,
      persons: uniquePersons
    };
  }

  async addUser(mac, { name, account, cardNo, faceBase64, isAdmin = false }) {
    if (!name || !name.trim()) throw new Error('Name is required');
    const acc = (account && account.trim()) ? account.trim() : `u_${Date.now().toString().slice(-6)}`;

    // Clean base64 image (remove data:image/...;base64, prefix if present)
    let cleanFaceBase64 = '';
    if (faceBase64 && typeof faceBase64 === 'string') {
      cleanFaceBase64 = faceBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();
    }

    const personPayload = {
      name: name.trim(),
      account: acc,
      type: isAdmin ? '240' : '0', // '0' = Regular user (capacity of 10,000); '240' = Administrator (firmware limit of 3)
      card_no: cardNo ? cardNo.trim() : '',
      auth_mask: '255',
      time_seg: '1'
    };

    if (cleanFaceBase64) {
      personPayload.face_img_base64 = cleanFaceBase64;
    }

    console.log(`[DeviceManager] 1. Adding user metadata to ${mac}:`, {
      name: personPayload.name,
      account: personPayload.account,
      card_no: personPayload.card_no,
      has_photo: !!cleanFaceBase64
    });

    const res = await this.sendCommand(mac, 'person.add', {
      persons: [personPayload]
    }, 12000);

    console.log(`[DeviceManager] person.add response:`, res.data);

    // Parse person.add response
    let personList = [];
    if (Array.isArray(res.data)) {
      personList = res.data;
    } else if (res.data && Array.isArray(res.data.data)) {
      personList = res.data.data;
    } else if (res.data && Array.isArray(res.data.persons)) {
      personList = res.data.persons;
    } else if (res.data && typeof res.data === 'object') {
      personList = [res.data];
    }

    const firstPerson = personList[0] || {};
    const createdUserId = firstPerson.id || 0;
    const resultStatus = firstPerson.result !== undefined ? firstPerson.result : 0;

    if (resultStatus !== 0) {
      const ERROR_MAP = {
        1: 'Operation failed on device.',
        10: 'Maximum number of administrators exceeded.',
        11: 'Device has no face recognition algorithm enabled.',
        12: 'No face detected in photo. Please ensure the face is front-facing, well-lit, and not cropped or blurry.',
        13: 'Face feature extraction failed. Try a clearer or higher-resolution photo.',
        14: 'Device failed to save face image.'
      };
      const detail = ERROR_MAP[resultStatus] || `Device rejected user addition with error code ${resultStatus}.`;
      throw new Error(detail);
    }

    this.addKnownAccount(mac, acc);
    this.broadcastEvent({ type: 'users_updated', mac });

    return {
      success: true,
      data: res.data,
      account: acc,
      userId: createdUserId,
      faceEnrolled: !!cleanFaceBase64
    };
  }

  async deleteUser(mac, userId, account = '') {
    const cleanAccount = (account && typeof account === 'string') ? account.trim() : '';
    const numericId = Number(userId);

    // CRITICAL SAFETY GUARD: In Jasta firmware, an empty filter {} deletes ALL users!
    if ((!numericId || isNaN(numericId) || numericId <= 0) && !cleanAccount) {
      throw new Error('Refusing to delete: Valid numeric User ID or Account is required to prevent accidental bulk wipe.');
    }

    const delParams = {};
    if (numericId && !isNaN(numericId) && numericId > 0) {
      delParams.ids = [numericId];
    }
    if (cleanAccount) {
      delParams.account = cleanAccount;
    }

    console.log(`[DeviceManager] Safely deleting single user from ${mac} with params:`, delParams);

    const res = await this.sendCommand(mac, 'person.del', delParams);
    console.log(`[DeviceManager] person.del response:`, res.data);

    if (this.userCache.has(mac.toUpperCase())) {
      const remaining = this.userCache.get(mac.toUpperCase()).filter((u) => {
        const idMatches = numericId && Number(u.id) === numericId;
        const accMatches = cleanAccount && u.account === cleanAccount;
        return !idMatches && !accMatches;
      });
      this.userCache.set(mac.toUpperCase(), remaining);
    }

    this.broadcastEvent({ type: 'users_updated', mac });

    return { success: true, data: res.data };
  }

  async clearAllUsers(mac) {
    const cleanMac = mac.toUpperCase();
    console.log(`[DeviceManager] Clearing all users from ${cleanMac} using superuser`);
    const res = await this.sendCommand(cleanMac, 'person.clear', {}, 8000, '');
    console.log(`[DeviceManager] person.clear response:`, res.data);

    // Reset known accounts and user cache in memory
    this.knownAccounts.set(cleanMac, new Set());
    this.adminAccounts.delete(cleanMac);
    this.userCache.set(cleanMac, []);
    this.lastPunchUserId.delete(cleanMac);

    this.broadcastEvent({ type: 'users_updated', mac: cleanMac });

    return { success: true, data: res.data };
  }

  async getDeviceParams(mac) {
    console.log(`[DeviceManager] Fetching parameters from ${mac}`);
    const res = await this.sendCommand(mac, 'params.get', {});
    console.log(`[DeviceManager] params.get response:`, res.data);
    return res.data;
  }

  // --- SSE broadcasting ---

  subscribeSSE(res) {
    this.sseClients.add(res);
    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  broadcastEvent(eventData) {
    const payload = `data: ${JSON.stringify(eventData)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch (err) {
        this.sseClients.delete(client);
      }
    }
  }

  getDevicesList() {
    return Array.from(this.devices.values());
  }

  getLogs() {
    return this.logs;
  }
}

module.exports = new DeviceManager();
