"use client";

import { useState, useCallback, useEffect } from "react";

export function useDistractionFree() {
  const [isActive, setIsActive] = useState(false);

  const toggle = useCallback(() => setIsActive((prev) => !prev), []);
  const enter = useCallback(() => setIsActive(true), []);
  const exit = useCallback(() => setIsActive(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && isActive) {
        exit();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, exit, isActive]);

  return { isActive, toggle, enter, exit };
}
