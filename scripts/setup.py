#!/usr/bin/env python3
import shutil
from pathlib import Path
ROOT = Path(__file__).parent.parent
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
(DATA / 'uploads').mkdir(exist_ok=True)
for f in ('agents.json','projects.json','analyses.json','simulations.json'):
    fp = DATA / f
    if not fp.exists(): fp.write_text('[]')
env = ROOT / 'backend' / '.env'
ex  = ROOT / 'backend' / '.env.example'
if not env.exists() and ex.exists(): shutil.copy(ex, env)
print("
  AssetFlow setup complete!

  cd backend && pip install -r requirements.txt && python run.py
  (new terminal) cd frontend && yarn install && yarn dev
  Open: http://localhost:5173
")
