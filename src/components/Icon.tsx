'use client';

interface IconProps { name: string; size?: number; color?: string; }

export function Icon({ name, size = 22, color = '#fff' }: IconProps) {
  const s = { width: size, height: size, stroke: color, fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':    return <svg viewBox="0 0 24 24" {...s}><path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>;
    case 'swap':    return <svg viewBox="0 0 24 24" {...s}><path d="M7 4v16M7 4l-3 3M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/></svg>;
    case 'pie':     return <svg viewBox="0 0 24 24" {...s}><path d="M12 3v9h9"/><path d="M21 12a9 9 0 1 1-9-9"/></svg>;
    case 'nft':     return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="9" cy="9" r="1.5"/></svg>;
    case 'stake':   return <svg viewBox="0 0 24 24" {...s}><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 17l9 5 9-5"/></svg>;
    case 'arrow':   return <svg viewBox="0 0 24 24" {...s}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'search':  return <svg viewBox="0 0 24 24" {...s}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case 'down':    return <svg viewBox="0 0 24 24" {...s}><path d="M6 9l6 6 6-6"/></svg>;
    case 'up':      return <svg viewBox="0 0 24 24" {...s}><path d="M6 15l6-6 6 6"/></svg>;
    case 'settings':return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case 'bolt':    return <svg viewBox="0 0 24 24" {...s}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill={color} stroke="none"/></svg>;
    case 'send':    return <svg viewBox="0 0 24 24" {...s}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>;
    case 'receive': return <svg viewBox="0 0 24 24" {...s}><path d="M12 5v14M5 12l7 7 7-7"/></svg>;
    case 'plus':    return <svg viewBox="0 0 24 24" {...s}><path d="M12 5v14M5 12h14"/></svg>;
    case 'qr':      return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M21 14v7M14 21h7"/></svg>;
    case 'wallet':  return <svg viewBox="0 0 24 24" {...s}><path d="M3 7a2 2 0 0 1 2-2h13l3 4v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><circle cx="17" cy="13" r="1.4" fill={color} stroke="none"/></svg>;
    case 'check':   return <svg viewBox="0 0 24 24" {...s}><path d="M4 12l5 5L20 6"/></svg>;
    case 'fire':    return <svg viewBox="0 0 24 24" {...s}><path d="M12 2s5 4 5 10a5 5 0 0 1-10 0c0-3 2-5 2-8 0 2 3 2 3-2z"/></svg>;
    case 'lock':    return <svg viewBox="0 0 24 24" {...s}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    case 'gift':    return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="8" width="18" height="4"/><path d="M12 8v13M5 12v9h14v-9M7.5 8a2.5 2.5 0 1 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 1 1 0 5"/></svg>;
    case 'back':    return <svg viewBox="0 0 24 24" {...s}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>;
    case 'rocket':  return <svg viewBox="0 0 24 24" {...s}><path d="M12 2C8 2 5 6 5 10c0 4 3 6 3 6h8s3-2 3-6c0-4-3-8-7-8z"/><path d="M9 16v3a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3"/><path d="M9 10h6"/></svg>;
    case 'refresh': return <svg viewBox="0 0 24 24" {...s}><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9A9 9 0 0 1 20 8M20.5 15A9 9 0 0 1 4 16"/></svg>;
    case 'layers':  return <svg viewBox="0 0 24 24" {...s}><path d="M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/></svg>;
    case 'image':   return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
    case 'doc':     return <svg viewBox="0 0 24 24" {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>;
    case 'discord': return <svg viewBox="0 0 24 24" {...s}><path d="M20.3 4.4A18 18 0 0 0 16 3a12 12 0 0 0-.5 1.1 16.6 16.6 0 0 0-7 0A12 12 0 0 0 8 3 18 18 0 0 0 3.7 4.4 19 19 0 0 0 1 18.1a18.2 18.2 0 0 0 5.5 2.8 13.7 13.7 0 0 0 1.2-1.9 11.8 11.8 0 0 1-1.9-1l.5-.4a13 13 0 0 0 11.4 0l.5.4a11.8 11.8 0 0 1-1.9 1 13.7 13.7 0 0 0 1.2 1.9 18.2 18.2 0 0 0 5.5-2.8A19 19 0 0 0 20.3 4.4zM8.5 15.4c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3zm7 0c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3z"/></svg>;
    case 'twitter': return <svg viewBox="0 0 24 24" {...s}><path d="M4 4l16 16M4 20L20 4" strokeWidth="2.2"/></svg>;
    case 'github':  return <svg viewBox="0 0 24 24" {...s}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-4a3.1 3.1 0 0 0-.9-2.2c3-.3 6.2-1.5 6.2-6.6a5.1 5.1 0 0 0-1.4-3.6 4.9 4.9 0 0 0-.1-3.6s-1.1-.3-3.7 1.4a12.7 12.7 0 0 0-6.8 0C6.3 2.5 5.2 2.8 5.2 2.8a4.9 4.9 0 0 0-.1 3.6A5.1 5.1 0 0 0 3.7 10c0 5.1 3.1 6.3 6.1 6.6A3.1 3.1 0 0 0 9 18.9V22"/></svg>;
    case 'mail':    return <svg viewBox="0 0 24 24" {...s}><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>;
    case 'bank':    return <svg viewBox="0 0 24 24" {...s}><path d="M3 10h18M3 14h18M5 6l7-3 7 3M5 18v-8M9 18v-8M15 18v-8M19 18v-8M3 18h18"/></svg>;
    case 'chart':   return <svg viewBox="0 0 24 24" {...s}><path d="M3 3v18h18"/><path d="M18 9l-5 5-4-4-3 3"/></svg>;
    case 'bridge':  return <svg viewBox="0 0 24 24" {...s}><path d="M2 18h20M6 18V10a6 6 0 0 1 12 0v8"/><path d="M2 10h4M18 10h4"/></svg>;
    case 'vault':   return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4"/><path d="M12 8v1M12 15v1M8 12h1M15 12h1"/></svg>;
    case 'launch':  return <svg viewBox="0 0 24 24" {...s}><path d="M12 19V5M5 12l7-7 7 7"/><path d="M5 19h14"/></svg>;
    case 'shield':  return <svg viewBox="0 0 24 24" {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'vote':    return <svg viewBox="0 0 24 24" {...s}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
    case 'users':   return <svg viewBox="0 0 24 24" {...s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'map':     return <svg viewBox="0 0 24 24" {...s}><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/></svg>;
    case 'star':    return <svg viewBox="0 0 24 24" {...s}><path d="M12 2l3 7 7 .8-5.2 4.8L18.5 22 12 18 5.5 22l1.7-7.4L2 9.8 9 9z"/></svg>;
    case 'close':   return <svg viewBox="0 0 24 24" {...s}><path d="M18 6L6 18M6 6l12 12"/></svg>;
    default:        return null;
  }
}
