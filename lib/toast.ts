'use client';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastMessage[]) => void;

class ToastManager {
  private toasts: ToastMessage[] = [];
  private listeners: Set<ToastListener> = new Set();
  private counter: number = 0;

  public subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notify(toast: Omit<ToastMessage, 'id'>) {
    const id = `toast-${Date.now()}-${++this.counter}`;
    const newToast: ToastMessage = { ...toast, id };
    this.toasts = [...this.toasts, newToast];
    this.emit();

    const duration = toast.duration ?? 3500;
    setTimeout(() => {
      this.remove(id);
    }, duration);

    return id;
  }

  public remove(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emit();
  }

  private emit() {
    this.listeners.forEach((listener) => {
      listener(this.toasts);
    });
  }
}

export const toastManager = new ToastManager();

if (typeof window !== 'undefined') {
  (window as any).__portos_notify = (toast: Omit<ToastMessage, 'id'>) => {
    return toastManager.notify(toast);
  };
}
