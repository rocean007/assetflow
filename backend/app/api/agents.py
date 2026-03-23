import traceback
from flask import request, jsonify, current_app
from . import agents_bp
from ..models.agent import Agent, BUILTIN_AGENTS
from ..models.base import JsonStore
from ..services.llm_client import call_llm
from ..utils.logger import get_logger
log = get_logger('assetflow.api.agents')

def _store():
    cfg = current_app.config['AF_CONFIG']
    s = JsonStore(cfg.AGENTS_FILE, Agent)
    if not s.list():
        from datetime import datetime, timezone
        for d in BUILTIN_AGENTS:
            a = Agent(**{**d, 'created_at': datetime.now(timezone.utc).isoformat()})
            s.save(a)
        log.info(f'Seeded {len(BUILTIN_AGENTS)} built-in free agents')
    return s

@agents_bp.get('/')
def list_agents():
    agents = _store().list()
    return jsonify({'success':True,'data':[a.to_dict() for a in agents],'count':len(agents)})

@agents_bp.post('/')
def create_agent():
    try:
        d = request.get_json() or {}
        if not d.get('name') or not d.get('provider'):
            return jsonify({'success':False,'error':'name and provider required'}), 400
        a = Agent(name=d['name'],provider=d['provider'],api_key=d.get('api_key',''),
                  model=d.get('model',''),base_url=d.get('base_url',''),
                  role=d.get('role','specialist'),description=d.get('description',''),
                  enabled=d.get('enabled',True))
        _store().save(a)
        return jsonify({'success':True,'data':a.to_dict()}), 201
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'traceback':traceback.format_exc()}), 500

@agents_bp.get('/<agent_id>')
def get_agent(agent_id):
    a = _store().get(agent_id, 'agent_id')
    if not a: return jsonify({'success':False,'error':f'Not found: {agent_id}'}), 404
    return jsonify({'success':True,'data':a.to_dict()})

@agents_bp.put('/<agent_id>')
def update_agent(agent_id):
    try:
        s = _store(); a = s.get(agent_id, 'agent_id')
        if not a: return jsonify({'success':False,'error':f'Not found: {agent_id}'}), 404
        d = request.get_json() or {}
        for f in ('name','provider','model','base_url','role','description','enabled'):
            if f in d: setattr(a, f, d[f])
        if d.get('api_key'): a.api_key = d['api_key']
        s.save(a)
        return jsonify({'success':True,'data':a.to_dict()})
    except Exception as e:
        return jsonify({'success':False,'error':str(e)}), 500

@agents_bp.delete('/<agent_id>')
def delete_agent(agent_id):
    ok = _store().delete(agent_id, 'agent_id')
    if not ok: return jsonify({'success':False,'error':f'Not found: {agent_id}'}), 404
    return jsonify({'success':True,'message':f'Deleted {agent_id}'})

@agents_bp.post('/<agent_id>/test')
def test_agent(agent_id):
    a = _store().get(agent_id, 'agent_id')
    if not a: return jsonify({'success':False,'error':f'Not found: {agent_id}'}), 404
    try:
        r = call_llm(a,'You are a helpful assistant.','Reply with exactly: AssetFlow OK')
        return jsonify({'success':True,'response':r[:300]})
    except Exception as e:
        return jsonify({'success':False,'error':str(e)}), 400
