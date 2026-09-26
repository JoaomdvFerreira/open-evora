import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconStateAffirmed, IconStateClosed, IconStateOpen } from "./icons";

export type ToastTone = "affirmed" | "neutral" | "error";

interface ToastNotification {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (message: string, tone: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({ notify: () => {} });

const TOAST_LIFETIME_MS: Record<ToastTone, number> = {
  affirmed: 4_000,
  neutral: 4_000,
  error: 6_000,
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "affirmed") return <IconStateAffirmed />;
  if (tone === "error") return <IconStateClosed />;
  return <IconStateOpen />;
}

/** Transient action feedback. Message and tone remain caller-owned. */
export function Toast({ notification, onDismiss }: { notification: ToastNotification; onDismiss: (id: number) => void }) {
  const liveRole = notification.tone === "error" ? "alert" : "status";

  return (
    <div className={`ui-toast ui-toast--${notification.tone}`}>
      <span className="ui-toast-icon" aria-hidden="true">
        <ToneIcon tone={notification.tone} />
      </span>
      <p className="ui-toast-message" role={liveRole}>
        {notification.message}
      </p>
      <button type="button" className="ui-toast-close" aria-label="Fechar notificação" onClick={() => onDismiss(notification.id)}>
        <IconStateClosed />
      </button>
    </div>
  );
}

/** Fixed, single-item viewport. Replacement and repeated messages restart their lifetime. */
export function ToastViewport({ notification, onDismiss }: { notification: ToastNotification | null; onDismiss: (id: number) => void }) {
  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => onDismiss(notification.id), TOAST_LIFETIME_MS[notification.tone]);
    return () => window.clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  return (
    <div className="ui-toast-viewport">
      <Toast notification={notification} onDismiss={onDismiss} />
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const [notification, setNotification] = useState<ToastNotification | null>(null);
  const notify = useCallback((message: string, tone: ToastTone) => {
    nextId.current += 1;
    setNotification({ id: nextId.current, message, tone });
  }, []);
  const dismiss = useCallback((id: number) => {
    setNotification((current) => (current?.id === id ? null : current));
  }, []);
  const contextValue = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastViewport notification={notification} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
