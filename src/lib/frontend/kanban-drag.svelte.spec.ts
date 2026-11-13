import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KanbanDrag } from './kanban-drag.svelte';

const COLUMNS = ['todo', 'doing', 'done'] as const;

function dragEvent() {
  return { preventDefault: vi.fn(), dataTransfer: null } as unknown as DragEvent;
}

describe(KanbanDrag.name, () => {
  // Reset clears the page's text selection lock; the node test env has no DOM
  beforeEach(() => vi.stubGlobal('document', { body: { style: {} } }));
  afterEach(() => vi.unstubAllGlobals());

  it('reports a drop into another column and resets', async () => {
    const onDrop = vi.fn();
    const drag = new KanbanDrag(COLUMNS, onDrop);

    drag.dragStart(dragEvent(), 'card-1', 'todo');
    drag.dragOver(dragEvent(), 'doing');
    expect(drag.overColumn).toBe('doing');

    await drag.drop(dragEvent(), 'doing');
    expect(onDrop).toHaveBeenCalledWith('card-1', 'doing');
    expect(drag.draggedId).toBeNull();
    expect(drag.overColumn).toBeNull();
  });

  it('ignores a drop back into the starting column', async () => {
    const onDrop = vi.fn();
    const drag = new KanbanDrag(COLUMNS, onDrop);

    drag.dragStart(dragEvent(), 'card-1', 'todo');
    await drag.drop(dragEvent(), 'todo');

    expect(onDrop).not.toHaveBeenCalled();
    expect(drag.draggedId).toBeNull();
  });
});
