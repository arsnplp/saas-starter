import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';

const protectedRoutes = ['/dashboard'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  console.log('🔒 [MIDDLEWARE]', {
    pathname,
    hasSession: !!sessionCookie,
    cookieValue: sessionCookie?.value?.substring(0, 30) + '...',
    isProtected: isProtectedRoute,
    method: request.method
  });

  if (isProtectedRoute) {
    if (!sessionCookie) {
      console.log('❌ [MIDDLEWARE] No session cookie on protected route, redirecting to sign-in');
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    try {
      const parsed = await verifyToken(sessionCookie.value);
      console.log('✅ [MIDDLEWARE] Session valid for user:', parsed.user.id);
    } catch (error) {
      console.error('❌ [MIDDLEWARE] Session verification failed:', error);
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
