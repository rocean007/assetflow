import traceback
from flask import request, jsonify, current_app
from . import agents_bp
from ..models.agent import Agent
from ..services.agent_store import AgentStore
from ..services.llm import call_llm

def _store(): return AgentStore(current_app.config['AF_CFG'].AGENTS_FILE)

@agents_bp.get('/')
def list_agents():
    return jsonify({'success':True,'data':[a.to_dict() for a in _store().list()]})

@agents_bp.post('/')
def create():
    try:
        d = request.get_json() or {}
        if not d.get('name') or not d.get('provider'):
            return jsonify({'success':False,'error':'name and provider required'}), 400
        a = Agent(name=d['name'],provider=d['provider'],api_key=d.get('api_key',''),
                  model=d.get('model',''),base_url=d.get('base_url',''),
                  role=d.get('role','specialist'),description=d.get('description',''),
                  enabled=d.get('enabled',True))
        _store().save(a); return jsonify({'success':True,'data':a.to_dict()}), 201
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'tb':traceback.format_exc()}), 500

@agents_bp.get('/<aid>')
def get(aid):
    a = _store().get(aid)
    if not a: return jsonify({'success':False,'error':f'Not found: {aid}'}), 404
    return jsonify({'success':True,'data':a.to_dict()})

@agents_bp.put('/<aid>')
def update(aid):
    try:
        s = _store(); a = s.get(aid)
        if not a: return jsonify({'success':False,'error':f'Not found: {aid}'}), 404
        d = request.get_json() or {}
        for f in ('name','provider','model','base_url','role','description','enabled'):
            if f in d: setattr(a,f,d[f])
        if d.get('api_key'): a.api_key = d['api_key']
        s.save(a); return jsonify({'success':True,'data':a.to_dict()})
    except Exception as e:
        return jsonify({'success':False,'error':str(e)}), 500

@agents_bp.delete('/<aid>')
def delete(aid):
    ok = _store().delete(aid)
    if not ok: return jsonify({'success':False,'error':f'Not found: {aid}'}), 404
    return jsonify({'success':True})

@agents_bp.post('/<aid>/test')
def test(aid):
    a = _store().get(aid)
    if not a: return jsonify({'success':False,'error':f'Not found: {aid}'}), 404
    try:
        r = call_llm(a,'You are a helpful assistant.','Reply with exactly: AssetFlow OK')
        return jsonify({'success':True,'response':r[:200]})
    except Exception as e:
        return jsonify({'success':False,'error':str(e)}), 400
