import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function proxy(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const phoneComplete = token?.phoneComplete === true;

    if (pathname.startsWith('/dashboard') && token && !phoneComplete) {
      return NextResponse.redirect(new URL('/onboarding/phone', req.url));
    }

    if (pathname.startsWith('/onboarding') && token && phoneComplete) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    if (pathname.startsWith('/dashboard/admin') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (pathname.startsWith('/dashboard')) return !!token;
        if (pathname.startsWith('/onboarding')) return !!token;
        if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) return !!token;
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/api/cars/:path*',
    '/api/claims/:path*',
    '/api/upload/:path*',
    '/api/user/:path*',
  ],
};
