import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLogger } from '@stratum/shared';
import {
  checkWorkerCompatibility, discoverFunctions, scaffoldFunction,
} from '../src/index.js';

let dir: string;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'strat-fn-')); });
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

const logger = createLogger({ level: 'error' });

describe('worker compatibility checks', () => {
  it('flags Node-only imports with line numbers', () => {
    const issues = checkWorkerCompatibility("import fs from 'node:fs';\nexport default () => new Response('ok');");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ api: 'node:fs', line: 1 });
  });

  it('flags module-path globals and process internals', () => {
    expect(checkWorkerCompatibility('console.log(__dirname);')).toHaveLength(1);
    expect(checkWorkerCompatibility('process.exit(1);')).toHaveLength(1);
  });

  it('passes clean Web-standard code', () => {
    expect(checkWorkerCompatibility('export default async (req) => Response.json({ ok: true });')).toEqual([]);
  });
});

describe('discovery and scaffolding', () => {
  it('scaffolds a function that discovery then finds', async () => {
    await scaffoldFunction(dir, 'hello');
    const found = await discoverFunctions(dir);
    expect(found.map((f) => f.name)).toEqual(['hello']);
    expect(found[0]?.compatIssues).toEqual([]);
  });

  it('returns an empty list for a missing directory rather than throwing', async () => {
    expect(await discoverFunctions(path.join(dir, 'nope'))).toEqual([]);
  });
});
