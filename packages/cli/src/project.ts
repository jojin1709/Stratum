import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface ProjectConfig {
  name: string;
  apiUrl: string;
  dashboardUrl: string;
  migrationsDir: string;
  functionsDir: string;
}

export const CONFIG_FILE = 'stratum.json';
export const LEGACY_CONFIG_FILE = 'baseforge.json';

/** Walks up from cwd looking for stratum.json or baseforge.json, the way git finds its root. */
export async function findProjectRoot(from = process.cwd()): Promise<{ root: string; configFile: string } | null> {
  let dir = path.resolve(from);
  for (;;) {
    for (const cfg of [CONFIG_FILE, LEGACY_CONFIG_FILE]) {
      try {
        await fs.access(path.join(dir, cfg));
        return { root: dir, configFile: cfg };
      } catch {}
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function loadProject(): Promise<{ root: string; config: ProjectConfig } | null> {
  const found = await findProjectRoot();
  if (!found) return null;
  const raw = await fs.readFile(path.join(found.root, found.configFile), 'utf8');
  return { root: found.root, config: JSON.parse(raw) as ProjectConfig };
}

export async function writeProject(root: string, config: ProjectConfig): Promise<void> {
  await fs.writeFile(path.join(root, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
}

/** Reads DATABASE_URL from the environment or the project .env, without pulling in dotenv. */
export async function resolveDatabaseUrl(root: string): Promise<string | null> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const file of ['.env', '.env.local']) {
    try {
      const raw = await fs.readFile(path.join(root, file), 'utf8');
      const match = /^DATABASE_URL\s*=\s*(.+)$/m.exec(raw);
      if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, '');
    } catch {
      /* file is optional */
    }
  }
  return null;
}
