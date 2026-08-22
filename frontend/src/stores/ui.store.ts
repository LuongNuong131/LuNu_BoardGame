import { defineStore } from 'pinia';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';
type ToastItem = { id: number; tone: ToastTone; title: string; message: string };

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ToastTone;
  resolve: ((value: boolean) => void) | null;
};

let toastSequence = 0;

export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [] as ToastItem[],
    confirm: { open: false, title: '', message: '', confirmLabel: 'Xác nhận', cancelLabel: 'Hủy', tone: 'warning' as ToastTone, resolve: null } as ConfirmState
  }),
  actions: {
    notify(message: string, tone: ToastTone = 'info', title?: string) {
      const item = { id: ++toastSequence, tone, title: title || ({ success: 'Đã hoàn tất', error: 'Có lỗi xảy ra', warning: 'Cần xác nhận', info: 'LuNu Club' }[tone]), message };
      this.toasts.push(item);
      window.setTimeout(() => this.dismiss(item.id), 4600);
    },
    success(message: string, title = 'Thành công') { this.notify(message, 'success', title); },
    error(message: string, title = 'Không thể thực hiện') { this.notify(message, 'error', title); },
    dismiss(id: number) { this.toasts = this.toasts.filter((toast) => toast.id !== id); },
    confirmAction(message: string, options: Partial<Pick<ConfirmState, 'title' | 'confirmLabel' | 'cancelLabel' | 'tone'>> = {}) {
      if (this.confirm.resolve) this.confirm.resolve(false);
      return new Promise<boolean>((resolve) => {
        this.confirm = { open: true, message, title: options.title || 'Xác nhận thao tác', confirmLabel: options.confirmLabel || 'Xác nhận', cancelLabel: options.cancelLabel || 'Hủy', tone: options.tone || 'warning', resolve };
      });
    },
    resolveConfirm(value: boolean) {
      const resolve = this.confirm.resolve;
      this.confirm = { open: false, title: '', message: '', confirmLabel: 'Xác nhận', cancelLabel: 'Hủy', tone: 'warning', resolve: null };
      resolve?.(value);
    }
  }
});
