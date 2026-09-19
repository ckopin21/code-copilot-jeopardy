import { useEffect, type RefObject } from 'react';

export function useOutsideDismiss(
  open: boolean,
  onDismiss: () => void,
  panelRef: RefObject<HTMLElement | null>,
  triggerRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || triggerRef?.current?.contains(target)) return;
      onDismiss();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onDismiss, panelRef, triggerRef]);
}
