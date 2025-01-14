'use client';

import { useCallback, useEffect, useState } from 'react';

interface KeyboardNavigationOptions {
  onEnter?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onTab?: () => void;
  enabled?: boolean;
}

export function useKeyboardNavigation({
  onEnter,
  onEscape,
  onArrowUp,
  onArrowDown,
  onArrowLeft,
  onArrowRight,
  onTab,
  enabled = true,
}: KeyboardNavigationOptions) {
  const [focusIndex, setFocusIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      switch (event.key) {
        case 'Enter':
          onEnter?.();
          break;
        case 'Escape':
          onEscape?.();
          break;
        case 'ArrowUp':
          event.preventDefault();
          onArrowUp?.();
          break;
        case 'ArrowDown':
          event.preventDefault();
          onArrowDown?.();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          onArrowLeft?.();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onArrowRight?.();
          break;
        case 'Tab':
          onTab?.();
          break;
      }
    },
    [enabled, onEnter, onEscape, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onTab]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  return {
    focusIndex,
    setFocusIndex,
  };
}

export function useAccessibleFocus(itemCount: number) {
  const [focusIndex, setFocusIndex] = useState(-1);

  const handleArrowUp = useCallback(() => {
    setFocusIndex((prev) => (prev <= 0 ? itemCount - 1 : prev - 1));
  }, [itemCount]);

  const handleArrowDown = useCallback(() => {
    setFocusIndex((prev) => (prev >= itemCount - 1 ? 0 : prev + 1));
  }, [itemCount]);

  const handleTabNavigation = useCallback(() => {
    setFocusIndex((prev) => (prev >= itemCount - 1 ? 0 : prev + 1));
  }, [itemCount]);

  useKeyboardNavigation({
    onArrowUp: handleArrowUp,
    onArrowDown: handleArrowDown,
    onTab: handleTabNavigation,
  });

  return {
    focusIndex,
    setFocusIndex,
  };
}

export function useAccessibleDialog(onClose?: () => void) {
  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [onClose]);
}
