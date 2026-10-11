import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const NEXT_BIN = `${PROJECT_ROOT}node_modules/next/dist/bin/next`;
const STANDALONE_SERVER = `${PROJECT_ROOT}.next/standalone/server.js`;

export interface RunningNext {
  readonly baseUrl: string;
  /** Server stdout/stderr, for diagnostics. */
  readonly output: string[];
  stop(): Promise<void>;
}

/** Runs `next build` once (skipped with `PDP_IT_SKIP_BUILD=1`). */
export async function buildNext(): Promise<void> {
  if (process.env.PDP_IT_SKIP_BUILD !== '1') {
    await run(process.execPath, [NEXT_BIN, 'build'], { ...process.env, NODE_ENV: 'production' });
  }
  copyStandaloneAssets();
}

/**
 * `output: 'standalone'` does not include `public/` or `.next/static`; a
 * deployment copies them next to `server.js` (as the Dockerfile must). Done
 * here too so tests can load the layout assets from the real server.
 */
function copyStandaloneAssets(): void {
  const standalone = `${PROJECT_ROOT}.next/standalone`;
  if (!existsSync(standalone)) return;
  if (existsSync(`${PROJECT_ROOT}public`)) {
    cpSync(`${PROJECT_ROOT}public`, `${standalone}/public`, { recursive: true });
  }
  cpSync(`${PROJECT_ROOT}.next/static`, `${standalone}/.next/static`, { recursive: true });
}

/** Starts the standalone Next server on a free port with the given environment and waits until it answers. */
export async function startNext(env: Record<string, string>): Promise<RunningNext> {
  const port = await freePort();
  const output: string[] = [];
  // The standalone server is what production runs (`output: 'standalone'`).
  const child = spawn(process.execPath, [STANDALONE_SERVER], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString()));

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitUntilReady(baseUrl, child, output);
  return { baseUrl, output, stop: () => stop(child) };
}

async function waitUntilReady(
  baseUrl: string,
  child: ChildProcess,
  output: string[],
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next server exited with ${child.exitCode}:\n${output.join('')}`);
    }
    try {
      const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(2_000) });
      await response.body?.cancel();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  await stop(child);
  throw new Error(`Next server did not become ready:\n${output.join('')}`);
}

function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 5_000).unref();
  });
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const output: string[] = [];
    child.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`next build failed (${code}):\n${output.join('')}`)),
    );
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}
