/**
 * The function contract is deliberately the Web platform one — `(Request, Context) => Response`.
 * That is the subset both Node 20+ and the Cloudflare Workers runtime implement, which is
 * why the same source can run in either without a compatibility shim.
 */
export interface FunctionContext {
  /** Values from the project environment that were explicitly exposed to functions. */
  env: Record<string, string | undefined>;
  /** Correlates logs for a single invocation. */
  requestId: string;
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
  /** Present under Node; absent in a Worker unless the platform provides it. */
  waitUntil?(promise: Promise<unknown>): void;
}

export type FunctionHandler = (request: Request, context: FunctionContext) => Response | Promise<Response>;

export interface FunctionModule {
  default: FunctionHandler;
}

/**
 * APIs that exist in Node but not in the Workers runtime. A function using these
 * will work locally and fail on deploy, so `stratum functions deploy` refuses
 * rather than letting the mismatch reach production.
 */
export const NODE_ONLY_APIS = [
  'node:fs', 'node:child_process', 'node:net', 'node:dgram', 'node:worker_threads',
  'node:cluster', 'node:http', 'node:https', 'node:tls', 'node:v8', 'node:vm',
  'fs', 'child_process', 'net', 'dgram', 'cluster', 'worker_threads',
];

export interface CompatIssue {
  api: string;
  line: number;
  message: string;
}

/**
 * Static check for Worker incompatibility. It reads imports and obvious globals —
 * it cannot catch every dynamic case, and the deploy output says so.
 */
export function checkWorkerCompatibility(source: string): CompatIssue[] {
  const issues: CompatIssue[] = [];
  const lines = source.split('\n');

  lines.forEach((line, i) => {
    const importMatch = /(?:from\s+|require\(\s*|import\(\s*)['"]([^'"]+)['"]/.exec(line);
    if (importMatch) {
      const mod = importMatch[1] as string;
      const bare = mod.replace(/^node:/, '').split('/')[0] as string;
      if (NODE_ONLY_APIS.includes(mod) || NODE_ONLY_APIS.includes(bare)) {
        issues.push({
          api: mod,
          line: i + 1,
          message: `"${mod}" is not available in the Cloudflare Workers runtime.`,
        });
      }
    }
    if (/\bprocess\.(binding|cwd|exit)\b/.test(line)) {
      issues.push({ api: 'process', line: i + 1, message: 'Workers expose only a limited `process` shim.' });
    }
    if (/\b__dirname\b|\b__filename\b/.test(line)) {
      issues.push({ api: '__dirname', line: i + 1, message: 'Module-path globals do not exist in Workers.' });
    }
  });

  return issues;
}

export const checkWorkerCompat = checkWorkerCompatibility;

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { err, type Logger } from '@stratum/shared';

export class LocalFunctionRuntime {
  private readonly dir: string;
  private readonly env: Record<string, string | undefined>;
  private readonly logger?: Logger;
  private readonly cache = new Map<string, FunctionHandler>();

  constructor(dir: string, env: Record<string, string | undefined> = {}, logger?: Logger) {
    this.dir = path.resolve(dir);
    this.env = env;
    this.logger = logger;
  }

  private async findEntrypoint(name: string): Promise<string> {
    const candidates = [
      path.join(this.dir, name, 'index.ts'),
      path.join(this.dir, name, 'index.js'),
      path.join(this.dir, name, 'index.mjs'),
      path.join(this.dir, `${name}.ts`),
      path.join(this.dir, `${name}.js`),
      path.join(this.dir, `${name}.mjs`),
    ];

    for (const cand of candidates) {
      try {
        await fs.access(cand);
        return cand;
      } catch {}
    }

    throw err('FUNCTION_NOT_FOUND', `Function "${name}" not found in "${this.dir}".`);
  }

  invalidate(name?: string): void {
    if (name) this.cache.delete(name);
    else this.cache.clear();
  }

  async invoke(
    name: string,
    request: Request,
  ): Promise<{ response: Response; logs: Array<{ level: 'debug' | 'info' | 'warn' | 'error'; message: string }> }> {
    const entry = await this.findEntrypoint(name);
    const logs: Array<{ level: 'debug' | 'info' | 'warn' | 'error'; message: string }> = [];

    const url = `${pathToFileURL(entry).href}?t=${Date.now()}`;
    let mod: any;
    try {
      mod = await import(url);
    } catch (e: any) {
      throw err('INTERNAL_ERROR', `Failed to load function "${name}": ${e.message}`);
    }

    const handler: FunctionHandler = mod.default ?? mod.handler;
    if (typeof handler !== 'function') {
      throw err('INTERNAL_ERROR', `Function "${name}" does not export a default handler function.`);
    }

    const context: FunctionContext = {
      env: this.env,
      requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      log: (level, message) => {
        logs.push({ level, message });
        this.logger?.[level]?.(`[function:${name}] ${message}`);
      },
    };

    try {
      const response = await handler(request, context);
      return { response, logs };
    } catch (e: any) {
      context.log('error', e.stack || e.message || String(e));
      throw e;
    }
  }
}
