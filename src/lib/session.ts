import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';
import type { Role } from './types';

export const COOKIE = 'podlink_session';
const MAX_AGE_S = 60 * 60 * 12;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be set (32+ chars)');
    // Development only: random per process, so no secret is ever stored in the repo.
    (globalThis as { __devSecret?: string }).__devSecret ??= crypto.randomUUID() + crypto.randomUUID();
    return new TextEncoder().encode((globalThis as { __devSecret?: string }).__devSecret);
  }
  return new TextEncoder().encode(s);
}

export interface SessionUser { id: number; role: Role; name: string; login: string; lang: string; branch: string | null }

export async function signSession(userId: number, role: Role): Promise<string> {
  return new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(String(userId))
    .setIssuedAt().setExpirationTime(`${MAX_AGE_S}s`).sign(secret());
}

export const sessionCookieOptions = {
  httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE_S,
};

/** Current user from the cookie, re-read from the DB so deleted users lose access immediately. */
export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const row = db().prepare('SELECT id, role, name, login, lang, branch FROM users WHERE id = ?').get(Number(payload.sub)) as SessionUser | undefined;
    return row ?? null;
  } catch { return null; }
}

export async function requireUser(role: Role): Promise<SessionUser | null> {
  const u = await getUser();
  return u && u.role === role ? u : null;
}
