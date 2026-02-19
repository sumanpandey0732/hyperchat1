// Notification helper — manages browser push permission + SW registration

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[SW] Registered');
    return swRegistration;
  } catch (err) {
    console.warn('[SW] Registration failed', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showLocalNotification(title: string, body: string, tag?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  // Use SW notification if available (works when tab hidden)
  if (swRegistration) {
    swRegistration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      tag: tag || 'hyperchat',
    });
  } else {
    new Notification(title, { body, icon: '/favicon.ico', tag: tag || 'hyperchat' });
  }
}
