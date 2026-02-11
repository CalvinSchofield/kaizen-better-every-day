// Custom Service Worker for Push Notifications
// Rich, context-aware actions for each notification type

function getNotificationActions(type) {
  switch (type) {
    case 'reaction':
      return [
        { action: 'reply', title: '💬 Reply' },
        { action: 'view', title: '👀 View' }
      ];
    case 'mention':
      return [
        { action: 'reply', title: '💬 Reply' },
        { action: 'view', title: '👀 View' }
      ];
    case 'comment':
      return [
        { action: 'reply', title: '💬 Reply' },
        { action: 'view', title: '👀 View' }
      ];
    case 'task_assignment':
      return [
        { action: 'add_to_calendar', title: '📅 Add to Calendar' },
        { action: 'view', title: '👀 View Task' }
      ];
    case 'task_morning_digest':
    case 'task_evening_nudge':
    case 'task_past_due':
      return [
        { action: 'view', title: '📋 View Tasks' },
        { action: 'dismiss', title: '✓ Dismiss' }
      ];
    case 'task_single_reminder':
      return [
        { action: 'call', title: '📞 Call' },
        { action: 'text', title: '💬 Text' }
      ];
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

function getNotificationTag(type, data) {
  switch (type) {
    case 'inactivity_save':
    case 'inactivity_motivate':
      return 'inactivity';
    case 'blitz_rsvp_first':
    case 'blitz_rsvp_second':
      return `blitz-rsvp-${data?.blitz_id || 'unknown'}`;
    case 'task_morning_digest':
      return 'task-morning';
    case 'task_evening_nudge':
      return 'task-evening';
    case 'task_past_due':
      return 'task-past-due';
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
    renotify: type.includes('rsvp'),
    requireInteraction: type === 'inactivity_save' || type.includes('rsvp') || type === 'task_assignment',
    data: { 
      url: data.url || '/track?prompt=save',
      type: type,
      activityId: data.activityId || null,
      recruitId: data.recruitId || null,
      recruitPhone: data.recruitPhone || null,
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
  const notifData = event.notification.data || {};
  
  // Handle dismiss actions
  if (action === 'dismiss') {
    console.log('[SW] User dismissed notification');
    return;
  }
  
  // Determine URL based on action and notification type
  let urlToOpen = notifData.url || '/';
  
  // === Action-specific URL overrides ===
  
  if (action === 'reply') {
    // Ensure openComments=true is in the URL
    if (urlToOpen.includes('?')) {
      if (!urlToOpen.includes('openComments=true')) {
        urlToOpen += '&openComments=true';
      }
    } else {
      urlToOpen += '?openComments=true';
    }
  } else if (action === 'add_to_calendar' && notifData.activityId) {
    // Navigate with addToCalendar param
    if (urlToOpen.includes('?')) {
      urlToOpen += `&addToCalendar=${notifData.activityId}`;
    } else {
      urlToOpen += `?addToCalendar=${notifData.activityId}`;
    }
  } else if (action === 'call' && notifData.recruitPhone) {
    // Open phone dialer directly
    event.waitUntil(clients.openWindow(`tel:${notifData.recruitPhone}`));
    return;
  } else if (action === 'text' && notifData.recruitPhone) {
    // Open SMS app directly
    event.waitUntil(clients.openWindow(`sms:${notifData.recruitPhone}`));
    return;
  } else if (action === 'complete' && notifData.activityId && notifData.recruitId) {
    urlToOpen = `/my-group?recruitId=${notifData.recruitId}&completeActivity=${notifData.activityId}`;
  } else if (action === 'test_button') {
    console.log('[SW] 🧪 TEST BUTTON CLICKED! Notification action buttons are working!');
    urlToOpen = '/track?test=button_clicked';
  } else if (action === 'save') {
    urlToOpen = '/track?prompt=save';
  } else if (action === 'go') {
    urlToOpen = '/track';
  } else if (action === 'log') {
    urlToOpen = '/goals';
  } else if (action === 'rsvp' || (action === 'view' && (notificationType === 'blitz_rsvp_first' || notificationType === 'blitz_rsvp_second'))) {
    urlToOpen = '/';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});
