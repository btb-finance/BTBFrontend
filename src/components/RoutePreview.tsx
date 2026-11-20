'use client';
import { createContext, useContext, type ReactNode } from 'react';

/**
 * A server-rendered first view of the screen a visit opens on (src/components/previews): real text, and real data
 * where the server has it, in the HTML itself. Without it the first paint was a loading skeleton and the screen only
 * appeared once the whole app had downloaded and started, about 4 seconds on a mid-range phone.
 *
 * It stands in for every loading state on the way to that screen (the shell's skeleton, the wallet setup render, the
 * screen's own chunk), so the visitor never sees content, then a spinner, then content again. Only for `screen`:
 * a different tab opened before the app has loaded shows its normal loading state.
 */
export type RoutePreviewValue = { screen: string; node: ReactNode };

const PreviewContext = createContext<RoutePreviewValue | null>(null);
export const RoutePreviewProvider = PreviewContext.Provider;

/** The preview to show while loading, if the visit's preview is for this screen (any screen when omitted). */
export function useRoutePreview(screen?: string): ReactNode | null {
  const p = useContext(PreviewContext);
  return p && (screen == null || p.screen === screen) ? p.node : null;
}
