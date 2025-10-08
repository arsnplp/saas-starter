import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';

const protectedRoutes = ['/dashboard', '/leads'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  console.log('🔒 [MIDDLEWARE]', {
    pathname,
    hasSession: !!sessionCookie,
    isProtected: isProtectedRoute,
    method: request.method
  });

  if (isProtectedRoute && !sessionCookie) {
    console.log('❌ [MIDDLEWARE] No session cookie on protected route, redirecting to sign-in');
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  let res = NextResponse.next();

  if (sessionCookie && request.method === 'GET') {
    try {
      const parsed = await verifyToken(sessionCookie.value);
      console.log('✅ [MIDDLEWARE] Session valid for user:', parsed.user.id);
      
      const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);

      res.cookies.set({
        name: 'session',
        value: await signToken({
          ...parsed,
          expires: expiresInOneDay.toISOString()
        }),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresInOneDay
      });
      
      console.log('🔄 [MIDDLEWARE] Session refreshed');
    } catch (error) {
      console.error('❌ [MIDDLEWARE] Session verification failed:', error);
      res.cookies.delete('session');
      if (isProtectedRoute) {
        console.log('❌ [MIDDLEWARE] Redirecting to sign-in due to invalid session');
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs'
};
