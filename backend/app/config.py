import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
BASE = Path(__file__).resolve().parent.parent.parent

class Config:
    PORT         = int(os.getenv('PORT', 5001))
    FLASK_ENV    = os.getenv('FLASK_ENV', 'development')
    SECRET_KEY   = os.getenv('SECRET_KEY', 'assetflow-dev')
    LOG_LEVEL    = os.getenv('LOG_LEVEL', 'INFO')
    DATA_DIR     = Path(os.getenv('DATA_DIR', str(BASE / 'data')))
    UPLOADS_DIR  = DATA_DIR / 'uploads'
    SESSIONS_FILE   = DATA_DIR / 'sessions.json'
    AGENTS_FILE     = DATA_DIR / 'agents.json'

    def ensure(self):
        for d in (self.DATA_DIR, self.UPLOADS_DIR):
            d.mkdir(parents=True, exist_ok=True)
        for f in (self.SESSIONS_FILE, self.AGENTS_FILE):
            if not f.exists(): f.write_text('[]')
