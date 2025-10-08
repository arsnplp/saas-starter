import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';

const protectedRoutes = ['/dashboard'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    try {
      await verifyToken(sessionCookie.value);
    } catch (error) {
      const res = NextResponse.redirect(new URL('/sign-in', request.url));
      res.cookies.set({
        name: 'session',
        value: '',
        maxAge: 0,
      });
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs'
};
