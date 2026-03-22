#!/usr/bin/env node
/**
 * AssetFlow dev launcher
 * Runs backend and frontend concurrently without needing the root concurrently package
 */
const { spawn } = require('child_process');
const path = require('path');

function run(cmd, args, cwd, color) {
  const proc = spawn(cmd, args, { cwd, stdio: 'pipe', shell: true });
  proc.stdout.on('data', d => process.stdout.write(`\x1b[${color}m[${cwd.split('/').pop()}]\x1b[0m ${d}`));
  proc.stderr.on('data', d => process.stderr.write(`\x1b[${color}m[${cwd.split('/').pop()}]\x1b[0m ${d}`));
  proc.on('exit', code => { if (code !== 0) process.exit(code); });
  return proc;
}

const root = path.join(__dirname, '..');
const backend = run('node', ['server.js'], path.join(root, 'backend'), '36');
const frontend = run('npx', ['vite'], path.join(root, 'frontend'), '35');

process.on('SIGINT', () => { backend.kill(); frontend.kill(); process.exit(0); });
