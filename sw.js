
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'شما یک اعلان جدید دارید.',
        icon: 'icon.png',
        badge: 'icon.png',
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
      console.error('Push handling error:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data.url;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
