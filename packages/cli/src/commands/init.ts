import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generateKey } from '@stratum/shared';
import { writeProject, CONFIG_FILE, type ProjectConfig } from '../project.js';
import { bold, dim, fail, info, ok } from '../ui.js';

const COMPOSE = `services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: stratum
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-stratum}
      POSTGRES_DB: stratum
    ports:
      - "\${POSTGRES_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stratum -d stratum"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
`;

export async function initCommand(dir: string, opts: { name?: string }): Promise<void> {
  const root = path.resolve(dir);
  await fs.mkdir(root, { recursive: true });

  try {
    await fs.access(path.join(root, CONFIG_FILE));
    fail(`${CONFIG_FILE} already exists in ${root}.`, 'Delete it first if you meant to start over.');
  } catch {
    /* expected: no project yet */
  }

  const name = opts.name ?? path.basename(root);
  const config: ProjectConfig = {
    name,
    apiUrl: 'http://localhost:8788',
    dashboardUrl: 'http://localhost:8787',
    migrationsDir: './migrations',
    functionsDir: './functions',
  };

  await writeProject(root, config);
  await fs.mkdir(path.join(root, 'migrations'), { recursive: true });
  await fs.mkdir(path.join(root, 'functions'), { recursive: true });

  await fs.writeFile(path.join(root, 'docker-compose.yml'), COMPOSE, { flag: 'wx' }).catch(() => {});

  // Keys are generated locally and written to .env, which .gitignore already excludes.
  const publicKey = generateKey('public');
  const secretKey = generateKey('secret');
  await fs.writeFile(
    path.join(root, '.env'),
    [
      'DATABASE_URL=postgres://stratum:stratum@localhost:5432/stratum',
      `STRATUM_PUBLIC_KEY=${publicKey}`,
      `STRATUM_SECRET_KEY=${secretKey}`,
      'STORAGE_DRIVER=local',
      'STORAGE_PATH=./storage-data',
      'NEXT_PUBLIC_STRATUM_URL=http://localhost:8788',
      '',
    ].join('\n'),
    { flag: 'wx' },
  ).catch(() => fail('.env already exists — refusing to overwrite it.'));

  await fs.appendFile(path.join(root, '.gitignore'), '\n.env\nstorage-data/\n').catch(() => {});

  ok(`Created ${bold(name)} in ${root}`);
  console.log(`
  ${dim('Generated project keys (also written to .env):')}

    public  ${publicKey}
    secret  ${secretKey}

  ${dim('The secret key must never ship to a browser.')}
`);
  info('Next: stratum dev');
}
