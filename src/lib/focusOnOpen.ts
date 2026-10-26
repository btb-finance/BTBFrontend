/**
 * Whether a search box should take focus when its picker opens: only with a mouse. On a touch screen focusing
 * pops the keyboard over the list before the user has asked to search.
 */
export function focusOnOpen(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
}
