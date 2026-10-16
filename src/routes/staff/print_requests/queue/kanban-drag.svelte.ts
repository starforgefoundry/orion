import type { PrintRequestStatus } from '$lib/remotes/dtos/print_request.dto';
import type { Attachment } from 'svelte/attachments';

const LONG_PRESS_MS = 300;
const MOVE_TOLERANCE_PX = 10;
const EDGE_SCROLL_ZONE_PX = 80;
const EDGE_SCROLL_SPEED_PX = 12;
const SCROLL_FRAME_MS = 16;
const PICKUP_VIBRATE_MS = 15;
const COLUMN_ATTRIBUTE = 'data-column-id';

type DropHandler = (requestId: string, column: PrintRequestStatus) => Promise<void> | void;

type TouchSession = {
  requestId: string;
  column: PrintRequestStatus;
  element: HTMLElement;
  startX: number;
  startY: number;
  pressTimer: ReturnType<typeof setTimeout>;
  clone?: HTMLElement;
  rect?: DOMRect;
};

export class KanbanDrag {
  draggedId = $state<string | null>(null);
  overColumn = $state<PrintRequestStatus | null>(null);
  isTouchDragging = $state(false);

  #fromColumn: PrintRequestStatus | null = null;
  #onDrop: DropHandler;
  #scrollContainer?: HTMLElement;
  #touch?: TouchSession;
  #pointer = { x: 0, y: 0 };
  #scrollTimer?: ReturnType<typeof setInterval>;

  constructor(onDrop: DropHandler) {
    this.#onDrop = onDrop;
  }

  setScrollContainer(element: HTMLElement | undefined) {
    this.#scrollContainer = element;
  }

  // Mouse drag (HTML5 drag and drop)

  dragStart(event: DragEvent, requestId: string, column: PrintRequestStatus) {
    this.draggedId = requestId;
    this.#fromColumn = column;
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.#startAutoScroll();
  }

  drag(event: DragEvent) {
    // Browsers report 0,0 for the final drag event
    if (event.clientX === 0 && event.clientY === 0) return;
    this.#pointer = { x: event.clientX, y: event.clientY };
  }

