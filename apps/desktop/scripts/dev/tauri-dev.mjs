import { spawn } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const env = { ...process.env };

if (platform() === 'darwin' && !env.CARGO_TARGET_DIR) {
  env.CARGO_TARGET_DIR = join(homedir(), 'Library', 'Caches', 'taurent', 'cargo-target');
  console.info(`[desktop:dev] using CARGO_TARGET_DIR=${env.CARGO_TARGET_DIR}`);
  console.info('[desktop:dev] macOS suppresses dev notifications when the binary is under Documents/Desktop/Downloads.');
}

const executable = platform() === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(executable, ['exec', 'tauri', 'dev', ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
});

const signalExitCodes = new Map([
  ['SIGINT', 130],
  ['SIGTERM', 143],
]);

for (const signal of signalExitCodes.keys()) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(signalExitCodes.get(signal) ?? 1);
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`[desktop:dev] failed to start Tauri dev process: ${error.message}`);
  process.exit(1);
});
