"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  active: boolean;
}

export function QrScanner({ onScan, onError, active }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [started, setStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  const handleScan = useCallback(
    (decodedText: string) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      onScan(decodedText);
    },
    [onScan],
  );

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const elementId = "hone-qr-reader";
    let scanner: Html5Qrcode | null = null;
    scannedRef.current = false;

    const start = async () => {
      try {
        scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          handleScan,
          () => {
            // Scan failure is normal (no QR in frame yet)
          },
        );
        setStarted(true);
        setCameraError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Camera access denied";
        setCameraError(msg);
        onError?.(msg);
      }
    };

    start();

    return () => {
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner?.clear())
          .catch(() => {});
        scannerRef.current = null;
        setStarted(false);
      }
    };
  }, [active, handleScan, onError]);

  if (!active) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-[280px] h-[280px] rounded-xl overflow-hidden bg-black">
        <div id="hone-qr-reader" ref={containerRef} className="w-full h-full" />
        {!started && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-white/60">Starting camera...</p>
          </div>
        )}
      </div>
      {cameraError ? (
        <p className="text-xs text-danger text-center max-w-[280px]">{cameraError}</p>
      ) : (
        <p className="text-xs text-text-muted text-center max-w-[280px]">
          Point your camera at the QR code on the other device
        </p>
      )}
    </div>
  );
}
