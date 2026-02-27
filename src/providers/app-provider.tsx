"use client";

import type { ReactNode } from "react";
import { AIProviderComponent } from "./ai-provider";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "./auth-provider";

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AIProviderComponent>{children}</AIProviderComponent>
      </AuthProvider>
    </ThemeProvider>
  );
}
