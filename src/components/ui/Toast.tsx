import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  duration: number;
}

interface ToastContextValue {
  show: (message: string, options?: { tone?: ToastTone; duration?: number }) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneConfig: Record<ToastTone, { icon: typeof CheckCircle2; bg: string; ring: string; iconColor: string }> = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-success-50',
    ring: 'ring-success-100',
    iconColor: 'text-success-600',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-danger-50',
    ring: 'ring-danger-100',
    iconColor: 'text-danger-600',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-warning-50',
    ring: 'ring-warning-100',
    iconColor: 'text-warning-600',
  },
  info: {
    icon: Info,
    bg: 'bg-info-50',
    ring: 'ring-info-100',
    iconColor: 'text-info-600',
  },
};

/**
 * ToastProvider — à placer une fois dans App.tsx, au-dessus des routes.
 *
 * Usage :
 *   const toast = useToast();
 *   toast.success('Séance enregistrée !');
 *   toast.error('Impossible de sauvegarder');
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, options?: { tone?: ToastTone; duration?: number }) => {
      const id = ++idRef.current;
      const toast: Toast = {
        id,
        tone: options?.tone ?? 'info',
        message,
        duration: options?.duration ?? 4000,
      };
      setToasts((prev) => [...prev, toast]);
      if (toast.duration > 0) {
        window.setTimeout(() => dismiss(id), toast.duration);
      }
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, duration) => show(message, { tone: 'success', duration }),
      error: (message, duration) => show(message, { tone: 'error', duration }),
      info: (message, duration) => show(message, { tone: 'info', duration }),
      warning: (message, duration) => show(message, { tone: 'warning', duration }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-4 right-4 left-4 lg:left-auto lg:max-w-sm z-[60] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const config = toneConfig[toast.tone];
  const Icon = config.icon;

  useEffect(() => {
    // No-op — duration timer lives in provider
  }, []);

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={[
        'pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-md ring-1',
        config.bg,
        config.ring,
        'animate-slide-down',
      ].join(' ')}
    >
      <Icon size={20} className={`${config.iconColor} shrink-0 mt-0.5`} aria-hidden="true" />
      <p className="flex-1 text-sm text-neutral-800">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Fermer la notification"
        className="shrink-0 text-neutral-400 hover:text-neutral-600 transition-colors"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast doit être appelé dans un <ToastProvider>');
  }
  return ctx;
}
