import { useEffect, type RefObject } from 'react';

type OutsideDismissOptions = {
  dismissOnEscape?: boolean;
};

export function useOutsideDismiss(
  open: boolean,
  onDismiss: () => void,
  panelRef: RefObject<HTMLElement | null>,
  triggerRef?: RefObject<HTMLElement | null>,
  options: OutsideDismissOptions = {}
) {
  const { dismissOnEscape = true } = options;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || triggerRef?.current?.contains(target)) return;
      onDismiss();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (dismissOnEscape && event.key === 'Escape') onDismiss();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    if (dismissOnEscape) document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      if (dismissOnEscape) document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onDismiss, panelRef, triggerRef, dismissOnEscape]);
}
