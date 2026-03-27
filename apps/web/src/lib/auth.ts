import { JwtPayload } from '@freelancer/shared';

// ─── Base64 URL decode ────────────────────────────────────────────────────────

function base64UrlDecode(str: string): string {
  // Replace URL-safe chars and pad to multiple of 4
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  try {
    // Browser / Node 16+ atob
    return decodeURIComponent(
      Array.from(atob(padded))
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
  } catch {
    // Node.js fallback using Buffer
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8');
    }
    throw new Error('Unable to decode base64 string');
  }
}

// ─── Token decoding ───────────────────────────────────────────────────────────

/**
 * Decodes a JWT without verifying the signature.
 * Verification happens server-side; this is for client-side metadata only.
 */
export function decodeToken(token: string): JwtPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Decodes the JWT header (algorithm, type).
 */
export function decodeTokenHeader(
  token: string,
): { alg: string; typ: string } | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    return JSON.parse(base64UrlDecode(parts[0])) as {
      alg: string;
      typ: string;
    };
  } catch {
    return null;
  }
}

// ─── Token expiry ─────────────────────────────────────────────────────────────

/**
 * Returns true if the token is expired or cannot be decoded.
 * Adds an optional buffer (in seconds) to account for clock skew.
 */
export function isTokenExpired(
  token: string,
  bufferSeconds: number = 30,
): boolean {
  const payload = decodeToken(token);
  if (!payload) return true;
  if (typeof payload.exp !== 'number') return false; // No expiry claim → never expires

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSeconds + bufferSeconds;
}

/**
 * Returns the number of seconds until the token expires.
 * Returns 0 if already expired, or Infinity if no exp claim.
 */
export function getTokenTTL(token: string): number {
  const payload = decodeToken(token);
  if (!payload) return 0;
  if (typeof payload.exp !== 'number') return Infinity;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - nowSeconds);
}

/**
 * Returns the expiry Date of the token, or null if undecipherable.
 */
export function getTokenExpiryDate(token: string): Date | null {
  const payload = decodeToken(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return new Date(payload.exp * 1000);
}

// ─── Store accessor ───────────────────────────────────────────────────────────

/**
 * Retrieves the current access token from the Zustand auth store.
 * Safe to call in both client and server contexts (returns null on server).
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('@/store/auth.store') as {
      useAuthStore: {
        getState: () => { accessToken: string | null };
      };
    };
    return useAuthStore.getState().accessToken;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current refresh token from the Zustand auth store.
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('@/store/auth.store') as {
      useAuthStore: {
        getState: () => { refreshToken: string | null };
      };
    };
    return useAuthStore.getState().refreshToken;
  } catch {
    return null;
  }
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

/**
 * Returns the user ID (sub claim) from the given token, or null.
 */
export function getUserIdFromToken(token: string): string | null {
  return decodeToken(token)?.sub ?? null;
}

/**
 * Returns the user role from the given token, or null.
 */
export function getRoleFromToken(
  token: string,
): JwtPayload['role'] | null {
  return decodeToken(token)?.role ?? null;
}

/**
 * Returns the email from the given token, or null.
 */
export function getEmailFromToken(token: string): string | null {
  return decodeToken(token)?.email ?? null;
}

/**
 * Returns true when the current stored access token is valid (present and not expired).
 */
export function hasValidAccessToken(): boolean {
  const token = getAccessToken();
  if (!token) return false;
  return !isTokenExpired(token);
}

/**
 * Checks whether the current stored access token is nearing expiry.
 * Useful for proactive refresh (e.g., within 5 minutes).
 */
export function isAccessTokenNearExpiry(thresholdSeconds: number = 300): boolean {
  const token = getAccessToken();
  if (!token) return true;
  const ttl = getTokenTTL(token);
  return ttl <= thresholdSeconds;
}

/**
 * Formats the token expiry as a human-readable string for debugging.
 */
export function describeToken(token: string): string {
  const payload = decodeToken(token);
  if (!payload) return '[invalid token]';

  const expiry = getTokenExpiryDate(token);
  const ttl = getTokenTTL(token);
  const expired = isTokenExpired(token);

  return [
    `sub=${payload.sub}`,
    `role=${payload.role}`,
    `email=${payload.email}`,
    expiry ? `exp=${expiry.toISOString()}` : 'exp=none',
    expired ? 'EXPIRED' : `ttl=${ttl}s`,
  ].join(' | ');
}
