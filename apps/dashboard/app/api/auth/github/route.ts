import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/callback/github`;

  if (!clientId) {
    // If no custom OAuth App ID is provided yet, default to quick sign-in with jojin1709 profile
    const profile = {
      login: 'jojin1709',
      name: 'Jojin John',
      avatar_url: 'https://avatars.githubusercontent.com/u/102925763?v=4',
      html_url: 'https://github.com/jojin1709',
      email: 'jojinn1709@gmail.com',
      provider: 'github',
    };
    const res = NextResponse.redirect(new URL('/', origin));
    res.cookies.set('stratum_session', JSON.stringify(profile), {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', clientId);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', 'read:user user:email');

  return NextResponse.redirect(githubAuthUrl.toString());
}
