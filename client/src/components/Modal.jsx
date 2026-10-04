import { useEffect, useRef } from 'react';

/** Accessible modal: focus trap, Escape to close, labelled by its heading. */
export const Modal = ({ open, title, onClose, children, footer, width = '520px' }) => {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    headingRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={dialogRef}
        style={{ maxWidth: width }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="modal-title" tabIndex={-1} ref={headingRef}>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

/** Consistent confirmation dialog for destructive actions. */
export const ConfirmDialog = ({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel, busy = false }) => (
  <Modal
    open={open}
    title={title}
    onClose={onCancel}
    width="420px"
    footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button
          type="button"
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </>
    }
  >
    <p>{message}</p>
  </Modal>
);

export default Modal;
