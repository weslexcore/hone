import Peer, { type DataConnection } from "peerjs";
import { getDeviceId, getDeviceName } from "./device-id";

export type ConnectionState =
  | "idle"
  | "initializing"
  | "waiting"
  | "connecting"
  | "connected"
  | "syncing"
  | "complete"
  | "error";

export interface SyncMessage {
  type:
    | "handshake"
    | "handshake-ack"
    | "sync-request"
    | "sync-data"
    | "sync-chunk"
    | "sync-complete"
    | "error";
  deviceId: string;
  deviceName: string;
  payload?: unknown;
}

export interface ChunkMeta {
  chunkIndex: number;
  totalChunks: number;
  data: string;
}

const PEER_ID_PREFIX = "hone-";
const CHUNK_SIZE = 64 * 1024; // 64KB chunks for large data

export function buildPeerId(deviceId: string, sessionSuffix: string): string {
  return `${PEER_ID_PREFIX}${deviceId}-${sessionSuffix}`;
}

export function createPeer(peerId: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerId, {
      debug: 0,
    });

    const timeout = setTimeout(() => {
      peer.destroy();
      reject(new Error("Peer initialization timed out"));
    }, 15000);

    peer.on("open", () => {
      clearTimeout(timeout);
      resolve(peer);
    });

    peer.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export function connectToPeer(peer: Peer, remotePeerId: string): Promise<DataConnection> {
  return new Promise((resolve, reject) => {
    const conn = peer.connect(remotePeerId, { reliable: true });

    const timeout = setTimeout(() => {
      conn.close();
      reject(new Error("Connection timed out"));
    }, 15000);

    conn.on("open", () => {
      clearTimeout(timeout);
      resolve(conn);
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export function sendMessage(conn: DataConnection, msg: SyncMessage): void {
  conn.send(JSON.stringify(msg));
}

export function sendChunked(conn: DataConnection, data: string, deviceId: string): void {
  const totalChunks = Math.ceil(data.length / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const msg: SyncMessage = {
      type: "sync-chunk",
      deviceId,
      deviceName: getDeviceName(),
      payload: {
        chunkIndex: i,
        totalChunks,
        data: chunk,
      } satisfies ChunkMeta,
    };
    conn.send(JSON.stringify(msg));
  }
}

export function parseMessage(raw: unknown): SyncMessage | null {
  try {
    if (typeof raw === "string") {
      return JSON.parse(raw) as SyncMessage;
    }
    return raw as SyncMessage;
  } catch {
    return null;
  }
}

export function createHandshake(): SyncMessage {
  return {
    type: "handshake",
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
  };
}

export function createHandshakeAck(): SyncMessage {
  return {
    type: "handshake-ack",
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
  };
}
