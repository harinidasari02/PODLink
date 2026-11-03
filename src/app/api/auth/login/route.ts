import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db, audit } from '@/lib/db';
import { LoginSchema } from '@/lib/validate';
import { rateLimit } from '@/lib/rate-limit';
import { COOKIE, sessionCookieOptions, signSession } from '@/lib/session';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!rateLimit(`login:${ip}`, 10, 60_000)) return NextResponse.json({ error: 'Too many attempts. Wait a minute.' }, { status: 429 });
  const parsed = LoginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check the details and try again.' }, { status: 400 });
  const { mode, login, secret } = parsed.data;
  const row = db().prepare('SELECT id, role, secret_hash, login FROM users WHERE lower(login) = lower(?) AND role = ?').get(login, mode) as
    { id: number; role: 'driver' | 'billing'; secret_hash: string; login: string } | undefined;
  // Always run a hash compare so timing does not reveal whether the account exists.
  const ok = await bcrypt.compare(secret, row?.secret_hash ?? '$2a$08$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
  if (!row || !ok) {
    audit(login, 'login_failed', null);
    return NextResponse.json({ error: mode === 'driver' ? 'Wrong code or PIN.' : 'Wrong email or password.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, redirect: row.role === 'driver' ? '/driver' : '/billing' });
  res.cookies.set(COOKIE, await signSession(row.id, row.role), sessionCookieOptions);
  audit(row.login, 'login', null);
  return res;
}
