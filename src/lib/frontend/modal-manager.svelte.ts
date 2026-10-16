import type { Component } from 'svelte';
import ConfirmDialog from './components/ConfirmDialog.svelte';

export type ConfirmVariant = 'default' | 'destructive';

export type ConfirmOptions = {
  title: string;
  prompt: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  hideCancel?: boolean;
};

type OpenModal = {
  id: symbol;
  component: Component<any>;
  props: Record<string, unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CloseProps = { onClose: (result?: any) => void };
type CloseResult<P extends CloseProps> = Parameters<P['onClose']>[0];

class ModalManager {
  stack = $state<OpenModal[]>([]);

  show<P extends CloseProps>(
    component: Component<P>,
    props?: Omit<P, 'onClose'>,
  ): Promise<CloseResult<P> | undefined> {
    return new Promise((resolve) => {
      const id = Symbol();
      const onClose = (result?: CloseResult<P>) => {
        this.stack = this.stack.filter((modal) => modal.id !== id);
        resolve(result);
      };
      this.stack = [...this.stack, { id, component, props: { ...props, onClose } }];
    });
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    return (await this.show(ConfirmDialog, options)) === true;
  }
}

let modalManager: ModalManager;

if (import.meta.hot) {
  if (!import.meta.hot.data.modalManager) {
    import.meta.hot.data.modalManager = new ModalManager();
  }
  modalManager = import.meta.hot.data.modalManager;
} else {
  modalManager = new ModalManager();
}

export { modalManager };
