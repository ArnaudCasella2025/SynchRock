import { useRef, useState } from 'react';

/** Enables pointer-based (mouse + touch) drag-to-reorder for a list backed by
 * plain array state, without pulling in a DnD library. While dragging, the
 * item is swapped into whichever slot the pointer is currently over based on
 * each row's live bounding box, and the reordered array is reported
 * immediately so the list reflows as you drag rather than only on drop. */
export function useDragReorder<T>(items: T[], onChange: (next: T[]) => void) {
  const nodesRef = useRef(new Map<T, HTMLElement>());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const draggingRef = useRef<T | null>(null);
  const [draggingItem, setDraggingItem] = useState<T | null>(null);

  function setItemRef(item: T) {
    return (el: HTMLElement | null) => {
      if (el) nodesRef.current.set(item, el);
      else nodesRef.current.delete(item);
    };
  }

  function handlePointerDown(item: T) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = item;
      setDraggingItem(item);

      const onMove = (ev: PointerEvent): void => {
        const dragged = draggingRef.current;
        if (dragged === null) return;
        const current = itemsRef.current;
        const fromIndex = current.indexOf(dragged);
        if (fromIndex === -1) return;

        let toIndex = current.length - 1;
        for (let i = 0; i < current.length; i++) {
          const el = nodesRef.current.get(current[i]);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (ev.clientY < rect.top + rect.height / 2) {
            toIndex = i;
            break;
          }
        }

        if (toIndex !== fromIndex) {
          const next = current.slice();
          next.splice(fromIndex, 1);
          next.splice(toIndex, 0, dragged);
          onChange(next);
        }
      };

      const onUp = (): void => {
        draggingRef.current = null;
        setDraggingItem(null);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
  }

  return { setItemRef, handlePointerDown, draggingItem };
}
