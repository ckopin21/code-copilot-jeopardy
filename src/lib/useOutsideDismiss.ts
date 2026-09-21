import { useEffect, type RefObject } from 'react';

type OutsideDismissOptions = {
  dismissOnEscape?: boolean;
  trapFocus?: boolean;
};

const focusableSelector = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

export function useOutsideDismiss(
  open: boolean,
  onDismiss: () => void,
  panelRef: RefObject<HTMLElement | null>,
  triggerRef?: RefObject<HTMLElement | null>,
  options: OutsideDismissOptions = {}
) {
  const { dismissOnEscape = true, trapFocus = true } = options;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || triggerRef?.current?.contains(target)) return;
      onDismiss();
    };

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const trigger = triggerRef?.current ?? null;
    const focusInitial = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector<HTMLElement>('[autofocus], [data-modal-initial-focus], button:not([disabled]), [href], input:not([disabled])');
      (target ?? panel).focus();
    };
    queueMicrotask(focusInitial);

    const onKeyDown = (event: KeyboardEvent) => {
      if (dismissOnEscape && event.key === 'Escape') onDismiss();
      if (!trapFocus || event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hasAttribute('disabled') && element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    // A dialog may intentionally be nondismissible while it is still open. Its
    // keyboard focus must remain contained in that case, so focus trapping is
    // not contingent on Escape dismissal being enabled.
    if (dismissOnEscape || trapFocus) document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      if (dismissOnEscape || trapFocus) document.removeEventListener('keydown', onKeyDown);
      const restore = trigger ?? previousFocus;
      if (restore?.isConnected) queueMicrotask(() => restore.focus());
    };
  }, [open, onDismiss, panelRef, triggerRef, dismissOnEscape, trapFocus]);
}
