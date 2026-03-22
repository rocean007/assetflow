"""
Agent management API — CRUD for LLM agent configurations.
"""
import traceback
from flask import request, jsonify, current_app
from . import agents_bp
from ..models.agent import Agent, AgentManager
from ..services.llm_client import call_llm
from ..utils.logger import get_logger

logger = get_logger('assetflow.api.agents')


def _get_manager() -> AgentManager:
    cfg = current_app.config.get('AF_CONFIG')
    return AgentManager(cfg.AGENTS_FILE)


def _sanitize(agent: Agent) -> dict:
    return agent.to_dict(include_key=False)


# ─── LIST ────────────────────────────────────────────────────────────────────

@agents_bp.get('/')
def list_agents():
    """List all configured agents (API keys redacted)."""
    try:
        agents = _get_manager().list_agents()
        return jsonify({'success': True, 'data': [_sanitize(a) for a in agents], 'count': len(agents)})
    except Exception as e:
        logger.error(f'list_agents: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


# ─── CREATE ──────────────────────────────────────────────────────────────────

@agents_bp.post('/')
def create_agent():
    """Create a new agent."""
    try:
        data = request.get_json() or {}
        if not data.get('name') or not data.get('provider'):
            return jsonify({'success': False, 'error': 'name and provider are required'}), 400

        agent = Agent(
            name=data['name'],
            provider=data['provider'],
            api_key=data.get('api_key', ''),
            model=data.get('model', ''),
            base_url=data.get('base_url', ''),
            role=data.get('role', 'specialist'),
            description=data.get('description', ''),
            enabled=data.get('enabled', True),
        )
        _get_manager().save_agent(agent)
        logger.info(f'Created agent: {agent.id} ({agent.name})')
        return jsonify({'success': True, 'data': _sanitize(agent)}), 201

    except Exception as e:
        logger.error(f'create_agent: {e}')
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


# ─── GET ─────────────────────────────────────────────────────────────────────

@agents_bp.get('/<agent_id>')
def get_agent(agent_id: str):
    """Get a single agent by ID."""
    agent = _get_manager().get_agent(agent_id)
    if not agent:
        return jsonify({'success': False, 'error': f'Agent not found: {agent_id}'}), 404
    return jsonify({'success': True, 'data': _sanitize(agent)})


# ─── UPDATE ──────────────────────────────────────────────────────────────────

@agents_bp.put('/<agent_id>')
def update_agent(agent_id: str):
    """Update an existing agent."""
    try:
        mgr = _get_manager()
        existing = mgr.get_agent(agent_id)
        if not existing:
            return jsonify({'success': False, 'error': f'Agent not found: {agent_id}'}), 404

        data = request.get_json() or {}
        # Only update fields that are provided; preserve api_key if blank (means keep existing)
        for field in ('name', 'provider', 'model', 'base_url', 'role', 'description', 'enabled'):
            if field in data:
                setattr(existing, field, data[field])
        if data.get('api_key'):  # Only update key if a new one is provided
            existing.api_key = data['api_key']

        mgr.save_agent(existing)
        return jsonify({'success': True, 'data': _sanitize(existing)})

    except Exception as e:
        logger.error(f'update_agent: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


# ─── DELETE ──────────────────────────────────────────────────────────────────

@agents_bp.delete('/<agent_id>')
def delete_agent(agent_id: str):
    """Delete an agent."""
    ok = _get_manager().delete_agent(agent_id)
    if not ok:
        return jsonify({'success': False, 'error': f'Agent not found: {agent_id}'}), 404
    return jsonify({'success': True, 'message': f'Agent deleted: {agent_id}'})


# ─── TEST ────────────────────────────────────────────────────────────────────

@agents_bp.post('/<agent_id>/test')
def test_agent(agent_id: str):
    """Test agent connectivity — call LLM with a simple prompt."""
    agent = _get_manager().get_agent(agent_id)
    if not agent:
        return jsonify({'success': False, 'error': f'Agent not found: {agent_id}'}), 404

    try:
        response = call_llm(agent,
            'You are a helpful assistant.',
            'Respond with exactly: "AssetFlow connection OK"')
        return jsonify({'success': True, 'response': response[:300]})
    except Exception as e:
        logger.warning(f'Agent test failed for {agent_id}: {e}')
        return jsonify({'success': False, 'error': str(e)}), 400
