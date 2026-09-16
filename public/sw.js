// BTB service worker: Web Push for LP range alerts. No caching, no offline
// shell; the app stays a normal website.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'BTB Finance', body: '', url: '/portfolio' };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-512.png',
    badge: '/icon.png',
    data: { url: data.url },
    tag: 'btb-range',
    renotify: true,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? '/portfolio', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.location.origin));
    if (open) { open.focus(); open.navigate?.(url); return; }
    return self.clients.openWindow(url);
  }));
});
