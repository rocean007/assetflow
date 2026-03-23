import threading, traceback
from flask import request, jsonify, current_app
from . import graph_bp
from ..models.project import Project, ProjectStatus
from ..models.base import JsonStore
from ..models.agent import Agent
from ..models.task import TaskManager, TaskStatus
from ..services import run_pipeline, AnalysisStore, extract_text
from ..utils.logger import get_logger
log = get_logger('assetflow.api.graph')

def _projects(): return JsonStore(current_app.config['AF_CONFIG'].PROJECTS_FILE, Project)
def _agents():   return JsonStore(current_app.config['AF_CONFIG'].AGENTS_FILE, Agent)
def _store():    return AnalysisStore(current_app.config['AF_CONFIG'].ANALYSES_FILE)

@graph_bp.post('/build')
def build():
    """Start graph build pipeline for a project. Returns task_id immediately."""
    try:
        d = request.get_json() or {}
        pid = d.get('project_id')
        if not pid: return jsonify({'success':False,'error':'project_id required'}), 400
        ps = _projects(); p = ps.get(pid, 'project_id')
        if not p: return jsonify({'success':False,'error':f'Project not found: {pid}'}), 404
        agents = [a for a in _agents().list() if a.enabled]
        if not agents:
            return jsonify({'success':False,'error':'No enabled agents. Add agents first.'}), 400
        cfg = current_app.config['AF_CONFIG']
        # Load uploaded file texts
        extra_texts = []
        for fi in p.files:
            txt = extract_text(fi.get('path',''))
            if txt.strip(): extra_texts.append(f"=== {fi['filename']} ===\n{txt}")
        asset = {'symbol':p.symbol,'asset_name':p.asset_name,'asset_type':p.asset_type,
                 'av_key':p.av_key,'description':p.description,'extra_texts':extra_texts}
        task = TaskManager.create(f'Build: {p.symbol}')
        p.status = ProjectStatus.GRAPH_BUILDING; p.error = None; p.touch(); ps.save(p)
        store = _store()
        def on_complete(aid, record):
            p2 = ps.get(pid, 'project_id')
            if not p2: return
            p2.status = ProjectStatus.COMPLETED; p2.analysis_id = aid
            gs = record.get('graph',{}).get('stats',{})
            p2.agent_count = gs.get('total_agents',0)
            p2.node_count  = gs.get('total_nodes',0)
            p2.edge_count  = gs.get('total_edges',0)
            p2.touch(); ps.save(p2)
        def bg(): run_pipeline(asset, agents, task, store, on_complete)
        threading.Thread(target=bg, daemon=True).start()
        return jsonify({'success':True,'data':{'project_id':pid,'task_id':task.task_id,
                        'status':'building','message':f'Poll /api/tasks/{task.task_id}'}})
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'traceback':traceback.format_exc()}), 500

@graph_bp.get('/<pid>')
def get_graph(pid):
    p = _projects().get(pid, 'project_id')
    if not p: return jsonify({'success':False,'error':f'Not found: {pid}'}), 404
    if not p.analysis_id: return jsonify({'success':False,'error':'No graph yet. Call /api/graph/build'}), 404
    rec = _store().get(p.analysis_id)
    if not rec: return jsonify({'success':False,'error':'Analysis record not found'}), 404
    return jsonify({'success':True,'data':{'project_id':pid,'analysis_id':p.analysis_id,
                    'graph':rec.get('graph'),'stats':rec.get('stats'),'built_at':rec.get('created_at')}})

@graph_bp.get('/<pid>/nodes')
def get_nodes(pid):
    p = _projects().get(pid, 'project_id')
    if not p or not p.analysis_id: return jsonify({'success':False,'error':'No graph'}), 404
    rec = _store().get(p.analysis_id)
    nodes = (rec or {}).get('graph',{}).get('nodes',[])
    t = request.args.get('type')
    if t: nodes = [n for n in nodes if n.get('type')==t]
    return jsonify({'success':True,'data':nodes,'count':len(nodes)})

@graph_bp.get('/<pid>/signals')
def get_signals(pid):
    p = _projects().get(pid, 'project_id')
    if not p or not p.analysis_id: return jsonify({'success':False,'error':'No graph'}), 404
    rec = _store().get(p.analysis_id)
    sigs = (rec or {}).get('graph',{}).get('signals',[])
    return jsonify({'success':True,'data':sigs,'count':len(sigs)})

@graph_bp.delete('/<pid>')
def delete_graph(pid):
    ps = _projects(); p = ps.get(pid, 'project_id')
    if not p: return jsonify({'success':False,'error':f'Not found: {pid}'}), 404
    from ..models.project import ProjectStatus
    p.status=ProjectStatus.CREATED; p.analysis_id=None; p.agent_count=0
    p.node_count=0; p.edge_count=0; p.touch(); ps.save(p)
    return jsonify({'success':True,'message':f'Graph cleared for {pid}'})
