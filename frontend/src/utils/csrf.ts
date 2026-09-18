const CSRF_COOKIE_NAME = 'XSRF-TOKEN';

export function getCsrfToken(): string | null {
  try {
    const re = new RegExp(String.raw`(?:^|;\s*)${CSRF_COOKIE_NAME}=([^;]*)`);
    const match = re.exec(document.cookie);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Headers CSRF à joindre aux requêtes mutantes (double-submit cookie).
 * Le cookie XSRF-TOKEN est émis par le backend (GET /api/auth/csrf-token ou
 * toute réponse /api) ; on se contente de le renvoyer en en-tête.
 */
export function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { 'X-CSRF-Token': token } : {};
}
