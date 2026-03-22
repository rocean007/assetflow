#!/usr/bin/env python3
"""AssetFlow setup — run once before first start."""
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = ROOT / 'data'
ENV  = ROOT / 'backend' / '.env'
ENV_EX = ROOT / 'backend' / '.env.example'

DATA.mkdir(parents=True, exist_ok=True)
print('✓ Created data/')

for f in ('agents.json', 'analyses.json'):
    fp = DATA / f
    if not fp.exists():
        fp.write_text('[]', encoding='utf-8')
        print(f'✓ Created data/{f}')

if not ENV.exists() and ENV_EX.exists():
    shutil.copy(ENV_EX, ENV)
    print('✓ Created backend/.env')

print("""
  AssetFlow setup complete!

  Start:
    cd backend && pip install -r requirements.txt
    python run.py

    (separate terminal)
    cd frontend && yarn install && yarn dev

  Then open: http://localhost:5173
  Built-in free agents are ready to use — no API key needed.
""")
