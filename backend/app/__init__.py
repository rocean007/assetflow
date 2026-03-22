"""
AssetFlow Backend — Flask Application Factory
"""
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from .config import Config
from .utils.logger import get_logger

logger = get_logger('assetflow.app')
socketio = SocketIO()


def create_app(config: Config = None) -> Flask:
    app = Flask(__name__)
    cfg = config or Config()
    app.config.from_object(cfg)

    # CORS
    CORS(app, origins=[cfg.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'])

    # SocketIO for real-time progress
    socketio.init_app(
        app,
        cors_allowed_origins='*',
        async_mode='eventlet',
        logger=False,
        engineio_logger=False
    )

    # Register blueprints
    from .api.agents import agents_bp
    from .api.analysis import analysis_bp
    from .api.market import market_bp

    app.register_blueprint(agents_bp,   url_prefix='/api/agents')
    app.register_blueprint(analysis_bp, url_prefix='/api/analysis')
    app.register_blueprint(market_bp,   url_prefix='/api/market')

    @app.get('/api/health')
    def health():
        from flask import jsonify
        import time
        return jsonify({'status': 'ok', 'ts': int(time.time())})

    logger.info('AssetFlow app created')
    return app
