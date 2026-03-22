#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const envFile = path.join(__dirname, '../backend/.env');
const envExample = path.join(__dirname, '../backend/.env.example');

// Create data dir
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✓ Created data/ directory');
}

// Create .env from example
if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envFile);
  console.log('✓ Created backend/.env from example');
}

// Create empty data files
['agents.json', 'analyses.json'].forEach(f => {
  const fp = path.join(dataDir, f);
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(fp, f === 'agents.json' ? '[]' : '[]');
    console.log(`✓ Created data/${f}`);
  }
});

console.log('\n🌊 AssetFlow setup complete!');
console.log('Next steps:');
console.log('  1. npm run install:all');
console.log('  2. npm run dev');
console.log('  3. Open http://localhost:5173');
console.log('  4. Go to Agents tab → add your first AI agent');
console.log('  5. Go to Analyze tab → enter a symbol and run!\n');
