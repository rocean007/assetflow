from flask import Blueprint

agents_bp   = Blueprint('agents',   __name__)
analysis_bp = Blueprint('analysis', __name__)
market_bp   = Blueprint('market',   __name__)

from . import agents, analysis, market  # noqa: F401, E402
