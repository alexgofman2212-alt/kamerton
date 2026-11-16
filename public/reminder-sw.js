/* Напоминания: подключается к service worker через importScripts. */
function readReminder() {
  return new Promise((resolve) => {
    const req = indexedDB.open('kamerton', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const get = req.result.transaction('kv').objectStore('kv').get('reminder');
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => resolve(null);
    };
  });
}

function localDay(d) {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'daily-reminder') return;
  event.waitUntil(
    readReminder().then((r) => {
      if (!r || !r.enabled) return;
      const now = new Date();
      const [h, m] = String(r.time || '19:00').split(':').map(Number);
      const due = now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
      if (!due || r.lastPractice === localDay(now)) return;
      return self.registration.showNotification('Камертон', {
        body: 'Сегодня занятия ещё не было. Десять фрагментов — и серия продолжится.',
        icon: new URL('icon-192.png', self.registration.scope).href,
        badge: new URL('icon-192.png', self.registration.scope).href,
        tag: 'daily-reminder',
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(self.registration.scope);
    }),
  );
});
