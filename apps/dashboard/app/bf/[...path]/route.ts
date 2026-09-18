import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy to the BaseForge API.
 *
 * The dashboard needs secret-key operations (DDL, raw SQL, key management), but a
 * secret key in a browser bundle would make the public/secret split meaningless.
 * The browser therefore calls /bf/* with no credentials at all, and the key is
 * attached here, in the Node runtime, where it stays.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_URL = process.env.STRATUM_API_URL ?? process.env.BASEFORGE_API_URL ?? 'http://localhost:8788';
const SECRET = process.env.STRATUM_SECRET_KEY ?? process.env.BASEFORGE_SECRET_KEY;

function missingKey(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'UNAUTHORIZED',
        message: 'The dashboard has no API key. Set STRATUM_SECRET_KEY in the dashboard environment and restart it.',
      },
    },
    { status: 401 },
  );
}

async function forward(request: NextRequest, path: string[]): Promise<Response> {
  if (!SECRET) return missingKey();

  const target = new URL(`${API_URL.replace(/\/$/, '')}/${path.join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const headers = new Headers();
  headers.set('apikey', SECRET);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const hasBody = !['GET', 'HEAD'].includes(request.method);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      ...(hasBody ? { body: await request.arrayBuffer() } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });

    // Streamed straight through so large downloads are not buffered in the dashboard.
    const responseHeaders = new Headers();
    for (const key of ['content-type', 'content-length', 'content-disposition', 'content-range', 'x-response-time']) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: 'API_UNREACHABLE',
          message: `Cannot reach the Stratum API at ${API_URL}. Is it running?`,
          details: e instanceof Error ? e.message : String(e),
        },
      },
      { status: 502 },
    );
  }
}

type Ctx = { params: { path: string[] } };

export const GET = (r: NextRequest, { params }: Ctx) => forward(r, params.path);
export const POST = (r: NextRequest, { params }: Ctx) => forward(r, params.path);
export const PATCH = (r: NextRequest, { params }: Ctx) => forward(r, params.path);
export const PUT = (r: NextRequest, { params }: Ctx) => forward(r, params.path);
export const DELETE = (r: NextRequest, { params }: Ctx) => forward(r, params.path);
