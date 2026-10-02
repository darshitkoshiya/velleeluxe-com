/**
 * Subdomain-based admin routing + HTTP Basic Auth.
 *
 * - vladmin.velleeluxe.com          -> serves the admin panel (rewrites "/" -> "/admin", "/x" -> "/admin/x")
 * - velleeluxe.com/admin/*        -> redirects to vladmin.velleeluxe.com/admin/*
 * - localhost:3000/admin          -> still works for local development
 * - /api/admin/*                  -> always requires Basic Auth
 *
 * Credentials come from ADMIN_USERNAME / ADMIN_PASSWORD.
 * If ADMIN_PASSWORD is not set, the admin area is locked for everyone.
 */
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_HOST = 'vladmin.velleeluxe.com';

function unauthorized(): NextResponse {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Vellee Luxe Admin", charset="UTF-8"',
    },
  });
}

/** Compares two strings without leaking how many characters matched. */
function safeEqual(a: string, b: string): boolean {
  let mismatch = a.length === b.length ? 0 : 1;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

function decodeBase64(value: string): string | null {
  try {
    // atob is available in the Edge runtime (Buffer is not guaranteed there).
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function checkBasicAuth(request: NextRequest): boolean {
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) return false;

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;

  const decoded = decodeBase64(authHeader.slice(6));
  if (!decoded) return false;

  // Split on the FIRST colon only, so passwords may contain ":".
  const separator = decoded.indexOf(':');
  if (separator === -1) return false;
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const userOk = safeEqual(username, adminUser);
  const passOk = safeEqual(password, adminPass);
  return userOk && passOk;
}

/** True for localhost / 127.0.0.1 hosts (with or without a port). */
function isLocalHost(host: string): boolean {
  const hostname = host.split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = (request.headers.get('host') ?? '').toLowerCase();

  const isAdminSubdomain = host.startsWith('vladmin.');
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const isAdminPath = isAdminPage || isAdminApi;
  const isLocalDev = process.env.NODE_ENV === 'development' || isLocalHost(host);

  // Main domain trying to reach /admin or /api/admin -> 404, not a redirect.
  // A redirect would reveal the admin subdomain to anyone probing the main domain.
  if (!isAdminSubdomain && !isLocalDev && isAdminPath) {
    return new NextResponse(null, { status: 404 });
  }

  // Admin subdomain, or /admin paths during local development -> require auth.
  if (isAdminSubdomain || (isLocalDev && isAdminPath)) {
    if (!process.env.ADMIN_PASSWORD) {
      return new NextResponse('Admin not configured', { status: 503 });
    }
    if (!checkBasicAuth(request)) {
      return unauthorized();
    }

    // On the admin subdomain, map clean URLs onto the /admin route tree.
    // Leave API routes and static files (anything with a file extension) untouched.
    const isApi = pathname === '/api' || pathname.startsWith('/api/');
    const isFile = /\.[^/]+$/.test(pathname);
    if (isAdminSubdomain && !isAdminPage && !isApi && !isFile) {
      const url = request.nextUrl.clone();
      url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Runs on every route except Next.js build assets, so the admin subdomain's
  // root ("/") and clean URLs can be caught and rewritten.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
