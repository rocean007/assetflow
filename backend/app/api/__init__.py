from flask import Blueprint
agents_bp     = Blueprint('agents',     __name__)
projects_bp   = Blueprint('projects',   __name__)
graph_bp      = Blueprint('graph',      __name__)
simulation_bp = Blueprint('simulation', __name__)
market_bp     = Blueprint('market',     __name__)
tasks_bp      = Blueprint('tasks',      __name__)
from . import agents, projects, graph, simulation, market, tasks  # noqa
