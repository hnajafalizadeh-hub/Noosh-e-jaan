
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'شما یک اعلان جدید دارید.',
        icon: '/icon.png',
        badge: '/icon.png',
        dir: 'rtl',
        vibrate: [100, 50, 100],
        tag: data.tag || 'activity',
        renotify: true,
        data: {
          url: data.url || '/'
        }
      };

      event.waitUntil(
        self.registration.showNotification(data.title || 'چی بُقولم؟', options)
      );
    } catch (e) {
      console.warn('Push payload not JSON, using text:', event.data.text());
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // اگر تب برنامه باز بود، روی همان فوکوس کن
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // در غیر این صورت تب جدید باز کن
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
