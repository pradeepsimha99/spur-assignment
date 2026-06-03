/**
 * Keep-Alive Service
 *
 * Pings the backend health endpoint every 10 minutes to prevent
 * Render's free tier from spinning down the service after inactivity.
 * Also keeps the frontend page alive by running in the background.
 */

const KEEPALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Start the keep-alive pinging mechanism.
 * Pings the backend /health endpoint every 10 minutes.
 */
export function startKeepAlive(): void {
  if (isRunning) return;
  isRunning = true;

  console.log('[KeepAlive] Started — pinging backend every 10 minutes');

  // Ping immediately on start, then every 10 minutes
  pingBackend();
  intervalId = setInterval(pingBackend, KEEPALIVE_INTERVAL);

  // Also refresh the page's own activity timestamp to prevent browser throttling
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Stop the keep-alive pinging mechanism.
 */
export function stopKeepAlive(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isRunning = false;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  console.log('[KeepAlive] Stopped');
}

let isPinging = false;

/**
 * Ping the backend health endpoint.
 */
async function pingBackend(): Promise<void> {
  if (isPinging) return;
  isPinging = true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_BASE}/health`, {
      signal: controller.signal,
      // Add cache-busting to prevent cached responses
      headers: { 'Cache-Control': 'no-cache' }
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      console.debug(`[KeepAlive] Backend ping OK — status: ${data.status}`);
    }
  } catch {
    // Silently fail — keep-alive is best-effort
    // The backend may still be waking up from sleep
  } finally {
    isPinging = false;
  }
}

/**
 * When the browser tab becomes visible again, ping the backend immediately
 * to wake it up from potential sleep.
 */
function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    console.debug('[KeepAlive] Tab visible again — sending wake-up ping');
    pingBackend();
  }
}
