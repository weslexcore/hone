"use client";

import type { ReactNode } from "react";
import { AIProviderComponent } from "./ai-provider";
import { ThemeProvider } from "./theme-provider";

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AIProviderComponent>{children}</AIProviderComponent>
    </ThemeProvider>
  );
}
