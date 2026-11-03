import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Edge guard for the two app areas. API routes and server pages re-check access themselves.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const area = pathname.startsWith('/driver') ? 'driver' : pathname.startsWith('/billing') ? 'billing' : null;
  if (!area) return NextResponse.next();
  const login = new URL('/login', req.url);
  const token = req.cookies.get('podlink_session')?.value;
  const s = process.env.SESSION_SECRET;
  if (!token || (!s && process.env.NODE_ENV === 'production')) return NextResponse.redirect(login);
  // In dev without SESSION_SECRET the per-process key lives in the Node runtime, so only check presence here;
  // the pages verify the signature and role.
  if (!s) return NextResponse.next();
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(s));
    if (payload.role !== area) return NextResponse.redirect(new URL(payload.role === 'driver' ? '/driver' : '/billing', req.url));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(login);
  }
}

export const config = { matcher: ['/driver/:path*', '/billing/:path*'] };
