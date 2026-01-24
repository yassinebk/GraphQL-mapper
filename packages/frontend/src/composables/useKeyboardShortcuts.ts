import { onMounted, onUnmounted } from "vue";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = (event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const ctrlMatch =
        shortcut.ctrl !== undefined
          ? shortcut.ctrl
            ? event.ctrlKey
            : !event.ctrlKey
          : !event.ctrlKey;
      const metaMatch =
        shortcut.meta !== undefined
          ? shortcut.meta
            ? event.metaKey
            : !event.metaKey
          : !event.metaKey;
      const shiftMatch =
        shortcut.shift !== undefined
          ? shortcut.shift
            ? event.shiftKey
            : !event.shiftKey
          : !event.shiftKey;
      const altMatch =
        shortcut.alt !== undefined
          ? shortcut.alt
            ? event.altKey
            : !event.altKey
          : !event.altKey;
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

      if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
        event.preventDefault();
        shortcut.handler();
        break;
      }
    }
  };

  onMounted(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return {
    shortcuts,
  };
}
