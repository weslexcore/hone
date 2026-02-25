"use client";

import { QRCodeSVG } from "qrcode.react";

interface QrDisplayProps {
  value: string;
  size?: number;
}

export function QrDisplay({ value, size = 200 }: QrDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl bg-white p-4">
        <QRCodeSVG value={value} size={size} level="M" marginSize={0} />
      </div>
      <p className="text-xs text-text-muted text-center max-w-[240px]">
        Scan this QR code with your other device to connect
      </p>
    </div>
  );
}
