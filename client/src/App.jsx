import React, { useState, useEffect, useRef } from 'react';
import {
  Unlock,
  Users,
  UserPlus,
  Trash2,
  RefreshCw,
  Activity,
  Wifi,
  WifiOff,
  CreditCard,
  Smile,
  CheckCircle2,
  AlertCircle,
  Info,
  Camera,
  X,
  Upload,
  Search,
  FolderUp,
  Download,
  UploadCloud,
  Check,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function App() {
  const [devices, setDevices] = useState([]);
  const [selectedMac, setSelectedMac] = useState('2002F43005D3');
  const [customMacInput, setCustomMacInput] = useState('');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [serverInfo, setServerInfo] = useState(null);

  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isOpeningDoor, setIsOpeningDoor] = useState(false);
  const [doorMsg, setDoorMsg] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Photo Import State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentId: '' });
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkFilter, setBulkFilter] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const bulkFolderInputRef = useRef(null);
  const bulkFilesInputRef = useRef(null);
  const cancelBulkRef = useRef(false);
  const isProcessingBulkRef = useRef(false);

  // Add User Modal State (ID, Name, Card No, Face Upload - No PIN/QR)
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [account, setAccount] = useState('');
  const [cardNo, setCardNo] = useState('');
  const [faceBase64, setFaceBase64] = useState('');
  const [facePreview, setFacePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  // Device Features Modal
  const [deviceParams, setDeviceParams] = useState(null);
  const [showParamsModal, setShowParamsModal] = useState(false);
  const [isLoadingParams, setIsLoadingParams] = useState(false);

  // Clear All Users State
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const fetchDeviceParams = async () => {
    const mac = selectedMac || customMacInput.trim();
    if (!mac) return;
    setIsLoadingParams(true);
    setShowParamsModal(true);
    try {
      const res = await fetch(`${API_BASE}/api/devices/${mac}/params`);
      const data = await res.json();
      if (data.success) {
        setDeviceParams(data.params);
      } else {
        setDeviceParams({ error: data.error || 'Failed to fetch parameters' });
      }
    } catch (e) {
      setDeviceParams({ error: e.message || 'Network error' });
    } finally {
      setIsLoadingParams(false);
    }
  };

  // Fetch server info
  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setServerInfo(data);
      }
    } catch (e) {
      console.error('Failed to fetch server info', e);
    }
  };

  // Fetch device list
  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/devices`);
      if (res.ok) {
        const list = await res.json();
        setDevices(list);
        // If current selectedMac is not set, select the first device
        if (list.length > 0 && !selectedMac) {
          setSelectedMac(list[0].mac);
        }
      }
    } catch (e) {
      console.error('Failed to fetch devices', e);
    }
  };

  // Fetch users on device
  const fetchUsers = async () => {
    const mac = selectedMac || customMacInput.trim();
    if (!mac) return;
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE}/api/devices/${mac}/users`);
      const data = await res.json();
      if (data.success && Array.isArray(data.persons)) {
        setUsers(data.persons);
      } else if (data.error) {
        console.warn('Fetch users returned error:', data.error);
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Open Door
  const handleOpenDoor = async () => {
    const mac = selectedMac || customMacInput.trim();
    if (!mac) return;
    setIsOpeningDoor(true);
    setDoorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/devices/${mac}/open`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDoorMsg({ type: 'success', text: 'Door unlocked!' });
      } else {
        setDoorMsg({ type: 'error', text: data.error || 'Failed to open' });
      }
    } catch (e) {
      setDoorMsg({ type: 'error', text: e.message || 'Network error' });
    } finally {
      setIsOpeningDoor(false);
      setTimeout(() => setDoorMsg(null), 4000);
    }
  };

  // Target 96x160 proportion (0.6 ratio, 288x480) as required by device protocol
  // Preserves 100% of the face silhouette without cropping ears, chin, or cheeks
  const renderSmartPortraitCanvas = (img) => {
    const targetW = 288;
    const targetH = 480;

    // Scale to fit completely within 288x480 without cropping any part of the face
    const scale = Math.min(targetW / img.width, targetH / img.height);
    const drawW = Math.round(img.width * scale);
    const drawH = Math.round(img.height * scale);
    const drawX = Math.round((targetW - drawW) / 2);
    const drawY = Math.round((targetH - drawH) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    // Clean neutral background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);

    // High-fidelity bicubic smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(img, 0, 0, img.width, img.height, drawX, drawY, drawW, drawH);

    return canvas.toDataURL('image/jpeg', 0.90);
  };

  // Image file handler with auto-resize for Jasta device (96x160 aspect ratio)
  const handleImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPG or PNG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const compressedDataUrl = renderSmartPortraitCanvas(img);
        setFacePreview(compressedDataUrl);
        const rawBase64 = compressedDataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
        setFaceBase64(rawBase64);
        setErrorMsg('');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setFacePreview(null);
    setFaceBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Add User (ID, Name, Card No, Face Photo)
  const handleAddUser = async (e) => {
    e.preventDefault();
    const mac = selectedMac || customMacInput.trim();
    if (!mac) {
      setErrorMsg('No device selected');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Name is required');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE}/api/devices/${mac}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          account: account.trim(),
          cardNo: cardNo.trim(),
          faceBase64: faceBase64
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        const savedName = name.trim();
        setName('');
        setAccount('');
        setCardNo('');
        handleClearImage();

        const faceNote = data.result?.faceEnrolled ? ' with biometric Face recognition' : '';
        setToastMsg({
          type: 'success',
          text: `User "${savedName}" registered successfully${faceNote}!`
        });
        setTimeout(() => setToastMsg(null), 5000);

        setTimeout(fetchUsers, 800);
      } else {
        setErrorMsg(data.error || 'Failed to add user');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (id, userAccount) => {
    const mac = selectedMac || customMacInput.trim();
    if (!confirm(`Delete user #${id} (${userAccount || 'No account'})?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/devices/${mac}/users/${id}?account=${encodeURIComponent(userAccount || '')}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setTimeout(fetchUsers, 600);
      } else {
        alert(data.error || 'Failed to delete user');
      }
    } catch (e) {
      alert(e.message || 'Network error');
    }
  };

  // Clear All Users from Device
  const handleClearAll = async () => {
    const mac = selectedMac || customMacInput.trim();
    if (!mac) return;
    setIsClearingAll(true);
    try {
      const res = await fetch(`${API_BASE}/api/devices/${mac}/users/clear`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setUsers([]);
        setShowClearModal(false);
        setToastMsg({
          type: 'success',
          text: 'All users have been successfully cleared from the device!'
        });
        setTimeout(() => setToastMsg(null), 5000);
        setTimeout(fetchUsers, 1000);
      } else {
        setShowClearModal(false);
        setToastMsg({
          type: 'error',
          text: data.error || 'Failed to clear users from device'
        });
        setTimeout(() => setToastMsg(null), 6000);
      }
    } catch (e) {
      setShowClearModal(false);
      setToastMsg({
        type: 'error',
        text: e.message || 'Network error while clearing users'
      });
      setTimeout(() => setToastMsg(null), 6000);
    } finally {
      setIsClearingAll(false);
    }
  };

  // Export all available users to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!users || users.length === 0) {
      setToastMsg({
        type: 'error',
        text: 'No users available on device to export.'
      });
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }

    const exportData = users.map((u, idx) => ({
      'SL No': idx + 1,
      'User ID': u.id,
      'Name': u.name || '',
      'Account / Employee ID': u.account || '',
      'Card Number': u.card_no ? String(u.card_no) : '',
      'Role': Number(u.type) === 240 ? 'Administrator' : 'Normal User',
      'Face Registered': Number(u.face_cnt) > 0 ? 'Yes' : 'No',
      'Fingerprint': Number(u.finger_cnt) > 0 ? 'Yes' : 'No',
      'Password': Number(u.pwd_cnt) > 0 ? 'Yes' : 'No',
      'Time Segment': u.time_seg !== undefined ? u.time_seg : 1,
      'Device MAC': selectedMac || customMacInput.trim() || '2002F43005D3',
      'Created Date': u.created_at ? new Date(u.created_at * 1000).toLocaleString() : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-fit column widths
    worksheet['!cols'] = [
      { wch: 8 },  // SL No
      { wch: 10 }, // User ID
      { wch: 22 }, // Name
      { wch: 24 }, // Account / Employee ID
      { wch: 18 }, // Card Number
      { wch: 16 }, // Role
      { wch: 16 }, // Face Registered
      { wch: 14 }, // Fingerprint
      { wch: 12 }, // Password
      { wch: 14 }, // Time Segment
      { wch: 18 }, // Device MAC
      { wch: 22 }  // Created Date
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    const macStr = (selectedMac || customMacInput.trim() || 'Device').replace(/[^a-zA-Z0-9]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Device_Users_${macStr}_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);

    setToastMsg({
      type: 'success',
      text: `Successfully exported ${users.length} users to "${fileName}"!`
    });
    setTimeout(() => setToastMsg(null), 5000);
  };

  // --- Bulk Photo Processing Helpers ---

  const processImageFile = (file) => {
    return new Promise((resolve) => {
      const filename = file.name || '';
      const dotIndex = filename.lastIndexOf('.');
      const rawId = dotIndex > -1 ? filename.substring(0, dotIndex) : filename;
      const cleanId = rawId.trim();

      const isImg = file.type?.startsWith('image/') || /\.(jpe?g|png|webp|bmp)$/i.test(filename);
      if (!isImg) {
        return resolve({
          file,
          id: cleanId || filename,
          name: cleanId || filename,
          error: 'Skipped: Not a recognized image file',
          valid: false
        });
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const compressedDataUrl = renderSmartPortraitCanvas(img);
          const rawBase64 = compressedDataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

          resolve({
            file,
            id: cleanId,
            name: cleanId,
            previewUrl: compressedDataUrl,
            base64: rawBase64,
            valid: true
          });
        };
        img.onerror = () => {
          resolve({
            file,
            id: cleanId,
            name: cleanId,
            error: 'Corrupted image file',
            valid: false
          });
        };
        img.src = e.target.result;
      };
      reader.onerror = () => {
        resolve({
          file,
          id: cleanId,
          name: cleanId,
          error: 'Failed to read file',
          valid: false
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const parseSelectedFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setIsParsingFiles(true);
    const parsed = [];
    for (let i = 0; i < fileList.length; i++) {
      const item = await processImageFile(fileList[i]);
      parsed.push(item);
    }
    setBulkFiles(parsed);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: parsed.filter((p) => p.valid).length, currentId: '' });
    setIsParsingFiles(false);
  };

  const handleFolderInput = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    parseSelectedFiles(files);
    e.target.value = '';
  };

  const handleFilesInput = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    parseSelectedFiles(files);
    e.target.value = '';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const items = e.dataTransfer.items;
    const files = [];

    if (items) {
      const readEntry = async (entry) => {
        if (entry.isFile) {
          const file = await new Promise((res) => entry.file(res));
          files.push(file);
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const readAll = async () => {
            const batch = await new Promise((res) => reader.readEntries(res));
            if (batch.length > 0) {
              for (const sub of batch) {
                await readEntry(sub);
              }
              await readAll();
            }
          };
          await readAll();
        }
      };

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) await readEntry(entry);
        } else if (item.kind === 'file') {
          files.push(item.getAsFile());
        }
      }
    } else if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        files.push(e.dataTransfer.files[i]);
      }
    }

    parseSelectedFiles(files);
  };

  const handleStartBulkUpload = async () => {
    const validItems = bulkFiles.filter((f) => f.valid);
    if (validItems.length === 0) return;

    const mac = selectedMac || customMacInput.trim();
    if (!mac) {
      alert('Please select a target device first');
      return;
    }

    setIsProcessingBulk(true);
    isProcessingBulkRef.current = true;
    setBulkResults([]);
    cancelBulkRef.current = false;
    setBulkProgress({ current: 0, total: validItems.length, currentId: '' });

    const results = [];

    try {
      for (let i = 0; i < validItems.length; i++) {
        if (cancelBulkRef.current) {
          break;
        }

        const item = validItems[i];
        setBulkProgress({
          current: i + 1,
          total: validItems.length,
          currentId: item.id
        });

        const maxAttempts = 3;
        let attempt = 0;
        let isEnrolled = false;
        let finalError = '';

        while (attempt < maxAttempts && !isEnrolled && !cancelBulkRef.current) {
          attempt++;
          if (attempt > 1) {
            // Update status to show auto-retrying
            setBulkProgress({
              current: i + 1,
              total: validItems.length,
              currentId: `${item.id} (Retrying #${attempt}...)`
            });
            // Wait 1500ms to let device NPU buffer cool down and free memory
            await new Promise((r) => setTimeout(r, 1500));
          }

          try {
            const res = await fetch(`${API_BASE}/api/devices/${mac}/users`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: item.name,
                account: item.id,
                cardNo: '',
                faceBase64: item.base64
              })
            });

            const data = await res.json();
            if (data.success) {
              isEnrolled = true;
              results.push({
                id: item.id,
                name: item.name,
                previewUrl: item.previewUrl,
                status: 'success',
                msg: attempt > 1
                  ? `Enrolled with Face Recognition (resolved on retry ${attempt})`
                  : 'Enrolled successfully with Face Recognition'
              });
              break;
            } else {
              finalError = data.error || 'Device rejected user enrollment';
              // Only retry on transient face detection / hardware busy issues
              const isRetryable = finalError.includes('No face detected') ||
                                  finalError.includes('Face feature') ||
                                  finalError.includes('Operation failed') ||
                                  finalError.includes('timed out');
              if (!isRetryable) {
                // Permanent error (e.g. invalid data, max admins), don't waste retries
                break;
              }
            }
          } catch (err) {
            finalError = err.message || 'Network communication error';
          }
        }

        if (!isEnrolled && !cancelBulkRef.current) {
          results.push({
            id: item.id,
            name: item.name,
            previewUrl: item.previewUrl,
            status: 'failed',
            msg: finalError
          });
        }

        setBulkResults([...results]);
        // Adaptive pacing (900ms) to allow physical NAND flash to flush and prevent queue congestion
        await new Promise((r) => setTimeout(r, 900));
      }
    } finally {
      setIsProcessingBulk(false);
      isProcessingBulkRef.current = false;
      setTimeout(fetchUsers, 1000);
    }
  };

  const handleCancelBulk = () => {
    cancelBulkRef.current = true;
  };

  const handleDownloadFailedCsv = () => {
    const failedList = bulkResults.filter((r) => r.status === 'failed');
    if (failedList.length === 0) return;

    const headers = ['Employee ID / Account', 'Full Name', 'Status', 'Failure Reason'];
    const rows = failedList.map((r) => [
      `"${r.id}"`,
      `"${r.name}"`,
      `"${r.status}"`,
      `"${(r.msg || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `failed_biometric_enrollments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Setup SSE
  useEffect(() => {
    fetchHealth();
    fetchDevices();

    const evtSource = new EventSource(`${API_BASE}/api/events`);
    evtSource.onmessage = (event) => {
      try {
        const ev = JSON.parse(event.data);
        if (ev.type === 'heartbeat' || ev.type === 'device_registered' || ev.type === 'device_connected' || ev.type === 'device_offline') {
          fetchDevices();
        }
        if (ev.type === 'punch_record') {
          setLogs((prev) => [ev.record, ...prev.slice(0, 40)]);
        }
        if (ev.type === 'users_updated') {
          // Mute background database queries during active bulk uploads to prevent hardware contention
          if (!isProcessingBulkRef.current) {
            setTimeout(fetchUsers, 600);
          }
        }
      } catch (err) {
        console.error('SSE error', err);
      }
    };

    return () => {
      evtSource.close();
    };
  }, []);

  // Fetch users once when device is selected
  useEffect(() => {
    if (selectedMac) {
      fetchUsers();
    }
  }, [selectedMac]);

  const activeDevice = devices.find((d) => d.mac === selectedMac) || {
    mac: selectedMac,
    status: 'online',
    ip: 'Unknown'
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase().trim();
    const nameMatch = (u.name || '').toLowerCase().includes(term);
    const idMatch = String(u.id || '').toLowerCase().includes(term);
    const accountMatch = (u.account || '').toLowerCase().includes(term);
    const cardMatch = (u.card_no || '').toLowerCase().includes(term);
    return nameMatch || idMatch || accountMatch || cardMatch;
  });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
            Test Device
          </h1>
          {/* <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            Device supports: <strong>Face</strong> & <strong>IC Card</strong> only
          </p> */}
        </div>

        {/* Device Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, color: '#94a3b8' }}>Device:</label>
          {devices.length > 0 ? (
            <select
              value={selectedMac}
              onChange={(e) => {
                setSelectedMac(e.target.value);
                setUsers([]);
              }}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'monospace'
              }}
            >
              {devices.map((d) => (
                <option key={d.mac} value={d.mac}>
                  {d.mac} ({d.status === 'online' ? 'Online' : 'Offline'})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="Enter Device MAC"
              value={customMacInput}
              onChange={(e) => setCustomMacInput(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'monospace'
              }}
            />
          )}

          <span style={{
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 12,
            backgroundColor: activeDevice.status === 'online' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
            color: activeDevice.status === 'online' ? '#34d399' : '#f87171',
            fontWeight: 600
          }}>
            {activeDevice.status === 'online' ? 'ONLINE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastMsg && (
        <div style={{
          backgroundColor: toastMsg.type === 'success' ? '#064e3b' : '#7f1d1d',
          border: `1px solid ${toastMsg.type === 'success' ? '#059669' : '#dc2626'}`,
          color: toastMsg.type === 'success' ? '#a7f3d0' : '#fecaca',
          padding: '12px 18px',
          borderRadius: 10,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 14,
          fontWeight: 600,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{toastMsg.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{toastMsg.text}</span>
          </div>
          <button
            onClick={() => setToastMsg(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold',
              padding: '0 4px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Quick Action Card */}
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Target Device:</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8' }}>
            {selectedMac || customMacInput || 'No Device'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {doorMsg && (
            <span style={{
              fontSize: 14,
              fontWeight: 600,
              color: doorMsg.type === 'success' ? '#34d399' : '#f87171'
            }}>
              {doorMsg.text}
            </span>
          )}

          <button
            onClick={fetchDeviceParams}
            disabled={isLoadingParams}
            title="Inspect device hardware options & enabled features"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 16px',
              backgroundColor: '#334155',
              color: '#f8fafc',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: isLoadingParams ? 'not-allowed' : 'pointer'
            }}
          >
            <Info size={16} />
            {isLoadingParams ? 'Inspecting...' : 'Device Features'}
          </button>

          <button
            onClick={handleOpenDoor}
            disabled={isOpeningDoor}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: isOpeningDoor ? 'not-allowed' : 'pointer',
              opacity: isOpeningDoor ? 0.7 : 1
            }}
          >
            <Unlock size={18} />
            {isOpeningDoor ? 'Opening Door...' : 'Open Door'}
          </button>
        </div>
      </div>

      {/* Users Section */}
      <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} color="#38bdf8" />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              Users on Device ({users.length})
            </h2>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={fetchUsers}
              disabled={isLoadingUsers}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              <RefreshCw size={14} className={isLoadingUsers ? 'animate-spin' : ''} />
              {isLoadingUsers ? 'Fetching...' : 'Fetch Users'}
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isLoadingUsers || users.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                backgroundColor: users.length > 0 ? '#15803d' : '#334155',
                color: users.length > 0 ? '#ffffff' : '#94a3b8',
                border: 'none',
                fontWeight: 600,
                cursor: users.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: 13,
                transition: 'all 0.2s ease'
              }}
              title={users.length === 0 ? 'No users to export' : `Export all ${users.length} users to Excel spreadsheet (.xlsx)`}
            >
              <FileSpreadsheet size={15} /> Export Excel
            </button>

            <button
              onClick={() => {
                setBulkFiles([]);
                setBulkResults([]);
                setBulkProgress({ current: 0, total: 0, currentId: '' });
                setShowBulkModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                backgroundColor: '#7c3aed',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              <FolderUp size={14} /> Bulk Import Photos
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              <UserPlus size={14} /> Add User
            </button>

            <button
              onClick={() => setShowClearModal(true)}
              disabled={isLoadingUsers || users.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                backgroundColor: users.length > 0 ? '#dc2626' : '#334155',
                color: users.length > 0 ? '#ffffff' : '#94a3b8',
                border: 'none',
                fontWeight: 600,
                cursor: users.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: 13,
                transition: 'all 0.2s ease'
              }}
              title={users.length === 0 ? 'No users to delete' : 'Delete all users from device'}
            >
              <Trash2 size={14} /> Delete All
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search size={15} color="#64748b" style={{ position: 'absolute', left: 12, top: 11 }} />
            <input
              type="text"
              placeholder="Search by name, ID, account, or card..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 8,
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          {searchQuery && (
            <span style={{ fontSize: 13, color: '#94a3b8' }}>
              Showing {filteredUsers.length} of {users.length} users
            </span>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                <th style={{ padding: '10px 12px' }}>ID</th>
                <th style={{ padding: '10px 12px' }}>Name</th>
                <th style={{ padding: '10px 12px' }}>Account</th>
                <th style={{ padding: '10px 12px' }}>Card Number</th>
                <th style={{ padding: '10px 12px' }}>Face Registered</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '30px 12px', textAlign: 'center', color: '#64748b' }}>
                    {isLoadingUsers ? 'Contacting biometric terminal...' : searchQuery ? 'No users match your search query.' : 'No active users found. Click "Fetch Users" or "Add User".'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#94a3b8' }}>#{u.id}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#f8fafc' }}>{u.name || u.account || '(No name)'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#38bdf8' }}>{u.account || '—'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#cbd5e1' }}>
                      {u.card_no ? `💳 ${u.card_no}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {u.face_cnt > 0 ? (
                        <span style={{ color: '#34d399', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Smile size={14} /> Yes ({u.face_cnt})
                        </span>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: 13 }}>No</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.account)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: 'transparent',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Punches / Activity Section */}
      <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Activity size={18} color="#34d399" />
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
            Live Device Scans (Card & Face)
          </h2>
        </div>

        {logs.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13, padding: '10px 0' }}>
            Waiting for face scan or card swipe from the device...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#0f172a',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13
                }}
              >
                <div>
                  <strong style={{ color: '#f8fafc' }}>{log.name || 'Unknown'}</strong>
                  {log.account && <span style={{ marginLeft: 6, color: '#64748b' }}>({log.account})</span>}
                  <span style={{ marginLeft: 10, color: '#38bdf8' }}>{log.passTypeName}</span>
                  {log.cardNo && <span style={{ marginLeft: 10, fontFamily: 'monospace', color: '#94a3b8' }}>💳 {log.cardNo}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: log.passStatus === 'Allowed' ? '#34d399' : '#f87171'
                  }}>
                    {log.passStatus}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete All Users Confirmation Modal */}
      {showClearModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: 12,
            border: '1px solid #ef4444',
            padding: 24,
            width: '100%',
            maxWidth: 440,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            textAlign: 'center'
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <AlertCircle size={30} color="#ef4444" />
            </div>

            <h3 style={{ margin: '0 0 10px 0', fontSize: 18, color: '#f8fafc', fontWeight: 700 }}>
              Delete All Users from Device?
            </h3>

            <p style={{ margin: '0 0 18px 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
              Are you sure you want to delete all <strong style={{ color: '#f8fafc' }}>{users.length} users</strong> from device <strong style={{ color: '#38bdf8' }}>{selectedMac || customMacInput}</strong>?
              <br /><br />
              <span style={{ color: '#fca5a5' }}>
                ⚠️ This will permanently wipe all enrolled face photos, IC cards, and user profiles from the terminal. This action cannot be undone.
              </span>
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={isClearingAll}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isClearingAll ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                disabled={isClearingAll}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 22px',
                  borderRadius: 8,
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isClearingAll ? 'not-allowed' : 'pointer'
                }}
              >
                <Trash2 size={15} />
                {isClearingAll ? 'Deleting All Users...' : `Yes, Delete All (${users.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: 12,
            padding: 24,
            width: '100%',
            maxWidth: 400
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 17, color: '#f8fafc' }}>
              Add User (Face / Card Device)
            </h3>

            {errorMsg && (
              <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddUser}>
              {/* User ID / Account */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
                  User ID / Account (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 101 or EMP_01 (leave blank to auto-generate)"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Full Name */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Card Number */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
                  IC Card Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 12345678"
                  value={cardNo}
                  onChange={(e) => setCardNo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Face Photo Upload */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                  Face Photo Upload (Optional)
                </label>

                {facePreview ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: '#0f172a',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #334155'
                  }}>
                    <img
                      src={facePreview}
                      alt="Face preview"
                      style={{
                        width: 48,
                        height: 58,
                        borderRadius: 6,
                        objectFit: 'cover',
                        border: '1px solid #475569'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#34d399', fontWeight: 600 }}>Photo attached</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Optimized for device facial recognition</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      title="Remove photo"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        padding: 4
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: 'none' }}
                      id="face-upload-input"
                    />
                    <label
                      htmlFor="face-upload-input"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '10px 14px',
                        borderRadius: 8,
                        backgroundColor: '#0f172a',
                        border: '1px dashed #475569',
                        color: '#cbd5e1',
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'border-color 0.2s'
                      }}
                    >
                      <Camera size={16} color="#38bdf8" />
                      <span>Choose Face Photo (JPG/PNG)</span>
                    </label>
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Photos are auto-resized for device matching. PIN is set on the terminal touch screen if needed.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    handleClearImage();
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    backgroundColor: 'transparent',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    backgroundColor: '#2563eb',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? 'Saving to Device...' : 'Save to Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Device Features / Capabilities Modal */}
      {showParamsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: 14,
            padding: 24,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc', fontWeight: 700 }}>
                  Device Features & Capabilities
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8', fontFamily: 'monospace' }}>
                  {selectedMac || customMacInput}
                </p>
              </div>
              <button
                onClick={() => setShowParamsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 20,
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {isLoadingParams ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 14 }}>
                Querying device for supported hardware features...
              </div>
            ) : deviceParams && !deviceParams.error ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Face Recognition</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: deviceParams.enable_face ? '#34d399' : '#f87171' }}>
                      {deviceParams.enable_face ? '✅ Enabled' : '❌ Disabled'}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>IC Card Reader</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: deviceParams.enable_iccard ? '#34d399' : '#f87171' }}>
                      {deviceParams.enable_iccard ? '✅ Enabled' : '❌ Disabled'}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Fingerprint Scanner</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: deviceParams.enable_finger ? '#34d399' : '#94a3b8' }}>
                      {deviceParams.enable_finger ? '✅ Enabled' : '❌ Not Available'}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>QR Code Scanner</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: deviceParams.enable_qrcode_reader ? '#34d399' : '#94a3b8' }}>
                      {deviceParams.enable_qrcode_reader ? '✅ Enabled' : '❌ Not Available'}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Display QR on Screen</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: deviceParams.enable_display_qrcode ? '#34d399' : '#94a3b8' }}>
                      {deviceParams.enable_display_qrcode ? '✅ Enabled' : '❌ Disabled'}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Keypad / Passcode</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: deviceParams.enable_common_pwd || deviceParams.enable_user_pwd ? '#34d399' : '#94a3b8' }}>
                      {deviceParams.enable_common_pwd || deviceParams.enable_user_pwd ? '✅ Enabled' : '❌ Disabled'}
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8, fontSize: 13, color: '#cbd5e1', lineHeight: 1.8 }}>
                  <div>Device Name: <strong style={{ color: '#f8fafc' }}>{deviceParams.device_name || 'JSD Terminal'}</strong></div>
                  <div>Face Match Score Threshold: <strong style={{ color: '#f8fafc' }}>{deviceParams.recognize_score ?? 'N/A'}</strong></div>
                  <div>Volume: <strong style={{ color: '#f8fafc' }}>{deviceParams.volume ?? 'N/A'}%</strong></div>
                  <div>Wiegand Output: <strong style={{ color: '#f8fafc' }}>{deviceParams.wiegand_type === 1 ? 'WG26' : deviceParams.wiegand_type === 2 ? 'WG34' : 'Disabled'}</strong></div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#f87171', padding: '20px 0', fontSize: 13, textAlign: 'center' }}>
                {deviceParams?.error || 'Unable to communicate with device. Make sure device is online.'}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button
                onClick={() => setShowParamsModal(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Photo Import Modal */}
      {showBulkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60,
          padding: 16
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: 14,
            padding: 24,
            width: '100%',
            maxWidth: 640,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderUp size={20} color="#a855f7" /> Bulk Import Employee Photos
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                  Target Device: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{selectedMac || customMacInput}</strong>
                </p>
              </div>

              {!isProcessingBulk && (
                <button
                  onClick={() => {
                    setShowBulkModal(false);
                    setBulkFiles([]);
                    setBulkResults([]);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: 20,
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Hidden Inputs */}
            <input
              type="file"
              ref={bulkFolderInputRef}
              webkitdirectory="true"
              directory="true"
              multiple
              onChange={handleFolderInput}
              style={{ display: 'none' }}
            />
            <input
              type="file"
              ref={bulkFilesInputRef}
              accept="image/*"
              multiple
              onChange={handleFilesInput}
              style={{ display: 'none' }}
            />

            {/* Modal Body */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
              {!isProcessingBulk && bulkResults.length === 0 ? (
                <>
                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    style={{
                      border: `2px dashed ${isDragging ? '#a855f7' : '#475569'}`,
                      borderRadius: 12,
                      padding: '30px 20px',
                      textAlign: 'center',
                      backgroundColor: isDragging ? 'rgba(168, 85, 247, 0.1)' : '#0f172a',
                      transition: 'all 0.2s ease',
                      marginBottom: 16
                    }}
                  >
                    <UploadCloud size={40} color={isDragging ? '#a855f7' : '#64748b'} style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc', marginBottom: 4 }}>
                      Drag & Drop your Employee Photos folder here
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                      or choose one of the options below
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => bulkFolderInputRef.current?.click()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '10px 18px',
                          backgroundColor: '#7c3aed',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <FolderUp size={15} /> Select Folder...
                      </button>

                      <button
                        type="button"
                        onClick={() => bulkFilesInputRef.current?.click()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '10px 18px',
                          backgroundColor: '#334155',
                          color: '#f8fafc',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Camera size={15} /> Select Photos...
                      </button>
                    </div>
                  </div>

                  {/* Naming Guide Tip Box */}
                  <div style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 10,
                    padding: '14px 16px',
                    fontSize: 13,
                    color: '#cbd5e1',
                    lineHeight: 1.6,
                    marginBottom: 16
                  }}>
                    <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Info size={15} /> How photo names are mapped:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      <li>Each photo's filename automatically becomes the <strong>Employee ID</strong> and <strong>Name</strong> on the device.</li>
                      <li>Example: <code style={{ color: '#a7f3d0', backgroundColor: '#064e3b', padding: '1px 6px', borderRadius: 4 }}>T2324.jpg</code> or <code style={{ color: '#a7f3d0', backgroundColor: '#064e3b', padding: '1px 6px', borderRadius: 4 }}>2324.png</code> &rarr; ID: <strong>T2324</strong>, Name: <strong>T2324</strong>.</li>
                      <li>Both alphanumeric (e.g. <em>T2324</em>) and purely numeric (e.g. <em>2324</em>) are supported.</li>
                      <li>Photos are auto-optimized for face detection without clipping edges.</li>
                    </ul>
                  </div>

                  {/* Selected Files Preview */}
                  {isParsingFiles ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 14 }}>
                      Processing and optimizing photos...
                    </div>
                  ) : bulkFiles.length > 0 && (
                    <div style={{ backgroundColor: '#0f172a', borderRadius: 10, padding: 14, border: '1px solid #334155' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>
                          Ready to Enroll: <strong style={{ color: '#34d399' }}>{bulkFiles.filter((f) => f.valid).length}</strong> photos
                        </span>
                        <button
                          onClick={() => setBulkFiles([])}
                          style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 12, cursor: 'pointer' }}
                        >
                          Clear Selection
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto', padding: 4 }}>
                        {bulkFiles.slice(0, 30).map((f, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: 12,
                              padding: '3px 8px',
                              borderRadius: 6,
                              backgroundColor: f.valid ? '#1e293b' : 'rgba(239, 68, 68, 0.2)',
                              color: f.valid ? '#38bdf8' : '#f87171',
                              border: `1px solid ${f.valid ? '#334155' : '#ef4444'}`
                            }}
                          >
                            {f.id} {f.valid ? '' : '(invalid)'}
                          </span>
                        ))}
                        {bulkFiles.length > 30 && (
                          <span style={{ fontSize: 12, color: '#94a3b8', padding: '3px 6px' }}>
                            +{bulkFiles.length - 30} more...
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Processing & Results Screen */
                <div>
                  {/* Progress Bar */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: '#94a3b8' }}>
                        {isProcessingBulk ? (
                          <>Enrolling <strong>{bulkProgress.currentId}</strong> ({bulkProgress.current} of {bulkProgress.total})...</>
                        ) : (
                          <>Enrollment Complete!</>
                        )}
                      </span>
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                        {Math.round((bulkProgress.current / (bulkProgress.total || 1)) * 100)}%
                      </span>
                    </div>

                    <div style={{ width: '100%', height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${(bulkProgress.current / (bulkProgress.total || 1)) * 100}%`,
                          backgroundColor: isProcessingBulk ? '#7c3aed' : '#10b981',
                          transition: 'width 0.25s ease'
                        }}
                      />
                    </div>
                  </div>

                  {/* Summary Counters */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div style={{ backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Total Items</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>{bulkProgress.total}</div>
                    </div>

                    <div style={{ backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Enrolled Successfully</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#34d399' }}>
                        {bulkResults.filter((r) => r.status === 'success').length}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Failed / Skipped</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: bulkResults.some((r) => r.status === 'failed') ? '#f87171' : '#94a3b8' }}>
                        {bulkResults.filter((r) => r.status === 'failed').length}
                      </div>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {['all', 'failed', 'success'].map((tab) => {
                      const count = tab === 'all'
                        ? bulkResults.length
                        : tab === 'failed'
                        ? bulkResults.filter((r) => r.status === 'failed').length
                        : bulkResults.filter((r) => r.status === 'success').length;
                      return (
                        <button
                          key={tab}
                          onClick={() => setBulkFilter(tab)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: bulkFilter === tab ? '#334155' : '#0f172a',
                            color: bulkFilter === tab ? '#f8fafc' : '#94a3b8'
                          }}
                        >
                          {tab.toUpperCase()} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Results Table */}
                  <div style={{ maxHeight: 260, overflowY: 'auto', backgroundColor: '#0f172a', borderRadius: 8, border: '1px solid #334155' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                          <th style={{ padding: '8px 10px', width: 44 }}>Photo</th>
                          <th style={{ padding: '8px 10px' }}>Employee ID</th>
                          <th style={{ padding: '8px 10px' }}>Status</th>
                          <th style={{ padding: '8px 10px' }}>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkResults
                          .filter((r) => bulkFilter === 'all' || r.status === bulkFilter)
                          .map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                              <td style={{ padding: '6px 10px' }}>
                                {r.previewUrl ? (
                                  <img
                                    src={r.previewUrl}
                                    alt={r.id}
                                    style={{ width: 28, height: 38, objectFit: 'cover', borderRadius: 4, border: '1px solid #334155' }}
                                  />
                                ) : (
                                  <div style={{ width: 28, height: 38, backgroundColor: '#334155', borderRadius: 4 }} />
                                )}
                              </td>
                              <td style={{ padding: '6px 10px', fontWeight: 600, color: '#f8fafc', fontFamily: 'monospace' }}>
                                {r.id}
                              </td>
                              <td style={{ padding: '6px 10px' }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  backgroundColor: r.status === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                  color: r.status === 'success' ? '#34d399' : '#f87171'
                                }}>
                                  {r.status === 'success' ? 'Enrolled' : 'Failed'}
                                </span>
                              </td>
                              <td style={{ padding: '6px 10px', color: r.status === 'success' ? '#94a3b8' : '#fca5a5' }}>
                                {r.msg}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 12, borderTop: '1px solid #334155' }}>
              <div>
                {!isProcessingBulk && bulkResults.some((r) => r.status === 'failed') && (
                  <button
                    onClick={handleDownloadFailedCsv}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 8,
                      backgroundColor: '#334155',
                      color: '#38bdf8',
                      border: '1px solid #475569',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={14} /> Download Failed List (CSV)
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                {isProcessingBulk ? (
                  <button
                    onClick={handleCancelBulk}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel Remaining
                  </button>
                ) : bulkResults.length > 0 ? (
                  <button
                    onClick={() => {
                      setShowBulkModal(false);
                      setBulkFiles([]);
                      setBulkResults([]);
                    }}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 8,
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Done & Refresh
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setShowBulkModal(false);
                        setBulkFiles([]);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        backgroundColor: '#334155',
                        color: '#f8fafc',
                        border: 'none',
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      onClick={handleStartBulkUpload}
                      disabled={bulkFiles.filter((f) => f.valid).length === 0}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 20px',
                        borderRadius: 8,
                        backgroundColor: bulkFiles.filter((f) => f.valid).length > 0 ? '#7c3aed' : '#475569',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: bulkFiles.filter((f) => f.valid).length > 0 ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <FolderUp size={14} /> Start Enrollment ({bulkFiles.filter((f) => f.valid).length})
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
