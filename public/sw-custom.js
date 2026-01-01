// Custom Service Worker for Push Notifications
// This file is loaded by the VitePWA generated service worker

// Get notification actions based on type
function getNotificationActions(type) {
  switch (type) {
    case 'test_rich':
      return [
        { action: 'test_button', title: '🧪 Test This Button' },
        { action: 'dismiss', title: '✓ Dismiss' }
      ];
    case 'inactivity_save':
      return [
        { action: 'save', title: '💾 Save My Day' },
        { action: 'dismiss', title: '⏳ Still Working' }
      ];
    case 'inactivity_motivate':
      return [
        { action: 'go', title: '🚪 Back to Doors' },
        { action: 'dismiss', title: '👍 Got It' }
      ];
    case 'preseason_accountability':
      return [
        { action: 'log', title: '📊 Log Progress' },
        { action: 'dismiss', title: '⏰ Later' }
      ];
    case 'blitz_rsvp_first':
    case 'blitz_rsvp_second':
      return [
        { action: 'rsvp', title: "✅ I'm In!" },
        { action: 'view', title: '👀 View Details' }
      ];
    case 'ramp_progress':
      return [
        { action: 'view', title: '👀 View Rookie' },
        { action: 'dismiss', title: '👍 Got It' }
      ];
    case 'access_request':
      return [
        { action: 'view', title: '👋 Meet Them' },
        { action: 'dismiss', title: '👍 Got It' }
      ];
    default:
      return [
        { action: 'open', title: '👀 View' },
        { action: 'dismiss', title: '✓ Dismiss' }
      ];
  }
}

// Get notification tag based on type (for grouping/replacing)
function getNotificationTag(type, data) {
  switch (type) {
    case 'inactivity_save':
    case 'inactivity_motivate':
      return 'inactivity';
    case 'blitz_rsvp_first':
    case 'blitz_rsvp_second':
      return `blitz-rsvp-${data?.blitz_id || 'unknown'}`;
    default:
      return type;
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  const data = event.data?.json() || {};
  const type = data.type || 'default';
  
  const options = {
    body: data.body || "Don't forget to save your work!",
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: getNotificationTag(type, data),
    renotify: type.includes('rsvp'), // Re-notify for RSVP reminders
    requireInteraction: type === 'inactivity_save' || type.includes('rsvp'),
    data: { 
      url: data.url || '/track?prompt=save',
      type: type
    },
    actions: getNotificationActions(type)
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kaizen', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action, 'Type:', event.notification.data?.type);
  
  event.notification.close();
  
  const notificationType = event.notification.data?.type || 'default';
  const action = event.action;
  
  // Handle dismiss actions
  if (action === 'dismiss') {
    console.log('[SW] User dismissed notification');
    return;
  }
  
  // Determine URL based on action and notification type
  let urlToOpen = event.notification.data?.url || '/';
  
  // Override URL based on specific actions
  if (action === 'test_button') {
    console.log('[SW] 🧪 TEST BUTTON CLICKED! Notification action buttons are working!');
    urlToOpen = '/track?test=button_clicked';
  } else if (action === 'save') {
    urlToOpen = '/track?prompt=save';
  } else if (action === 'go') {
    urlToOpen = '/track';
  } else if (action === 'log') {
    urlToOpen = '/goals';
  } else if (action === 'rsvp' || action === 'view') {
    urlToOpen = '/'; // Home page shows RSVP modal
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            // Navigate existing window
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // No window open, open a new one
        return clients.openWindow(urlToOpen);
      })
  );
});
