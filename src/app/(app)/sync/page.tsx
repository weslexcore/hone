"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { QrDisplay } from "@/components/features/sync/qr-display";
import { QrScanner } from "@/components/features/sync/qr-scanner";
import { getDeviceId, getDeviceName, setDeviceName } from "@/lib/sync/device-id";
import {
  getPairedDevices,
  savePairedDevice,
  removePairedDevice,
  updateLastSync,
  type PairedDevice,
} from "@/lib/sync/paired-devices";
import {
  createPeer,
  connectToPeer,
  sendMessage,
  sendChunked,
  parseMessage,
  createHandshake,
  createHandshakeAck,
  buildPeerId,
  type ConnectionState,
  type ChunkMeta,
} from "@/lib/sync/peer-manager";
import { getExportPayload, applySyncData, formatSyncResult } from "@/lib/sync/sync-protocol";
import { nanoid } from "nanoid";
import {
  Smartphone,
  QrCode,
  ScanLine,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  Wifi,
  WifiOff,
  Edit3,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type Peer from "peerjs";
import type { DataConnection } from "peerjs";

// --- Host Flow: Show QR code and wait for scanner to connect ---

function HostDialog({
  open,
  onClose,
  onSyncComplete,
}: {
  open: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<ConnectionState>("idle");
  const [peerId, setPeerId] = useState<string | null>(null);
  const [remoteName, setRemoteName] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const chunksRef = useRef<Map<number, string>>(new Map());
  const totalChunksRef = useRef(0);

  const cleanup = useCallback(() => {
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null;
    peerRef.current = null;
    chunksRef.current.clear();
    totalChunksRef.current = 0;
  }, []);

  const startHost = useCallback(async () => {
    cleanup();
    setState("initializing");
    setStatusText("Setting up connection...");

    try {
      const sessionSuffix = nanoid(6);
      const myPeerId = buildPeerId(getDeviceId(), sessionSuffix);
      const peer = await createPeer(myPeerId);
      peerRef.current = peer;
      setPeerId(myPeerId);
      setState("waiting");
      setStatusText("Waiting for other device to scan...");

      peer.on("connection", (conn) => {
        connRef.current = conn;
        setState("connecting");
        setStatusText("Device connecting...");

        conn.on("open", () => {
          sendMessage(conn, createHandshake());
        });

        conn.on("data", async (raw) => {
          const msg = parseMessage(raw);
          if (!msg) return;

          if (msg.type === "handshake-ack") {
            setRemoteName(msg.deviceName);
            setState("syncing");
            setStatusText(`Syncing with ${msg.deviceName}...`);

            // Save pairing info
            savePairedDevice({
              deviceId: msg.deviceId,
              name: msg.deviceName,
              peerId: "",
              pairedAt: new Date().toISOString(),
              lastSyncAt: null,
            });

            // Send our data
            try {
              const payload = await getExportPayload();
              sendChunked(conn, payload, getDeviceId());
              sendMessage(conn, {
                type: "sync-complete",
                deviceId: getDeviceId(),
                deviceName: getDeviceName(),
              });
            } catch {
              sendMessage(conn, {
                type: "error",
                deviceId: getDeviceId(),
                deviceName: getDeviceName(),
                payload: "Failed to export data",
              });
            }
          }

          if (msg.type === "sync-chunk") {
            const chunk = msg.payload as ChunkMeta;
            chunksRef.current.set(chunk.chunkIndex, chunk.data);
            totalChunksRef.current = chunk.totalChunks;

            const progress = Math.round((chunksRef.current.size / chunk.totalChunks) * 100);
            setStatusText(`Receiving data from ${remoteName || msg.deviceName}... ${progress}%`);
          }

          if (msg.type === "sync-complete") {
            // Apply received data
            if (chunksRef.current.size > 0) {
              setStatusText("Applying changes...");
              try {
                const orderedChunks: string[] = [];
                for (let i = 0; i < totalChunksRef.current; i++) {
                  orderedChunks.push(chunksRef.current.get(i) || "");
                }
                const fullData = orderedChunks.join("");
                const result = await applySyncData(fullData);
                updateLastSync(msg.deviceId);
                toast(formatSyncResult(result), "success");
              } catch {
                toast("Failed to apply sync data", "error");
              }
            }

            setState("complete");
            setStatusText("Sync complete!");
            setTimeout(() => {
              onSyncComplete();
            }, 1500);
          }
        });

        conn.on("close", () => {
          if (state !== "complete") {
            setState("error");
            setStatusText("Connection lost");
          }
        });
      });

      peer.on("error", () => {
        setState("error");
        setStatusText("Connection error. Try again.");
      });
    } catch {
      setState("error");
      setStatusText("Failed to initialize. Try again.");
    }
  }, [cleanup, toast, onSyncComplete, state, remoteName]);

  useEffect(() => {
    if (open) {
      startHost();
    }
    return cleanup;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    cleanup();
    setState("idle");
    setPeerId(null);
    setRemoteName(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-sm">
      <DialogTitle>Share via QR Code</DialogTitle>

      <div className="flex flex-col items-center gap-4">
        {state === "waiting" && peerId && <QrDisplay value={peerId} />}

        {state === "initializing" && (
          <div className="flex items-center gap-2 py-8">
            <Loader2 size={18} className="animate-spin text-accent" />
            <span className="text-sm text-text-secondary">{statusText}</span>
          </div>
        )}

        {state === "connecting" && (
          <div className="flex items-center gap-2 py-8">
            <Loader2 size={18} className="animate-spin text-accent" />
            <span className="text-sm text-text-secondary">{statusText}</span>
          </div>
        )}

        {state === "syncing" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 size={24} className="animate-spin text-accent" />
            <p className="text-sm text-text-secondary text-center">{statusText}</p>
          </div>
        )}

        {state === "complete" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <Check size={24} className="text-accent" />
            </div>
            <p className="text-sm text-text-primary font-medium">{statusText}</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle size={24} className="text-danger" />
            <p className="text-sm text-danger">{statusText}</p>
            <Button variant="secondary" size="sm" onClick={startHost}>
              Try Again
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// --- Scan Flow: Scan QR code and connect to host ---

function ScanDialog({
  open,
  onClose,
  onSyncComplete,
}: {
  open: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<ConnectionState>("idle");
  const [statusText, setStatusText] = useState("");
  const [scanning, setScanning] = useState(true);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const chunksRef = useRef<Map<number, string>>(new Map());
  const totalChunksRef = useRef(0);

  const cleanup = useCallback(() => {
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null;
    peerRef.current = null;
    chunksRef.current.clear();
    totalChunksRef.current = 0;
  }, []);

  const handleScan = useCallback(
    async (scannedPeerId: string) => {
      setScanning(false);
      setState("connecting");
      setStatusText("Connecting to device...");

      try {
        const sessionSuffix = nanoid(6);
        const myPeerId = buildPeerId(getDeviceId(), sessionSuffix);
        const peer = await createPeer(myPeerId);
        peerRef.current = peer;

        const conn = await connectToPeer(peer, scannedPeerId);
        connRef.current = conn;

        conn.on("data", async (raw) => {
          const msg = parseMessage(raw);
          if (!msg) return;

          if (msg.type === "handshake") {
            // Acknowledge and save pairing
            sendMessage(conn, createHandshakeAck());

            savePairedDevice({
              deviceId: msg.deviceId,
              name: msg.deviceName,
              peerId: scannedPeerId,
              pairedAt: new Date().toISOString(),
              lastSyncAt: null,
            });

            setState("syncing");
            setStatusText(`Syncing with ${msg.deviceName}...`);

            // Send our data back
            try {
              const payload = await getExportPayload();
              sendChunked(conn, payload, getDeviceId());
              sendMessage(conn, {
                type: "sync-complete",
                deviceId: getDeviceId(),
                deviceName: getDeviceName(),
              });
            } catch {
              sendMessage(conn, {
                type: "error",
                deviceId: getDeviceId(),
                deviceName: getDeviceName(),
                payload: "Failed to export data",
              });
            }
          }

          if (msg.type === "sync-chunk") {
            const chunk = msg.payload as ChunkMeta;
            chunksRef.current.set(chunk.chunkIndex, chunk.data);
            totalChunksRef.current = chunk.totalChunks;

            const progress = Math.round((chunksRef.current.size / chunk.totalChunks) * 100);
            setStatusText(`Receiving data... ${progress}%`);
          }

          if (msg.type === "sync-complete") {
            if (chunksRef.current.size > 0) {
              setStatusText("Applying changes...");
              try {
                const orderedChunks: string[] = [];
                for (let i = 0; i < totalChunksRef.current; i++) {
                  orderedChunks.push(chunksRef.current.get(i) || "");
                }
                const fullData = orderedChunks.join("");
                const result = await applySyncData(fullData);
                updateLastSync(msg.deviceId);
                toast(formatSyncResult(result), "success");
              } catch {
                toast("Failed to apply sync data", "error");
              }
            }

            setState("complete");
            setStatusText("Sync complete!");
            setTimeout(() => {
              onSyncComplete();
            }, 1500);
          }

          if (msg.type === "error") {
            setState("error");
            setStatusText(`Remote error: ${msg.payload}`);
          }
        });

        conn.on("close", () => {
          if (state !== "complete") {
            setState("error");
            setStatusText("Connection lost");
          }
        });
      } catch {
        setState("error");
        setStatusText("Failed to connect. Make sure the QR code is still active.");
      }
    },
    [toast, onSyncComplete, state],
  );

  const handleClose = () => {
    cleanup();
    setState("idle");
    setScanning(true);
    onClose();
  };

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-sm">
      <DialogTitle>Scan QR Code</DialogTitle>

      <div className="flex flex-col items-center gap-4">
        {scanning && (
          <QrScanner
            active={open && scanning}
            onScan={handleScan}
            onError={(err) => {
              setState("error");
              setStatusText(err);
            }}
          />
        )}

        {state === "connecting" && (
          <div className="flex items-center gap-2 py-8">
            <Loader2 size={18} className="animate-spin text-accent" />
            <span className="text-sm text-text-secondary">{statusText}</span>
          </div>
        )}

        {state === "syncing" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 size={24} className="animate-spin text-accent" />
            <p className="text-sm text-text-secondary text-center">{statusText}</p>
          </div>
        )}

        {state === "complete" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <Check size={24} className="text-accent" />
            </div>
            <p className="text-sm text-text-primary font-medium">{statusText}</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle size={24} className="text-danger" />
            <p className="text-sm text-danger text-center">{statusText}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setState("idle");
                setScanning(true);
                chunksRef.current.clear();
                totalChunksRef.current = 0;
              }}
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// --- Re-Sync with a previously paired device ---

function ResyncDialog({
  open,
  onClose,
  device,
  onSyncComplete,
}: {
  open: boolean;
  onClose: () => void;
  device: PairedDevice;
  onSyncComplete: () => void;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<ConnectionState>("idle");
  const [statusText, setStatusText] = useState("");
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const chunksRef = useRef<Map<number, string>>(new Map());
  const totalChunksRef = useRef(0);

  const cleanup = useCallback(() => {
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null;
    peerRef.current = null;
    chunksRef.current.clear();
    totalChunksRef.current = 0;
  }, []);

  const startHost = useCallback(async () => {
    cleanup();
    setState("initializing");
    setStatusText("Setting up connection...");

    try {
      const sessionSuffix = nanoid(6);
      const peerId = buildPeerId(getDeviceId(), sessionSuffix);
      const peer = await createPeer(peerId);
      peerRef.current = peer;
      setMyPeerId(peerId);
      setState("waiting");
      setStatusText(
        `Show this QR code to "${device.name}" or have them scan it from their sync page.`,
      );

      peer.on("connection", (conn) => {
        connRef.current = conn;
        setState("syncing");
        setStatusText(`Syncing with ${device.name}...`);

        conn.on("open", () => {
          sendMessage(conn, createHandshake());
        });

        conn.on("data", async (raw) => {
          const msg = parseMessage(raw);
          if (!msg) return;

          if (msg.type === "handshake-ack") {
            try {
              const payload = await getExportPayload();
              sendChunked(conn, payload, getDeviceId());
              sendMessage(conn, {
                type: "sync-complete",
                deviceId: getDeviceId(),
                deviceName: getDeviceName(),
              });
            } catch {
              sendMessage(conn, {
                type: "error",
                deviceId: getDeviceId(),
                deviceName: getDeviceName(),
                payload: "Failed to export data",
              });
            }
          }

          if (msg.type === "sync-chunk") {
            const chunk = msg.payload as ChunkMeta;
            chunksRef.current.set(chunk.chunkIndex, chunk.data);
            totalChunksRef.current = chunk.totalChunks;
          }

          if (msg.type === "sync-complete") {
            if (chunksRef.current.size > 0) {
              try {
                const orderedChunks: string[] = [];
                for (let i = 0; i < totalChunksRef.current; i++) {
                  orderedChunks.push(chunksRef.current.get(i) || "");
                }
                const fullData = orderedChunks.join("");
                const result = await applySyncData(fullData);
                updateLastSync(msg.deviceId);
                toast(formatSyncResult(result), "success");
              } catch {
                toast("Failed to apply sync data", "error");
              }
            }

            setState("complete");
            setStatusText("Sync complete!");
            setTimeout(() => onSyncComplete(), 1500);
          }
        });

        conn.on("close", () => {
          if (state !== "complete") {
            setState("error");
            setStatusText("Connection lost");
          }
        });
      });
    } catch {
      setState("error");
      setStatusText("Failed to initialize. Try again.");
    }
  }, [cleanup, device.name, toast, onSyncComplete, state]);

  useEffect(() => {
    if (open) {
      startHost();
    }
    return cleanup;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    cleanup();
    setState("idle");
    setMyPeerId(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-sm">
      <DialogTitle>Sync with {device.name}</DialogTitle>

      <div className="flex flex-col items-center gap-4">
        {state === "waiting" && myPeerId && (
          <>
            <QrDisplay value={myPeerId} size={180} />
            <p className="text-xs text-text-muted text-center">
              On your other device, open the Sync page and use &ldquo;Scan QR Code&rdquo;
            </p>
          </>
        )}

        {(state === "initializing" || state === "connecting") && (
          <div className="flex items-center gap-2 py-8">
            <Loader2 size={18} className="animate-spin text-accent" />
            <span className="text-sm text-text-secondary">{statusText}</span>
          </div>
        )}

        {state === "syncing" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 size={24} className="animate-spin text-accent" />
            <p className="text-sm text-text-secondary text-center">{statusText}</p>
          </div>
        )}

        {state === "complete" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <Check size={24} className="text-accent" />
            </div>
            <p className="text-sm text-text-primary font-medium">{statusText}</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle size={24} className="text-danger" />
            <p className="text-sm text-danger text-center">{statusText}</p>
            <Button variant="secondary" size="sm" onClick={startHost}>
              Try Again
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// --- Main Sync Page ---

export default function SyncPage() {
  const { toast } = useToast();
  const [hostOpen, setHostOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [resyncDevice, setResyncDevice] = useState<PairedDevice | null>(null);
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [deviceName, setDeviceNameLocal] = useState("");
  const [editingName, setEditingName] = useState(false);

  const refreshDevices = useCallback(() => {
    setDevices(getPairedDevices());
  }, []);

  useEffect(() => {
    setDeviceNameLocal(getDeviceName());
    refreshDevices();
  }, [refreshDevices]);

  const handleSaveDeviceName = () => {
    const trimmed = deviceName.trim();
    if (trimmed) {
      setDeviceName(trimmed);
      setDeviceNameLocal(trimmed);
      toast("Device name updated", "success");
    }
    setEditingName(false);
  };

  const handleRemoveDevice = (device: PairedDevice) => {
    removePairedDevice(device.deviceId);
    refreshDevices();
    toast(`Removed ${device.name}`, "success");
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Device Sync</h1>
        <p className="text-sm text-text-muted mb-8">
          Sync your writing data between devices using a QR code
        </p>

        {/* This Device */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
            <span className="flex items-center gap-2">
              <Smartphone size={14} />
              This Device
            </span>
          </h2>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary font-medium">
                  {editingName ? (
                    <input
                      type="text"
                      value={deviceName}
                      onChange={(e) => setDeviceNameLocal(e.target.value)}
                      onBlur={handleSaveDeviceName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveDeviceName();
                        if (e.key === "Escape") {
                          setDeviceNameLocal(getDeviceName());
                          setEditingName(false);
                        }
                      }}
                      autoFocus
                      className="bg-transparent border-b border-accent text-text-primary text-sm font-medium outline-none w-40"
                    />
                  ) : (
                    deviceName
                  )}
                </p>
                <p className="text-xs text-text-muted mt-0.5">ID: {getDeviceId()}</p>
              </div>
              {!editingName && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingName(true)}
                  title="Edit device name"
                >
                  <Edit3 size={14} />
                </Button>
              )}
            </div>
          </Card>
        </section>

        {/* Connect */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
            <span className="flex items-center gap-2">
              <Wifi size={14} />
              Connect
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card hover onClick={() => setHostOpen(true)} className="text-center">
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <QrCode size={24} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Show QR Code</p>
                  <p className="text-xs text-text-muted mt-1">
                    Display a QR code for another device to scan
                  </p>
                </div>
              </div>
            </Card>

            <Card hover onClick={() => setScanOpen(true)} className="text-center">
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <ScanLine size={24} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Scan QR Code</p>
                  <p className="text-xs text-text-muted mt-1">
                    Scan a QR code shown on another device
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Paired Devices */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
            <span className="flex items-center gap-2">
              <RefreshCw size={14} />
              Paired Devices
            </span>
          </h2>

          {devices.length === 0 ? (
            <Card>
              <div className="flex items-center gap-3 py-2">
                <WifiOff size={18} className="text-text-muted" />
                <div>
                  <p className="text-sm text-text-secondary">No paired devices yet</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Use the QR code options above to connect with another device
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <Card key={device.deviceId}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Smartphone size={18} className="text-accent shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary font-medium truncate">
                          {device.name}
                        </p>
                        <p className="text-xs text-text-muted">
                          {device.lastSyncAt
                            ? `Last synced ${formatDistanceToNow(new Date(device.lastSyncAt), { addSuffix: true })}`
                            : `Paired ${formatDistanceToNow(new Date(device.pairedAt), { addSuffix: true })}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="primary" size="sm" onClick={() => setResyncDevice(device)}>
                        <RefreshCw size={14} />
                        Sync
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveDevice(device)}
                        title="Remove device"
                      >
                        <Trash2 size={14} className="text-text-muted" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* How it works */}
        <section>
          <Card className="bg-accent-muted border-accent/20">
            <h3 className="text-sm font-medium text-accent mb-2">How syncing works</h3>
            <ul className="text-xs text-text-secondary leading-relaxed space-y-1.5">
              <li>
                <strong className="text-text-primary">1.</strong> On one device, tap{" "}
                <strong className="text-text-primary">Show QR Code</strong>
              </li>
              <li>
                <strong className="text-text-primary">2.</strong> On the other device, tap{" "}
                <strong className="text-text-primary">Scan QR Code</strong> and point your camera at
                it
              </li>
              <li>
                <strong className="text-text-primary">3.</strong> Both devices will exchange data
                directly &mdash; nothing goes through a server
              </li>
              <li>
                <strong className="text-text-primary">4.</strong> After the first sync, paired
                devices appear above for quick re-syncing
              </li>
            </ul>
          </Card>
        </section>
      </motion.div>

      {/* Dialogs */}
      <HostDialog
        open={hostOpen}
        onClose={() => {
          setHostOpen(false);
          refreshDevices();
        }}
        onSyncComplete={() => {
          setHostOpen(false);
          refreshDevices();
        }}
      />

      <ScanDialog
        open={scanOpen}
        onClose={() => {
          setScanOpen(false);
          refreshDevices();
        }}
        onSyncComplete={() => {
          setScanOpen(false);
          refreshDevices();
        }}
      />

      {resyncDevice && (
        <ResyncDialog
          open={!!resyncDevice}
          onClose={() => {
            setResyncDevice(null);
            refreshDevices();
          }}
          device={resyncDevice}
          onSyncComplete={() => {
            setResyncDevice(null);
            refreshDevices();
          }}
        />
      )}
    </div>
  );
}
