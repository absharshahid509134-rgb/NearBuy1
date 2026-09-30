#!/usr/bin/env node
// Run one deployable service: `npm run dev:service -- auth` (or -- gateway)
const { spawn } = require('node:child_process')
const name = process.argv[2]
if (!name) {
  console.error('usage: npm run dev:service -- <auth|users|catalog|…|gateway>')
  process.exit(1)
}
const target =
  name === 'gateway'
    ? { cwd: 'backend', cmd: 'npm', args: ['run', 'dev'] }
    : { cwd: `services/${name}`, cmd: 'npx', args: ['tsx', 'watch', '--clear-screen=false', 'src/main.ts'] }
const child = spawn(target.cmd, target.args, { cwd: target.cwd, stdio: 'inherit', shell: false })
child.on('exit', (code) => process.exit(code ?? 0))
