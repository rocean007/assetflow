from flask import Flask
from flask_cors import CORS
from .config import Config
from .utils.logger import get_logger
log = get_logger('af')

def create_app(config=None):
    app = Flask(__name__)
    cfg = config or Config()
    app.config.from_object(cfg)
    app.config['AF_CFG'] = cfg
    app.secret_key = cfg.SECRET_KEY
    CORS(app, origins=['*'])
    from .api.sessions import sessions_bp
    from .api.agents   import agents_bp
    from .api.market   import market_bp
    app.register_blueprint(sessions_bp, url_prefix='/api/sessions')
    app.register_blueprint(agents_bp,   url_prefix='/api/agents')
    app.register_blueprint(market_bp,   url_prefix='/api/market')
    @app.get('/api/health')
    def health():
        from flask import jsonify; import time
        return jsonify({'ok':True,'ts':int(time.time())})
    log.info('AssetFlow ready')
    return app
