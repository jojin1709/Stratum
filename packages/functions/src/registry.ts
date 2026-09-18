import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { err, type Logger } from '@stratum/shared';
import { checkWorkerCompat, type CompatIssue } from './runtime.js';

export interface DiscoveredFunction {
  name: string;
  entrypoint: string;
  compatIssues: CompatIssue[];
}

const VALID_NAME = /^[a-z0-9_-]+$/i;

export async function discoverFunctions(dir: string): Promise<DiscoveredFunction[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: DiscoveredFunction[] = [];
  for (const e of entries) {
    if (e.isDirectory() && VALID_NAME.test(e.name)) {
      for (const file of ['index.ts', 'index.js', 'index.mjs']) {
        const full = path.join(dir, e.name, file);
        try {
          await fs.access(full);
          const source = await fs.readFile(full, 'utf8');
          const compatIssues = checkWorkerCompat(source);
          out.push({ name: e.name, entrypoint: full, compatIssues });
          break;
        } catch {}
      }
    } else if (e.isFile()) {
      const match = /^([a-z0-9_-]+)\.(ts|js|mjs)$/i.exec(e.name);
      if (match) {
        const full = path.join(dir, e.name);
        const source = await fs.readFile(full, 'utf8');
        const compatIssues = checkWorkerCompat(source);
        out.push({ name: match[1] as string, entrypoint: full, compatIssues });
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function scaffoldFunction(dir: string, name: string): Promise<string> {
  if (!VALID_NAME.test(name)) throw err('VALIDATION_FAILED', `Invalid function name: ${name}`);
  const targetDir = path.join(dir, name);
  await fs.mkdir(targetDir, { recursive: true });
  const entry = path.join(targetDir, 'index.ts');
  await fs.writeFile(
    entry,
    `import type { FunctionContext } from '@stratum/functions';

export default async function handler(request: Request, context: FunctionContext): Promise<Response> {
  const { name = 'world' } = (await request.json().catch(() => ({}))) as { name?: string };
  return Response.json({
    message: \`Hello, \${name}!\`,
    function: '${name}',
    time: new Date().toISOString(),
  });
}
`,
    { flag: 'wx' },
  );
  return entry;
}
