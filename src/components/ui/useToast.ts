import { createContext, useContext } from 'react';
import type { ToastTone } from './Toast';

export interface ToastContextValue {
  show: (message: string, options?: { tone?: ToastTone; duration?: number }) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast doit être appelé dans un <ToastProvider>');
  }
  return ctx;
}
