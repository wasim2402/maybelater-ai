/**
 * This browser's Web Push subscription. Consent is explicit: `enablePush()` runs only from the
 * "Turn on notifications" button, and asks the browser's own permission first.
 */

export type PushSupport = "supported" | "unsupported" | "needs-install";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (hasApis) return "supported";
  // iPhone and iPad offer push only to sites added to the home screen.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return ios ? "needs-install" : "unsupported";
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

/** Registers the service worker (it only shows pushed notifications; it caches nothing). */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (pushSupport() !== "supported") return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await registerServiceWorker();
  return registration ? registration.pushManager.getSubscription() : null;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** A short label for the device list, e.g. "Chrome on Windows". */
export function deviceLabel(ua = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export class PushPermissionError extends Error {}

/** Asks permission and subscribes. Returns the subscription to save on the server. */
export async function enablePush(publicKey: string): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new PushPermissionError(
      permission === "denied" ? "Notifications are blocked for this site. Allow them in your browser's site settings, then try again." : "Notifications weren't allowed.",
    );
  }
  const registration = await registerServiceWorker();
  if (!registration) throw new Error("This browser can't show notifications.");
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  return subscription.toJSON();
}

/** Unsubscribes this browser. Returns the endpoint that was removed, if any. */
export async function disablePush(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => undefined);
  return endpoint;
}
