import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()

BASE = Path(__file__).resolve().parent.parent.parent

class Config:
    SECRET_KEY   = os.getenv('SECRET_KEY',   'assetflow-secret')
    FLASK_ENV    = os.getenv('FLASK_ENV',    'development')
    PORT         = int(os.getenv('PORT',     5001))
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    LOG_LEVEL    = os.getenv('LOG_LEVEL',    'INFO')

    DATA_DIR     = Path(os.getenv('DATA_DIR', str(BASE / 'data')))
    UPLOADS_DIR  = DATA_DIR / 'uploads'

    # JSON persistence files
    AGENTS_FILE      = DATA_DIR / 'agents.json'
    PROJECTS_FILE    = DATA_DIR / 'projects.json'
    ANALYSES_FILE    = DATA_DIR / 'analyses.json'
    SIMULATIONS_FILE = DATA_DIR / 'simulations.json'

    MAX_WORKERS = int(os.getenv('MAX_WORKERS', 5))

    def ensure_dirs(self):
        for d in (self.DATA_DIR, self.UPLOADS_DIR):
            d.mkdir(parents=True, exist_ok=True)
        for f in (self.AGENTS_FILE, self.PROJECTS_FILE,
                  self.ANALYSES_FILE, self.SIMULATIONS_FILE):
            if not f.exists():
                f.write_text('[]')
