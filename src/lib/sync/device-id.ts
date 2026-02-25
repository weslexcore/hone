import { nanoid } from "nanoid";

const STORAGE_KEY_DEVICE_ID = "hone_device_id";
const STORAGE_KEY_DEVICE_NAME = "hone_device_name";

function isBrowser() {
  return typeof window !== "undefined";
}

function detectDeviceName(): string {
  if (!isBrowser()) return "Unknown";
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua)) return "iPad";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Browser";
}

export function getDeviceId(): string {
  if (!isBrowser()) return "";
  let id = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
  if (!id) {
    id = nanoid(12);
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, id);
  }
  return id;
}

export function getDeviceName(): string {
  if (!isBrowser()) return "Unknown";
  return localStorage.getItem(STORAGE_KEY_DEVICE_NAME) || detectDeviceName();
}

export function setDeviceName(name: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY_DEVICE_NAME, name);
}
