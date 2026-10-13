/* LuzAlerts PWA service worker.
 *
 * Только Web Push: показать уведомление и открыть карту по тапу.
 * Офлайн-кэша намеренно нет: карта отключений полезна только свежей,
 * устаревшие данные из кэша вводили бы в заблуждение.
 */

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

// Payload с бэкенда (app/notifications.py::_send_web_push):
// {"title": "...", "body": "...", "data": {"lat": -25.26, "lon": -57.57}}
self.addEventListener('push', event => {
    let payload = {};
    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload = { body: event.data.text() };
        }
    }
    const data = payload.data || {};
    const title = payload.title || 'LuzAlerts';
    const options = {
        body: payload.body || '',
        icon: '/app/icons/icon-192.png',
        badge: '/app/icons/icon-192.png',
        data,
    };
    if (data.lat != null && data.lon != null) {
        // Повтор про ту же точку заменяет прошлое уведомление, а не копится.
        options.tag = `outage-${data.lat}-${data.lon}`;
    }
    // iOS требует показывать уведомление на каждый push (userVisibleOnly),
    // иначе после нескольких "тихих" пушей Safari отзывает подписку.
    event.waitUntil(self.registration.showNotification(title, options));
});

// Тап по уведомлению ведет на карту с фокусом на точке — как
// addNotificationResponseReceivedListener в app/_layout.tsx на Android.
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const data = event.notification.data || {};
    // PWA живет под /app/ на том же домене, что и лендинг.
    const base = self.registration.scope; // https://luzalerts.lat/app/
    const url = data.lat != null && data.lon != null
        ? `${base}?focusLat=${encodeURIComponent(data.lat)}&focusLon=${encodeURIComponent(data.lon)}`
        : base;

    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) {
            // Вкладки лендинга того же домена тоже попадают в matchAll —
            // сообщение должно уйти только в окно самого приложения.
            if (!('focus' in client) || !client.url.startsWith(base)) continue;
            await client.focus();
            // Приложение уже открыто: навигацию делает сам expo-router
            // (слушатель в _layout.tsx), без перезагрузки страницы.
            client.postMessage({ type: 'luzalerts:push-open', url });
            return;
        }
        await self.clients.openWindow(url);
    })());
});
