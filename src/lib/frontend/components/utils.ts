export interface ModalProps {
  onClose: () => void;
}

export type CreateOrUpdate<T> = { type: 'new' } | { type: 'edit'; item: T };
