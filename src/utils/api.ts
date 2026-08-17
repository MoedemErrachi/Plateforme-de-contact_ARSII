export function getAuthToken(): string | null {
  try {
    const value = localStorage.getItem('euraxess_token');
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include'
  });

  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const error: any = new Error(json?.error || json?.message || json?.detail || `API error ${res.status}`);
    error.status = res.status;
    error.data = json;
    throw error;
  }
  return json;
}
