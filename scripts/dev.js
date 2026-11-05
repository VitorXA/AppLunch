// Sobe servidor (porta 3000, com reload) e Vite (porta 5173) juntos, sem dependências extras.
import { spawn } from 'node:child_process';

const tasks = ['dev:server', 'dev:client'].map((script) =>
  spawn('npm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' }),
);

let exiting = false;
function stopAll(code = 0) {
  if (exiting) return;
  exiting = true;
  for (const task of tasks) task.kill();
  process.exit(code);
}

for (const task of tasks) task.on('exit', (code) => stopAll(code ?? 0));
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
