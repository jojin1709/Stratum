import path from 'node:path';
import { loadProject, resolveDatabaseUrl } from '../project.js';
import { checkDocker, run } from '../docker.js';
import { bold, dim, fail, info, ok, warn } from '../ui.js';

async function apiUrl(): Promise<string> {
  const project = await loadProject();
  return project?.config.apiUrl ?? 'http://localhost:8788';
}

/** Brings up Postgres, then hands over to the API and dashboard dev servers. */
export async function devCommand(): Promise<void> {
  const project = await loadProject();
  if (!project) fail('No stratum.json found.', 'Run `stratum init` first.');

  const docker = await checkDocker();
  if (!docker.composeV2) {
    const url = await resolveDatabaseUrl(project.root);
    if (!url) fail(docker.message, 'Alternatively, set DATABASE_URL to an existing Postgres instance.');
    warn(`${docker.message}`);
    info(`Using DATABASE_URL from your environment instead of Docker.`);
  } else {
    info('Starting Postgres…');
    const up = await run('docker', ['compose', 'up', '-d', 'postgres'], { cwd: project.root });
    if (up.code !== 0) fail('docker compose failed to start Postgres.', up.stderr.trim());
    ok('Postgres is up.');
  }

  console.log(`
  ${bold('Stratum')} ${dim('· ' + project.config.name)} ${dim('· Developed by Jojin John')}

    Dashboard  ${project.config.dashboardUrl}
    API        ${project.config.apiUrl}
    Realtime   ${project.config.apiUrl.replace(/^http/, 'ws')}/realtime/v1

  ${dim('Run the API and dashboard with: pnpm dev')}
`);
}

export async function startCommand(): Promise<void> {
  const project = await loadProject();
  if (!project) fail('No stratum.json found.');
  const docker = await checkDocker();
  if (!docker.composeV2) fail(docker.message);
  const result = await run('docker', ['compose', 'up', '-d'], { cwd: project.root, inherit: true });
  if (result.code !== 0) fail('docker compose up failed.');
  ok('Stratum services started.');
}

export async function stopCommand(): Promise<void> {
  const project = await loadProject();
  if (!project) fail('No stratum.json found.');
  const result = await run('docker', ['compose', 'down'], { cwd: project.root, inherit: true });
  if (result.code !== 0) fail('docker compose down failed.');
  ok('Stratum services stopped.');
}

export async function statusCommand(): Promise<void> {
  const project = await loadProject();
  if (!project) fail('No stratum.json found.', 'Run `stratum init` first.');

  const docker = await checkDocker();
  console.log(`\n  ${bold('Project')}   ${project.config.name}`);
  console.log(`  ${bold('Root')}      ${project.root}`);
  console.log(`  ${bold('Docker')}    ${docker.composeV2 ? 'ready' : docker.message}`);

  const url = `${await apiUrl()}/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const body = (await res.json()) as {
      status: string; database: { connected: boolean; latencyMs: number };
      storage: { driver: string }; realtime: { connections: number };
    };
    console.log(`  ${bold('API')}       ${body.status} ${dim(`(${url})`)}`);
    console.log(`  ${bold('Database')}  ${body.database.connected ? `connected ${dim(`${body.database.latencyMs}ms`)}` : 'unreachable'}`);
    console.log(`  ${bold('Storage')}   ${body.storage.driver}`);
    console.log(`  ${bold('Realtime')}  ${body.realtime.connections} connection(s)\n`);
  } catch {
    console.log(`  ${bold('API')}       not reachable ${dim(`(${url})`)}\n`);
    info('Start it with: stratum dev');
  }
}

export async function logsCommand(opts: { limit: string; type: string }): Promise<void> {
  const project = await loadProject();
  if (!project) fail('No stratum.json found.');

  const secret = process.env.STRATUM_SECRET_KEY ?? process.env.BASEFORGE_SECRET_KEY;
  if (!secret) fail('STRATUM_SECRET_KEY is not set.', 'Log endpoints require the secret key.');

  const endpoint = opts.type === 'functions' ? 'functions' : 'requests';
  const res = await fetch(`${project.config.apiUrl}/logs/v1/${endpoint}?limit=${encodeURIComponent(opts.limit)}`, {
    headers: { apikey: secret },
  }).catch(() => null);

  if (!res?.ok) fail(`Could not read logs from ${project.config.apiUrl}.`, 'Is the API running?');
  const body = (await res.json()) as { data: Record<string, unknown>[] };

  for (const row of body.data.reverse()) {
    if (endpoint === 'requests') {
      console.log(`${dim(String(row.at).slice(11, 19))}  ${String(row.method).padEnd(6)} ${String(row.path).padEnd(40)} ${row.status}  ${dim(`${row.duration_ms}ms`)}`);
    } else {
      console.log(`${dim(String(row.at).slice(11, 19))}  ${String(row.function).padEnd(16)} ${String(row.level).padEnd(5)} ${row.message}`);
    }
  }
}

export { path };
