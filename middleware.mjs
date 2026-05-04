import { rewrite, next } from '@vercel/functions';

export const config = {
  matcher: '/',
};

export default function middleware(request) {
  const host = request.headers.get('host') || '';
  if (host === 'admin.miguelcottopromotions.com') {
    return rewrite(new URL('/admin/', request.url));
  }
  return next();
}
