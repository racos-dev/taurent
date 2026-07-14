// @vitest-environment node

import { spawn, type ChildProcess } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  findAvailablePort,
  isTcpPortOpen,
  killAppProcessTree,
  waitForTcpPortClosed,
} from './infrastructure.js';

function waitForOutput(child: ChildProcess, expected: string): Promise<void> {
  return new Promise((resolveReady, rejectReady) => {
    let stderr = '';
    const cleanup = (): void => {
      clearTimeout(timeout);
      child.off('error', onError);
      child.off('exit', onExit);
    };
    const onError = (error: Error): void => {
      cleanup();
      rejectReady(error);
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      cleanup();
      rejectReady(new Error(`Child exited before '${expected}' (code=${code}, signal=${signal}): ${stderr}`));
    };
    const timeout = setTimeout(() => {
      cleanup();
      rejectReady(new Error(`Timed out waiting for '${expected}': ${stderr}`));
    }, 5_000);
    child.once('error', onError);
    child.once('exit', onExit);
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    child.stdout?.on('data', (chunk) => {
      if (!String(chunk).includes(expected)) return;
      cleanup();
      resolveReady();
    });
  });
}

describe('native E2E process teardown', () => {
  it('waits for the process to exit and release its WebDriver port', async () => {
    const port = await findAvailablePort(45_000);
    const childScript = [
      "const http = require('node:http')",
      `const server = http.createServer((_req, res) => res.end('ok')).listen(${port}, '127.0.0.1', () => console.log('ready'))`,
      "process.on('SIGTERM', () => setTimeout(() => server.close(() => process.exit(0)), 250))",
    ].join(';');
    const child = spawn(
      process.execPath,
      ['-e', childScript],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    try {
      await waitForOutput(child, 'ready');
      expect(await isTcpPortOpen(port)).toBe(true);

      await killAppProcessTree(child, 'unused-test-profile');
      expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
      await waitForTcpPortClosed(port, 2_000);

      expect(await isTcpPortOpen(port)).toBe(false);
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  }, 10_000);
});
