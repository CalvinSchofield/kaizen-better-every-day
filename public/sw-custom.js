// Custom Service Worker for Push Notifications
// This file is loaded by the VitePWA generated service worker

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || "Don't forget to save your work!",
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'inactivity-reminder',
    renotify: false,
    requireInteraction: true,
    data: { 
      url: data.url || '/track?prompt=save',
      type: data.type || 'inactivity'
    },
    actions: [
      { action: 'save', title: '💾 Save Now' },
      { action: 'dismiss', title: '🚀 Still Working' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kaizen', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    // User is still working, just close the notification
    return;
  }
  
  // For 'save' action or direct click, open the Track page
  const urlToOpen = event.notification.data?.url || '/track?prompt=save';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            // Navigate existing window to track page
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // No window open, open a new one
        return clients.openWindow(urlToOpen);
      })
  );
});
