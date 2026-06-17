"use client";
import { useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Debounced auto-save: when `value` changes, persist it after `delay` ms.
 * Returns a save-state for a "Saving… / Saved" indicator. Skips the first run.
 */
export function useAutoSave<T>(value: T, save: (v: T) => Promise<void>, delay = 400): SaveState {
  const [state, setState] = useState<SaveState>("idle");
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setState("saving");
    timer.current = setTimeout(async () => {
      try {
        await save(value);
        setState("saved");
      } catch {
        setState("error");
      }
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return state;
}
