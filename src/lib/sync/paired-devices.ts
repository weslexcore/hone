const STORAGE_KEY = "hone_paired_devices";

function isBrowser() {
  return typeof window !== "undefined";
}

export interface PairedDevice {
  deviceId: string;
  name: string;
  peerId: string;
  pairedAt: string;
  lastSyncAt: string | null;
}

export function getPairedDevices(): PairedDevice[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PairedDevice[];
  } catch {
    return [];
  }
}

export function savePairedDevice(device: PairedDevice): void {
  if (!isBrowser()) return;
  const devices = getPairedDevices();
  const idx = devices.findIndex((d) => d.deviceId === device.deviceId);
  if (idx >= 0) {
    devices[idx] = device;
  } else {
    devices.push(device);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}

export function updateLastSync(deviceId: string): void {
  if (!isBrowser()) return;
  const devices = getPairedDevices();
  const device = devices.find((d) => d.deviceId === deviceId);
  if (device) {
    device.lastSyncAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  }
}

export function removePairedDevice(deviceId: string): void {
  if (!isBrowser()) return;
  const devices = getPairedDevices().filter((d) => d.deviceId !== deviceId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}
