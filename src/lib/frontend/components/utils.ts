export interface ModalProps {
  onClose: () => void;
}

export type CreateOrUpdate<T> = { type: 'new' } | { type: 'edit'; item: T };

export function toFixedDown(num: number, decimals: number) {
  const factor = 10 ** decimals;
  return (Math.floor(num * factor) / factor).toFixed(decimals);
}
