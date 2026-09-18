import { spawn } from 'node:child_process';

export interface RunResult { code: number; stdout: string; stderr: string; }

export function run(command: string, args: string[], opts: { cwd?: string; inherit?: boolean } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: opts.cwd ?? process.cwd(),
      stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += String(d); });
    child.stderr?.on('data', (d) => { stderr += String(d); });
    child.on('error', (e) => resolve({ code: 127, stdout, stderr: e.message }));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export interface DockerStatus {
  installed: boolean;
  running: boolean;
  composeV2: boolean;
  message: string;
}

/**
 * Docker problems are the single most common reason `baseforge dev` fails, so the CLI
 * distinguishes "not installed" from "installed but not running" instead of printing
 * one generic error for both.
 */
export async function checkDocker(): Promise<DockerStatus> {
  const version = await run('docker', ['--version']);
  if (version.code === 127) {
    return {
      installed: false, running: false, composeV2: false,
      message: 'Docker is not installed. Install Docker Desktop (or Docker Engine on Linux) and try again: https://docs.docker.com/get-docker/',
    };
  }

  const info = await run('docker', ['info']);
  if (info.code !== 0) {
    return {
      installed: true, running: false, composeV2: false,
      message: 'Docker is installed but the daemon is not running. Start Docker and try again.',
    };
  }

  const compose = await run('docker', ['compose', 'version']);
  if (compose.code !== 0) {
    return {
      installed: true, running: true, composeV2: false,
      message: 'Docker Compose v2 was not found. BaseForge uses `docker compose`, not the legacy `docker-compose` binary.',
    };
  }

  return { installed: true, running: true, composeV2: true, message: 'Docker is ready.' };
}
