from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from .config import Config
from .utils.logger import get_logger
log = get_logger('assetflow')
socketio = SocketIO()

def create_app(config=None):
    app = Flask(__name__)
    cfg = config or Config()
    app.config.from_object(cfg)
    app.config['AF_CONFIG'] = cfg
    CORS(app, origins=[cfg.FRONTEND_URL,'http://localhost:5173','http://localhost:3000'])
    socketio.init_app(app, cors_allowed_origins='*', async_mode='gevent', logger=False, engineio_logger=False)
    from .api.agents    import agents_bp
    from .api.projects  import projects_bp
    from .api.graph     import graph_bp
    from .api.simulation import simulation_bp
    from .api.market    import market_bp
    from .api.tasks     import tasks_bp
    app.register_blueprint(agents_bp,    url_prefix='/api/agents')
    app.register_blueprint(projects_bp,  url_prefix='/api/projects')
    app.register_blueprint(graph_bp,     url_prefix='/api/graph')
    app.register_blueprint(simulation_bp,url_prefix='/api/simulation')
    app.register_blueprint(market_bp,    url_prefix='/api/market')
    app.register_blueprint(tasks_bp,     url_prefix='/api/tasks')
    @app.get('/api/health')
    def health():
        from flask import jsonify; import time
        return jsonify({'status':'ok','ts':int(time.time())})
    log.info('AssetFlow ready — 6 blueprints registered')
    return app
