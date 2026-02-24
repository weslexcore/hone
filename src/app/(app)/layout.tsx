"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AppProvider } from "@/providers/app-provider";
import { ToastProvider } from "@/components/ui/toast";
import { SidebarProvider } from "@/providers/sidebar-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <ToastProvider>
        <SidebarProvider>
          <div className="flex h-dvh overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
        </SidebarProvider>
      </ToastProvider>
    </AppProvider>
  );
}
