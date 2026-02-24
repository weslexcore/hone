"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseTimerOptions {
  durationSeconds: number;
  onComplete?: () => void;
}

export function useTimer({ durationSeconds, onComplete }: UseTimerOptions) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);

  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(durationSeconds);
  const rafRef = useRef<number>(0);
  const onCompleteRef = useRef(onComplete);
  const hasStartedRef = useRef(false);
  const isUntimedRef = useRef(durationSeconds === 0);
  const elapsedAccumRef = useRef(0);
  // Track the current segment's total duration for progress calculation
  const segmentDurationRef = useRef(durationSeconds);

  onCompleteRef.current = onComplete;

  // Sync remaining when durationSeconds changes (e.g. async session load),
  // but only if the timer hasn't been started yet.
  useEffect(() => {
    if (!hasStartedRef.current) {
      setRemaining(durationSeconds);
      pausedAtRef.current = durationSeconds;
      isUntimedRef.current = durationSeconds === 0;
      segmentDurationRef.current = durationSeconds;
    }
  }, [durationSeconds]);

  const tick = useCallback(() => {
    const segmentElapsed = (Date.now() - startTimeRef.current) / 1000;
    setTotalElapsed(elapsedAccumRef.current + segmentElapsed);

    if (isUntimedRef.current) {
      // Stopwatch mode: just track elapsed, never complete
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const left = Math.max(0, pausedAtRef.current - segmentElapsed);
    setRemaining(left);

    if (left <= 0) {
      setIsRunning(false);
      setIsComplete(true);
      onCompleteRef.current?.();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(() => {
    hasStartedRef.current = true;
    startTimeRef.current = Date.now();
    if (!isUntimedRef.current) {
      pausedAtRef.current = remaining;
    }
    setIsRunning(true);
    setIsComplete(false);
  }, [remaining]);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    pausedAtRef.current = remaining;
    // Accumulate elapsed time
    const segmentElapsed = (Date.now() - startTimeRef.current) / 1000;
    elapsedAccumRef.current += segmentElapsed;
  }, [remaining]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setIsComplete(false);
    hasStartedRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setRemaining(durationSeconds);
    pausedAtRef.current = durationSeconds;
    isUntimedRef.current = durationSeconds === 0;
    segmentDurationRef.current = durationSeconds;
    elapsedAccumRef.current = 0;
    setTotalElapsed(0);
  }, [durationSeconds]);

  /** Add more time — typically called when timer expires */
  const extend = useCallback(
    (seconds: number) => {
      setRemaining(seconds);
      pausedAtRef.current = seconds;
      segmentDurationRef.current = seconds;
      setIsComplete(false);
      isUntimedRef.current = false;
      // Preserve elapsed so far
      elapsedAccumRef.current = totalElapsed;
      startTimeRef.current = Date.now();
      setIsRunning(true);
    },
    [totalElapsed],
  );

  /** Change duration before timer has started */
  const setDuration = useCallback((newDuration: number) => {
    if (hasStartedRef.current) return;
    setRemaining(newDuration);
    pausedAtRef.current = newDuration;
    isUntimedRef.current = newDuration === 0;
    segmentDurationRef.current = newDuration;
  }, []);

  /** Switch to untimed (stopwatch) mode — can be called even after timer started */
  const removeLimit = useCallback(() => {
    isUntimedRef.current = true;
    setIsComplete(false);
    setRemaining(0);
    pausedAtRef.current = 0;
    segmentDurationRef.current = 0;
    // If not currently running, start the stopwatch
    if (!isRunning) {
      elapsedAccumRef.current = totalElapsed;
      startTimeRef.current = Date.now();
      hasStartedRef.current = true;
      setIsRunning(true);
    }
  }, [isRunning, totalElapsed]);

  useEffect(() => {
    if (isRunning) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, tick]);

  // Progress: 0→1 for current segment. 0 for untimed mode.
  const progress =
    isUntimedRef.current || segmentDurationRef.current === 0
      ? 0
      : Math.max(0, Math.min(1, 1 - remaining / segmentDurationRef.current));

  return {
    remaining,
    elapsed: totalElapsed,
    progress,
    isRunning,
    isComplete,
    isUntimed: isUntimedRef.current,
    start,
    pause,
    reset,
    extend,
    setDuration,
    removeLimit,
  };
}
