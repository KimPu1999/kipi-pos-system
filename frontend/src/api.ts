export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ApiError(
      response.ok
        ? 'The Laravel API returned an invalid response.'
        : 'The Laravel API returned a server error. Check the Laravel terminal and log.',
      response.status,
    );
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body instanceof FormData) headers.delete('Content-Type');
  else headers.set('Content-Type', 'application/json');
  if (options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
    const csrf = await fetch('/api/auth/csrf', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!csrf.ok)
      throw new ApiError('Unable to connect. Check that the API is running.', csrf.status);
    const csrfData = await readJson(csrf);
    const token = String(csrfData.token || '');
    if (!token) throw new ApiError('Unable to get the Laravel CSRF token.', csrf.status);
    headers.set('X-CSRF-TOKEN', token);
  }
  const response = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', headers });
  const data = await readJson(response);
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('auth-expired'));
    throw new ApiError(
      String(data.message || 'Request failed'),
      response.status,
      (data.errors as Record<string, string[]>) || {},
    );
  }
  return data as T;
}
export type User = { id: number; name: string; email: string; role: 'admin' | 'customer' };
