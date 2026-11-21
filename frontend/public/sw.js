/* MaybeLater service worker: shows reminder notifications pushed by the server, even when no
 * MaybeLater tab is open (docs/NOTIFICATIONS.md). It caches nothing and never calls the API.
 *
 * - A focused MaybeLater tab gets a message instead (it shows its own toast and plays the chime).
 *   Otherwise a system notification appears, with the device's notification sound.
 * - `tag` is the reminder id: a repeated push replaces the notification instead of stacking.
 * - Clicking it focuses an open tab on the item, or opens one.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function readPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return { body: event.data ? event.data.text() : "" };
  }
}

self.addEventListener("push", (event) => {
  const data = readPayload(event);
  const title = data.title || "MaybeLater";
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/app/reminders";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: "maybelater:push", payload: data });
      const focused = windows.some((c) => c.focused && c.visibilityState === "visible");
      if (focused && data.type === "reminder") return; // the open app shows it and plays the chime
      await self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag || "maybelater",
        renotify: true,
        requireInteraction: data.type === "reminder",
        icon: "/notification-icon.png",
        badge: "/notification-icon.png",
        data: { url },
        timestamp: Date.now(),
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app/reminders";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) return existing.navigate(url).catch(() => existing.postMessage({ type: "maybelater:open", url }));
        return undefined;
      }
      return self.clients.openWindow(url);
    })(),
  );
});
