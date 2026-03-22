"""
AssetFlow Configuration
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Config:
    SECRET_KEY: str = os.getenv('SECRET_KEY', 'assetflow-dev-secret')
    FLASK_ENV: str = os.getenv('FLASK_ENV', 'development')
    PORT: int = int(os.getenv('PORT', 5001))
    FRONTEND_URL: str = os.getenv('FRONTEND_URL', 'http://localhost:5173')

    # Data persistence — local JSON files, no database needed
    DATA_DIR: Path = Path(os.getenv('DATA_DIR', str(BASE_DIR / 'data')))
    AGENTS_FILE: Path = DATA_DIR / 'agents.json'
    ANALYSES_FILE: Path = DATA_DIR / 'analyses.json'
    MAX_ANALYSES_STORED: int = 500

    # Analysis concurrency
    MAX_CONCURRENT_AGENTS: int = int(os.getenv('MAX_CONCURRENT_AGENTS', 5))

    # Logging
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')

    def ensure_data_dir(self):
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
