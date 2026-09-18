import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('stratum_session');
  if (!cookie?.value) {
    return NextResponse.json({ user: null });
  }

  try {
    const user = JSON.parse(cookie.value);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
