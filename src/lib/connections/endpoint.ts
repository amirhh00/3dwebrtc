import { PUBLIC_BASE_URL } from '$env/static/public';

/**
 * Returns API endpoint URL. In the browser, returns relative path so requests are
 * routed to the current host and cleanly proxied by Vite over HTTPS/HTTP without
 * mixed-content or cross-origin LAN IP issues.
 */
export function getApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    return path.startsWith('/') ? path : `/${path}`;
  }
  return `${PUBLIC_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Returns WebSocket endpoint URL matching current window host and protocol.
 */
export function getWsUrl(path: string): string {
  const normPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${normPath}`;
  }
  const base = PUBLIC_BASE_URL.replace(/^http/, 'ws');
  return `${base}${normPath}`;
}
