type DragDropHandler = (event: unknown) => void | Promise<void>;

const dragDropHandlers = new Set<DragDropHandler>();

export type DragDropEvent =
  | { type: 'enter'; paths?: string[] }
  | { type: 'over'; paths?: string[] }
  | { type: 'leave'; paths?: string[] }
  | { type: 'drop'; paths: string[] };

export function getCurrentWebview() {
  return {
    async onDragDropEvent(handler: DragDropHandler) {
      dragDropHandlers.add(handler);
      return () => {
        dragDropHandlers.delete(handler);
      };
    },
  };
}

