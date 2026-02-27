"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";

interface UsageBucket {
  used: number;
  limit: number;
}

interface UsageData {
  daily: UsageBucket;
  monthly: UsageBucket;
}

export function useUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setUsage(null);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/usage");
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch {
      // Silently fail — usage display is non-critical
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { usage, isLoading, refresh };
}
