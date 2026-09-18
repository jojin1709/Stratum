import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findProjectRoot, loadProject, writeProject, resolveDatabaseUrl } from '../src/project.js';
import { bytes, table } from '../src/ui.js';

let dir: string;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'strat-cli-')); });
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

describe('project resolution', () => {
  it('walks up from a nested directory to find the project root', async () => {
    await writeProject(dir, {
      name: 'demo', apiUrl: 'http://localhost:8788', dashboardUrl: 'http://localhost:8787',
      migrationsDir: './migrations', functionsDir: './functions',
    });
    const nested = path.join(dir, 'a', 'b', 'c');
    await fs.mkdir(nested, { recursive: true });
    expect((await findProjectRoot(nested))?.root).toBe(dir);
    expect((await findProjectRoot(dir))?.root).toBe(dir);
  });

  it('returns null when there is no project anywhere above', async () => {
    expect(await findProjectRoot(dir)).toBeNull();
  });

  it('round-trips the config file', async () => {
    const config = {
      name: 'demo', apiUrl: 'http://localhost:8788', dashboardUrl: 'http://localhost:8787',
      migrationsDir: './migrations', functionsDir: './functions',
    };
    await writeProject(dir, config);
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      const loaded = await loadProject();
      expect(loaded?.config).toEqual(config);
    } finally {
      process.chdir(cwd);
    }
  });
});

describe('DATABASE_URL resolution', () => {
  it('prefers the environment over .env', async () => {
    await fs.writeFile(path.join(dir, '.env'), 'DATABASE_URL=postgres://from-file/db\n');
    process.env.DATABASE_URL = 'postgres://from-env/db';
    try {
      expect(await resolveDatabaseUrl(dir)).toBe('postgres://from-env/db');
    } finally {
      delete process.env.DATABASE_URL;
    }
  });

  it('reads .env and strips surrounding quotes', async () => {
    await fs.writeFile(path.join(dir, '.env'), 'OTHER=1\nDATABASE_URL="postgres://quoted/db"\n');
    expect(await resolveDatabaseUrl(dir)).toBe('postgres://quoted/db');
  });

  it('returns null when nothing defines it', async () => {
    expect(await resolveDatabaseUrl(dir)).toBeNull();
  });
});

describe('output helpers', () => {
  it('formats byte sizes readably', () => {
    expect(bytes(0)).toBe('0 B');
    expect(bytes(1023)).toBe('1023 B');
    expect(bytes(1024)).toBe('1.0 KB');
    expect(bytes(1536)).toBe('1.5 KB');
    expect(bytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('prints an empty table without throwing', () => {
    expect(() => table([])).not.toThrow();
  });
});
