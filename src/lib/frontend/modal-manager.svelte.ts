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

type ModalProps = Record<string, unknown>;

type OpenModal = {
  id: symbol;
  component: Component<ModalProps>;
  props: ModalProps;
};

type CloseProps = { onClose: (result?: never) => void };
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
      // The stack holds modals with different props, so each is stored with loose props.
      const entry = {
        id,
        component: component as Component<ModalProps>,
        props: { ...props, onClose },
      };
      this.stack = [...this.stack, entry];
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
