// Role-based access for pages and API routes (runs before every matching request).
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ACCESS = {
  '/admin': ['admin'],
  '/staff': ['admin', 'staff'],
  '/customer': ['customer'],
  '/invoices': ['admin', 'staff', 'customer'],
  '/api/vendors': ['admin'],
  '/api/purchases': ['admin'],
  '/api/users': ['admin'],
  '/api/notifications': ['admin'],
  '/api/products': ['admin', 'staff'],
  '/api/customers': ['admin', 'staff'],
  '/api/orders': ['admin', 'staff', 'customer'],
  '/api/invoices': ['admin', 'staff', 'customer'],
  '/api/payments': ['admin', 'staff'],
  '/api/stock': ['admin', 'staff'],
  '/api/reports': ['admin'],
};

export async function middleware(req) {
  const path = req.nextUrl.pathname;
  const rule = Object.keys(ACCESS).find((p) => path === p || path.startsWith(p + '/'));
  if (!rule) return NextResponse.next();

  const isApi = path.startsWith('/api/');
  const token = req.cookies.get('session')?.value;
  try {
    const { payload } = await jwtVerify(token || '', new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret'));
    if (!payload.otpVerified) throw new Error('otp');
    if (!ACCESS[rule].includes(payload.role)) {
      return isApi ? NextResponse.json({ error: 'Forbidden' }, { status: 403 }) : NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  } catch {
    return isApi ? NextResponse.json({ error: 'Please sign in' }, { status: 401 }) : NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = { matcher: ['/admin/:path*', '/staff/:path*', '/customer/:path*', '/invoices/:path*', '/api/:path*'] };
