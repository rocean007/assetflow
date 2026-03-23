from app import create_app, socketio
from app.config import Config
config = Config()
config.ensure_dirs()
app = create_app(config)
if __name__ == '__main__':
    print(f'\n  AssetFlow  http://localhost:{config.PORT}\n')
    socketio.run(app, host='0.0.0.0', port=config.PORT,
                 debug=config.FLASK_ENV=='development')
