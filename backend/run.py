from app import create_app
from app.config import Config
config = Config()
config.ensure()
app = create_app(config)
if __name__ == '__main__':
    print(f'\n  AssetFlow  http://localhost:{config.PORT}\n')
    app.run(host='0.0.0.0', port=config.PORT,
            debug=config.FLASK_ENV=='development',
            use_reloader=False, threaded=True)
