import path from 'node:path';
import { buildWorker, discoverFunctions, scaffoldFunction } from '@stratum/functions';
import { loadProject } from '../project.js';
import { dim, fail, green, info, ok, red, table, yellow } from '../ui.js';

async function functionsDir(): Promise<{ root: string; dir: string; apiUrl: string }> {
  const project = await loadProject();
  if (!project) fail('No stratum.json found.', 'Run `stratum init` first.');
  return {
    root: project.root,
    dir: path.resolve(project.root, project.config.functionsDir),
    apiUrl: project.config.apiUrl,
  };
}

export async function functionsList(): Promise<void> {
  const { dir } = await functionsDir();
  const found = await discoverFunctions(dir);
  if (found.length === 0) {
    info('No functions yet. Create one with: stratum functions new <name>');
    return;
  }
  table(
    found.map((f) => ({
      name: f.name,
      worker: f.compatIssues.length === 0 ? green('compatible') : yellow(`${f.compatIssues.length} issue(s)`),
      entrypoint: path.relative(process.cwd(), f.entrypoint),
    })),
  );
}

export async function functionsNew(name: string): Promise<void> {
  const { dir } = await functionsDir();
  try {
    const file = await scaffoldFunction(dir, name);
    ok(`Created ${path.relative(process.cwd(), file)}`);
    info(`Invoke it locally at POST /functions/v1/${name}`);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
}

export async function functionsDev(): Promise<void> {
  const { dir, apiUrl } = await functionsDir();
  const found = await discoverFunctions(dir);
  console.log(`\n  ${found.length} function(s) served by the running API:\n`);
  for (const f of found) console.log(`    POST ${apiUrl}/functions/v1/${f.name}`);
  console.log(`\n  ${dim('Edits are picked up on the next invocation — no restart needed.')}\n`);
}

/**
 * Builds a Worker bundle and prints the exact wrangler command to run.
 * Stratum never holds Cloudflare credentials or deploys on the user's behalf.
 */
export async function functionsDeploy(name: string, opts: { target: string }): Promise<void> {
  const { root, dir } = await functionsDir();
  if (opts.target !== 'cloudflare') {
    fail(`Unknown deploy target "${opts.target}".`, 'The only supported target today is `cloudflare`.');
  }

  try {
    const result = await buildWorker({ functionsDir: dir, name, outRoot: path.join(root, '.stratum', 'workers') });
    ok(`Built ${name} (${result.sizeBytes} bytes)`);
    console.log(`
  ${dim('Deploy it with your own Cloudflare credentials:')}

    cd ${path.relative(process.cwd(), result.outDir)}
    npx wrangler deploy
`);
  } catch (e) {
    const details = (e as { details?: { issues?: { api: string; line: number; message: string }[] } }).details;
    if (details?.issues) {
      console.log(`\n  ${red('✗')} ${name} cannot run in the Workers runtime:\n`);
      for (const issue of details.issues) console.log(`    line ${issue.line}  ${issue.message}`);
      console.log(`\n  ${dim('It will still run on the local/self-hosted runtime.')}\n`);
      process.exit(1);
    }
    fail(e instanceof Error ? e.message : String(e));
  }
}
