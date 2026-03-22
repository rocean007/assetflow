"""
AssetFlow Backend — Entry Point
Run with: python run.py
"""
import os
import sys
from pathlib import Path

# Ensure data directory exists before anything imports storage
data_dir = Path(__file__).parent.parent / 'data'
data_dir.mkdir(parents=True, exist_ok=True)

from app import create_app, socketio
from app.config import Config

config = Config()
config.ensure_data_dir()

app = create_app(config)
app.config['AF_CONFIG'] = config

if __name__ == '__main__':
    port = config.PORT
    debug = config.FLASK_ENV == 'development'
    print(f'\n  AssetFlow backend  http://localhost:{port}')
    print(f'  SocketIO ready     ws://localhost:{port}')
    print(f'  Environment        {config.FLASK_ENV}\n')
    socketio.run(app, host='0.0.0.0', port=port, debug=debug)
