export interface DecodedJwt {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/** Décode le payload d'un JWT côté client sans dépendance externe. */
export function decodeJwt(token: string): DecodedJwt | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as DecodedJwt;
  } catch {
    return null;
  }
}

/**
 * True si le jeton est un JWT dont la date d'expiration est dépassée.
 * Un jeton non décodable ou sans `exp` renvoie false : on laisse le serveur
 * trancher plutôt que de déconnecter à tort.
 */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return false;
  const decoded = decodeJwt(token);
  if (!decoded || typeof decoded.exp !== 'number') return false;
  return decoded.exp * 1000 <= Date.now();
}

/** Secondes restantes avant expiration (0 si déjà expiré / inconnu). */
export function secondsUntilExpiry(token: string | null | undefined): number {
  if (!token) return 0;
  const decoded = decodeJwt(token);
  if (!decoded || typeof decoded.exp !== 'number') return 0;
  return Math.max(0, Math.floor(decoded.exp * 1000 - Date.now()) / 1000);
}
