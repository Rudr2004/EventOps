import { Modal } from './modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="confirm-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
        <button type="button" className="btn-danger" onClick={onConfirm} disabled={isPending}>
          {isPending ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
