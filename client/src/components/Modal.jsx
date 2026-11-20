import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Modal.scss';

/**
 * A dialog rendered into document.body.
 *
 * `onClose` is called for Escape, backdrop clicks and the close button. Pass
 * `dismissible={false}` for dialogs that can only be left through their own
 * actions (the end-of-game dialog), and `closeDisabled` to temporarily block
 * closing (for example while a search is running).
 */
export function Modal({ title, onClose, dismissible = true, closeDisabled = false, footer, children }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const canClose = dismissible && !closeDisabled;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    if (!canClose) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [canClose, onClose]);

  return createPortal(
    <div
      className="modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && canClose) onClose();
      }}
    >
      <div className="modal__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
        <div className="modal__header">
          <h1 className="modal__title" id={titleId}>
            {title}
          </h1>
          {dismissible && (
            <button type="button" className="modal__close" aria-label="Close" disabled={closeDisabled} onClick={onClose}>
              ×
            </button>
          )}
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
