import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const res = NextResponse.redirect(new URL('/', origin));
  res.cookies.delete('stratum_session');
  return res;
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('stratum_session');
  return res;
}
