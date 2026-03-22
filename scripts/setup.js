#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const envFile = path.join(root, 'backend', '.env');
const envEx   = path.join(root, 'backend', '.env.example');

if (!fs.existsSync(dataDir)) { fs.mkdirSync(dataDir, { recursive: true }); console.log('✓ Created data/'); }
['agents.json', 'analyses.json'].forEach(f => {
  const fp = path.join(dataDir, f);
  if (!fs.existsSync(fp)) { fs.writeFileSync(fp, '[]'); console.log(`✓ Created data/${f}`); }
});
if (!fs.existsSync(envFile) && fs.existsSync(envEx)) { fs.copyFileSync(envEx, envFile); console.log('✓ Created backend/.env'); }

console.log(`
  AssetFlow setup complete!

  Next:
    yarn install
    yarn dev

  Then open: http://localhost:5173
  Go to Agents tab → add your first agent → run analysis.
`);