  dragOver(event: DragEvent, column: PrintRequestStatus) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.overColumn = column;
  }

  dragLeave(event: DragEvent) {
    const target = event.currentTarget as HTMLElement;
    if (target.contains(event.relatedTarget as Node | null)) return;
    this.overColumn = null;
  }

  async drop(event: DragEvent, column: PrintRequestStatus) {
    event.preventDefault();
    await this.#finish(column);
  }

  dragEnd() {
    this.#reset();
  }

  // Touch drag: long-press a card to pick it up so normal swipes still scroll the page

  touch(requestId: string, column: PrintRequestStatus): Attachment<HTMLElement> {
    return (element) => {
      const onStart = (event: TouchEvent) => this.#touchStart(event, element, requestId, column);
      const onMove = (event: TouchEvent) => this.#touchMove(event);
      const onEnd = (event: TouchEvent) => this.#touchEnd(event);
      const onCancel = () => this.#reset();

      element.addEventListener('touchstart', onStart, { passive: true });
      element.addEventListener('touchmove', onMove, { passive: false });
      element.addEventListener('touchend', onEnd);
      element.addEventListener('touchcancel', onCancel);

      return () => {
        element.removeEventListener('touchstart', onStart);
        element.removeEventListener('touchmove', onMove);
        element.removeEventListener('touchend', onEnd);
        element.removeEventListener('touchcancel', onCancel);
      };
    };
  }

  #touchStart(
    event: TouchEvent,
    element: HTMLElement,
    requestId: string,
    column: PrintRequestStatus,
  ) {
    const interactive = (event.target as HTMLElement).closest('button, a');
    if (interactive && interactive !== element) return;

    const touch = event.touches[0];
    this.#touch = {
      requestId,
      column,
      element,
      startX: touch.clientX,
      startY: touch.clientY,
      pressTimer: setTimeout(() => this.#pickUp(), LONG_PRESS_MS),
    };
    this.#pointer = { x: touch.clientX, y: touch.clientY };
  }

  #pickUp() {
    const session = this.#touch;
    if (!session) return;

    session.rect = session.element.getBoundingClientRect();
    session.clone = createDragClone(session.element, session.rect);
    session.element.style.opacity = '0.3';
    document.body.appendChild(session.clone);
    document.body.style.userSelect = 'none';

    this.draggedId = session.requestId;
    this.#fromColumn = session.column;
    this.overColumn = session.column;
    this.isTouchDragging = true;

    navigator.vibrate?.(PICKUP_VIBRATE_MS);
    this.#startAutoScroll();
  }

  #touchMove(event: TouchEvent) {
    const session = this.#touch;
    if (!session) return;

    const touch = event.touches[0];
    this.#pointer = { x: touch.clientX, y: touch.clientY };

    if (!this.isTouchDragging) {
      const moved =
        Math.abs(touch.clientX - session.startX) > MOVE_TOLERANCE_PX ||
        Math.abs(touch.clientY - session.startY) > MOVE_TOLERANCE_PX;
      if (moved) this.#reset();
      return;
    }

    event.preventDefault();
    if (session.clone && session.rect) {
      session.clone.style.left = `${session.rect.left + touch.clientX - session.startX}px`;
      session.clone.style.top = `${session.rect.top + touch.clientY - session.startY}px`;
    }
    this.#updateTouchTarget();
  }

  async #touchEnd(event: TouchEvent) {
    if (!this.isTouchDragging) {
      this.#reset();
      return;
    }

    event.preventDefault();
    await this.#finish(this.overColumn);
  }

  #updateTouchTarget() {
    const clone = this.#touch?.clone;
    if (clone) clone.style.display = 'none';
    const element = document.elementFromPoint(this.#pointer.x, this.#pointer.y);
    if (clone) clone.style.display = '';

    const column = element?.closest(`[${COLUMN_ATTRIBUTE}]`)?.getAttribute(COLUMN_ATTRIBUTE);
    if (column) this.overColumn = column as PrintRequestStatus;
  }

  // Shared

  async #finish(column: PrintRequestStatus | null) {
    const requestId = this.draggedId;
    const moved = requestId && column && column !== this.#fromColumn;
    this.#reset();
    if (moved) await this.#onDrop(requestId, column);
  }

  #startAutoScroll() {
    this.#scrollTimer ??= setInterval(() => this.#autoScrollStep(), SCROLL_FRAME_MS);
  }

  #autoScrollStep() {
    const { x, y } = this.#pointer;
    const container = this.#scrollContainer;

    if (container && container.scrollWidth > container.clientWidth) {
      const rect = container.getBoundingClientRect();
      if (x < rect.left + EDGE_SCROLL_ZONE_PX) container.scrollLeft -= EDGE_SCROLL_SPEED_PX;
      else if (x > rect.right - EDGE_SCROLL_ZONE_PX) container.scrollLeft += EDGE_SCROLL_SPEED_PX;
    }

    if (y < EDGE_SCROLL_ZONE_PX) window.scrollBy(0, -EDGE_SCROLL_SPEED_PX);
    else if (y > window.innerHeight - EDGE_SCROLL_ZONE_PX) window.scrollBy(0, EDGE_SCROLL_SPEED_PX);

    if (this.isTouchDragging) this.#updateTouchTarget();
  }

  #reset() {
    if (this.#touch) {
      clearTimeout(this.#touch.pressTimer);
      this.#touch.clone?.remove();
      this.#touch.element.style.opacity = '';
      this.#touch = undefined;
    }
    clearInterval(this.#scrollTimer);
    this.#scrollTimer = undefined;
    document.body.style.userSelect = '';

    this.draggedId = null;
    this.overColumn = null;
    this.isTouchDragging = false;
    this.#fromColumn = null;
  }
}

function createDragClone(element: HTMLElement, rect: DOMRect) {
  const clone = element.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: '9999',
    pointerEvents: 'none',
    opacity: '0.9',
    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
    transform: 'rotate(2deg)',
  });
  return clone;
}
