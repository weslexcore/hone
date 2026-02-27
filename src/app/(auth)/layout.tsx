"use client";

import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="flex min-h-dvh items-center justify-center p-4">{children}</div>
      </AuthProvider>
    </ThemeProvider>
  );
}
