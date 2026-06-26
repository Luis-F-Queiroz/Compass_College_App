"use client";
import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type T = { id: number; msg: string; kind: "ok" | "error" };
const ToastCtx = createContext<(msg: string, kind?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<T[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const dismiss = useCallback((id: number) => {
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);
  const arm = useCallback((id: number) => {
    timers.current[id] = setTimeout(() => dismiss(id), 2600);
  }, [dismiss]);
  const push = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    arm(id);
  }, [arm]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={"toast " + t.kind}
              onMouseEnter={() => { if (timers.current[t.id]) clearTimeout(timers.current[t.id]); }}
              onMouseLeave={() => arm(t.id)}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <span>{t.msg}</span>
              <button className="toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>✕</button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
