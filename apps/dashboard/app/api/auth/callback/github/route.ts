import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get('code');
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/?auth_error=missing_credentials', origin));
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL(`/?auth_error=${tokenData.error || 'token_failed'}`, origin));
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'Stratum-Console',
      },
    });

    const userData = (await userRes.json()) as {
      login: string;
      name: string | null;
      avatar_url: string;
      html_url: string;
      email: string | null;
    };

    const profile = {
      login: userData.login,
      name: userData.name || userData.login,
      avatar_url: userData.avatar_url,
      html_url: userData.html_url,
      email: userData.email,
      provider: 'github',
    };

    const res = NextResponse.redirect(new URL('/console', origin));
    res.cookies.set('stratum_session', JSON.stringify(profile), {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  } catch (e: unknown) {
    return NextResponse.redirect(new URL(`/?auth_error=server_error`, origin));
  }
}
