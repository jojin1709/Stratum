import { promises as fs } from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { err } from '@stratum/shared';
import { checkWorkerCompat } from './runtime.js';

/**
 * Bundles a function for the Cloudflare Workers runtime and emits a wrangler config.
 * Deployment itself is handed to the user's own `wrangler` CLI — Stratum does not
 * embed Cloudflare credentials or call their API on the user's behalf.
 */
export interface BuildWorkerOptions {
  functionsDir: string;
  name: string;
  outRoot?: string;
  compatibilityDate?: string;
}

export interface WorkerBuildResult {
  outDir: string;
  bundleFile: string;
  wranglerFile: string;
  sizeBytes: number;
}

export async function buildWorker(opts: BuildWorkerOptions): Promise<WorkerBuildResult> {
  const funcDir = path.join(opts.functionsDir, opts.name);
  let entrypoint: string | null = null;
  for (const candidate of ['index.ts', 'index.js', 'index.mjs']) {
    const p = path.join(funcDir, candidate);
    try {
      await fs.access(p);
      entrypoint = p;
      break;
    } catch {}
  }
  if (!entrypoint) {
    for (const candidate of [`${opts.name}.ts`, `${opts.name}.js`]) {
      const p = path.join(opts.functionsDir, candidate);
      try {
        await fs.access(p);
        entrypoint = p;
        break;
      } catch {}
    }
  }
  if (!entrypoint) {
    throw err('FUNCTION_NOT_FOUND', `Function "${opts.name}" not found in ${opts.functionsDir}.`);
  }

  const source = await fs.readFile(entrypoint, 'utf8');
  const issues = checkWorkerCompat(source);
  if (issues.length > 0) {
    throw err(
      'VALIDATION_FAILED',
      `Function "${opts.name}" is not compatible with Cloudflare Workers: ${issues.map((i) => i.message).join('; ')}`,
      { issues },
    );
  }

  const outDir = path.resolve(opts.outRoot ?? path.join('.stratum', 'workers'), opts.name);
  await fs.mkdir(outDir, { recursive: true });

  const bundleFile = path.join(outDir, 'index.js');
  const wrapper = `
import userHandler from ${JSON.stringify(entrypoint)};
export default {
  async fetch(request, env, ctx) {
    const context = {
      functionName: ${JSON.stringify(opts.name)},
      env,
      log: console,
      waitUntil: (p) => ctx.waitUntil(p),
    };
    const handler = typeof userHandler === 'function' ? userHandler : userHandler.default;
    return handler(request, context);
  }
};
`;

  await esbuild.build({
    stdin: {
      contents: wrapper,
      resolveDir: path.dirname(entrypoint),
      sourcefile: 'wrapper.js',
      loader: 'js',
    },
    bundle: true,
    format: 'esm',
    target: 'es2022',
    outfile: bundleFile,
    platform: 'browser',
    conditions: ['workerd', 'worker', 'browser'],
    mainFields: ['module', 'main'],
    minify: false,
    sourcemap: true,
  });

  const stat = await fs.stat(bundleFile);
  const wranglerFile = path.join(outDir, 'wrangler.toml');
  await fs.writeFile(
    wranglerFile,
    `name = "stratum-${opts.name}"
main = "index.js"
compatibility_date = "${opts.compatibilityDate ?? '2024-10-01'}"
compatibility_flags = ["nodejs_compat"]
`,
  );

  return { outDir, bundleFile, wranglerFile, sizeBytes: stat.size };
}
