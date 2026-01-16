const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const host = hostname === 'localhost' ? '127.0.0.1' : hostname;
    return `${protocol}//${host}:8000`;
  }
  return '';
};

const DEFAULT_STUDIO_ID = '6c67acfe-acbf-4c1b-a281-eafa495efc79';
const STUDIO_ID = process.env.NEXT_PUBLIC_STUDIO_ID || DEFAULT_STUDIO_ID;

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (STUDIO_ID) headers.set('X-Studio-Id', STUDIO_ID);
  headers.set('Content-Type', 'application/json');
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('access');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const base = getApiBase();
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      const error: any = new Error(text || `HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export const fetchLinkButtons = () => apiFetch(`/api/studios/linkbutton/public?studio_id=${STUDIO_ID}`);
export const fetchSessions = () => apiFetch('/api/scheduling/sessions/');
export { getApiBase };
