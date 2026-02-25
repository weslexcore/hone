"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  PenTool,
  Timer,
  RefreshCw,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { ModelSwitcher } from "@/components/layout/model-switcher";
import { useSidebar } from "@/providers/sidebar-provider";

const navItems = [
  { href: "/dashboard", label: "Projects", icon: LayoutDashboard },
  { href: "/practice", label: "Practice", icon: Timer },
  { href: "/sync", label: "Sync", icon: RefreshCw },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({
  collapsed = false,
  onCollapse,
  onNavClick,
}: {
  collapsed?: boolean;
  onCollapse?: () => void;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
          <PenTool size={16} className="text-accent" />
        </div>
        {!collapsed && (
          <span className="font-serif text-lg font-semibold tracking-tight text-text-primary">
            Hone
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent-muted text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover",
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer: Model switcher + Collapse toggle */}
      <div className="border-t border-border p-3 space-y-1">
        <ModelSwitcher collapsed={collapsed} />
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="flex w-full items-center justify-center rounded-lg py-2 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { mobileOpen, setMobileOpen } = useSidebar();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-surface-raised transition-all duration-200",
          collapsed ? "w-16" : "w-56",
        )}
      >
        <SidebarContent collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col border-r border-border bg-surface-raised md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="absolute right-3 top-4 z-10">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1 text-text-muted hover:text-text-primary transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <SidebarContent onNavClick={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
