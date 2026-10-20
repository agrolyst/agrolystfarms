
const CACHE_NAME = "agrolyst-shell-v1";
const APP_SHELL = ["/", "/index.html", "/favicon.jpeg", "/manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { title: "Agrolyst Farms", body: event.data ? event.data.text() : "You have an update." }; }
  const title = typeof payload.title === "string" ? payload.title : "Agrolyst Farms";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a new update from Agrolyst.",
    icon: "/favicon.jpeg",
    badge: "/favicon.jpeg",
    tag: typeof payload.tag === "string" ? payload.tag : "agrolyst-update",
    renotify: false,
    data: { url: typeof payload.url === "string" ? payload.url : "/account.html", ...(payload.data && typeof payload.data === "object" ? payload.data : {}) }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : "/account.html", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const existing = list.find(client => client.url.startsWith(self.location.origin) && "focus" in client);
      if (existing) {
        if ("navigate" in existing) existing.navigate(url);
        return existing.focus();
      }
      return clients.openWindow(url);
    })
  );
});
