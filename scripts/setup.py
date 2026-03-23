#!/usr/bin/env python3
import shutil
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
(DATA / 'uploads').mkdir(exist_ok=True)

for f in ('agents.json', 'projects.json', 'analyses.json', 'simulations.json'):
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
print("  Start the backend:")
print("    cd backend")
print("    pip install -r requirements.txt")
print("    python run.py")
print("")
print("  Start the frontend (new terminal):")
print("    cd frontend")
print("    yarn install")
print("    yarn dev")
print("")
print("  Open: http://localhost:5173")
print("  Built-in free agents are ready. No API key needed.")
print("")
