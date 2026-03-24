#!/usr/bin/env python3
import shutil
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
(DATA / 'uploads').mkdir(exist_ok=True)
for f in ('sessions.json', 'agents.json'):
    fp = DATA / f
    if not fp.exists():
        fp.write_text('[]')

env = ROOT / 'backend' / '.env'
ex  = ROOT / 'backend' / '.env.example'
if not env.exists() and ex.exists():
    shutil.copy(ex, env)

print("")
print("  AssetFlow setup complete!")
print("")
print("  Start backend:")
print("    cd backend && pip install -r requirements.txt && python run.py")
print("")
print("  Start frontend (new terminal):")
print("    cd frontend && yarn install && yarn dev")
print("")
print("  Open: http://localhost:5173")
print("")
print("  First step: Go to Agents tab and add a Groq agent")
print("  Get free key at: https://console.groq.com (takes 2 min)")
print("")
