import threading, traceback
from datetime import datetime, timezone
from flask import request, jsonify, current_app
from . import simulation_bp
from ..models.project import Project, ProjectStatus
from ..models.simulation import Simulation, SimStatus
from ..models.base import JsonStore
from ..models.task import TaskManager, TaskStatus
from ..models.agent import Agent
from ..services import AnalysisStore, call_llm
from ..utils.logger import get_logger
log = get_logger('assetflow.api.simulation')

def _projects():    return JsonStore(current_app.config['AF_CONFIG'].PROJECTS_FILE, Project)
def _sims():        return JsonStore(current_app.config['AF_CONFIG'].SIMULATIONS_FILE, Simulation)
def _analyses():    return AnalysisStore(current_app.config['AF_CONFIG'].ANALYSES_FILE)
def _agents():      return JsonStore(current_app.config['AF_CONFIG'].AGENTS_FILE, Agent)

@simulation_bp.post('/')
def create_simulation():
    try:
        d = request.get_json() or {}
        pid = d.get('project_id')
        if not pid: return jsonify({'success':False,'error':'project_id required'}), 400
        p = _projects().get(pid,'project_id')
        if not p: return jsonify({'success':False,'error':f'Project not found: {pid}'}), 404
        if not p.analysis_id:
            return jsonify({'success':False,'error':'Project has no completed analysis. Run /api/graph/build first.'}), 400
        sim = Simulation(project_id=pid, analysis_id=p.analysis_id)
        _sims().save(sim)
        p.simulation_id = sim.simulation_id; p.touch(); _projects().save(p)
        return jsonify({'success':True,'data':sim.summary()}), 201
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'traceback':traceback.format_exc()}), 500

@simulation_bp.get('/')
def list_simulations():
    pid = request.args.get('project_id')
    sims = _sims().list()
    if pid: sims = [s for s in sims if s.project_id == pid]
    return jsonify({'success':True,'data':[s.summary() for s in sims],'count':len(sims)})

@simulation_bp.get('/history')
def history():
    limit = request.args.get('limit',20,type=int)
    sims = _sims().list(limit)
    proj_cache = {}
    out = []
    for sim in sims:
        d = sim.summary()
        if sim.project_id not in proj_cache:
            proj_cache[sim.project_id] = _projects().get(sim.project_id,'project_id')
        p = proj_cache.get(sim.project_id)
        if p: d.update({'symbol':p.symbol,'asset_name':p.asset_name,'asset_type':p.asset_type})
        if sim.final_synthesis:
            syn = sim.final_synthesis
            d.update({'direction':syn.get('primaryDirection'),'up':syn.get('upProbability'),
                      'down':syn.get('downProbability'),'confidence':syn.get('confidence'),
                      'excerpt':(syn.get('summary') or '')[:200]})
        out.append(d)
    return jsonify({'success':True,'data':out,'count':len(out)})

@simulation_bp.get('/<sid>')
def get_simulation(sid):
    sim = _sims().get(sid,'simulation_id')
    if not sim: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
    return jsonify({'success':True,'data':sim.to_dict()})

@simulation_bp.delete('/<sid>')
def delete_simulation(sid):
    ok = _sims().delete(sid,'simulation_id')
    if not ok: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
    return jsonify({'success':True,'message':f'Deleted {sid}'})

@simulation_bp.post('/<sid>/prepare')
def prepare(sid):
    try:
        d = request.get_json() or {}
        force = d.get('force',False)
        ss = _sims(); sim = ss.get(sid,'simulation_id')
        if not sim: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
        if sim.status in (SimStatus.READY, SimStatus.COMPLETED) and not force:
            return jsonify({'success':True,'data':{'simulation_id':sid,'status':sim.status.value,
                            'already_prepared':True,'profiles_count':len(sim.agent_profiles),
                            'message':'Already prepared. Use force=true to redo.'}})
        task = TaskManager.create(f'Prepare: {sid}')
        sim.status = SimStatus.PREPARING; ss.save(sim)
        def bg():
            try:
                TaskManager.update(task.task_id, status=TaskStatus.RUNNING, progress=5, message='Loading analysis...')
                rec = _analyses().get(sim.analysis_id)
                if not rec: raise ValueError(f'Analysis not found: {sim.analysis_id}')
                outs = rec.get('agent_outputs',[])
                if not outs: raise ValueError('No agent outputs in analysis')
                profiles = []
                for i,o in enumerate(outs):
                    pct = 20+int(i/len(outs)*70)
                    TaskManager.update(task.task_id, progress=pct,
                                       message=f"Extracting profile {i+1}/{len(outs)}: {o.get('role_name') or o.get('roleName','?')}")
                    profiles.append({'agent_id':o.get('agent_id'),'agent_name':o.get('agent_name'),
                                     'role':o.get('role'),'role_name':o.get('role_name'),
                                     'signal':o.get('signal','neutral'),'confidence':o.get('confidence',0),
                                     'reasoning':o.get('reasoning',''),'key_factors':o.get('keyFactors',[]),
                                     'butterflies':o.get('butterflies',[]),'node_id':o.get('node_id'),
                                     'error':o.get('_error',False)})
                sim2 = ss.get(sid,'simulation_id')
                sim2.agent_profiles = profiles
                sim2.graph_stats    = rec.get('graph',{}).get('stats')
                sim2.status         = SimStatus.READY
                ss.save(sim2)
                TaskManager.update(task.task_id, status=TaskStatus.COMPLETED, progress=100,
                                   message=f'Prepared {len(profiles)} agent profiles.',
                                   result={'profiles_count':len(profiles)})
            except Exception as e:
                TaskManager.update(task.task_id, status=TaskStatus.FAILED, message=str(e), error=traceback.format_exc())
                s2 = ss.get(sid,'simulation_id')
                if s2: s2.status=SimStatus.FAILED; s2.error=str(e); ss.save(s2)
        threading.Thread(target=bg, daemon=True).start()
        return jsonify({'success':True,'data':{'simulation_id':sid,'task_id':task.task_id,
                        'status':'preparing','already_prepared':False,
                        'message':f'Preparation started. Poll /api/tasks/{task.task_id}'}})
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'traceback':traceback.format_exc()}), 500

@simulation_bp.get('/<sid>/profiles')
def get_profiles(sid):
    sim = _sims().get(sid,'simulation_id')
    if not sim: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
    profiles = sim.agent_profiles
    sig = request.args.get('signal')
    if sig: profiles = [p for p in profiles if p.get('signal')==sig]
    return jsonify({'success':True,'data':profiles,'count':len(profiles)})

@simulation_bp.get('/<sid>/profiles/<agent_id>')
def get_profile(sid, agent_id):
    sim = _sims().get(sid,'simulation_id')
    if not sim: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
    p = next((x for x in sim.agent_profiles if str(x.get('agent_id'))==agent_id), None)
    if not p: return jsonify({'success':False,'error':f'Profile not found: {agent_id}'}), 404
    return jsonify({'success':True,'data':p})

@simulation_bp.get('/<sid>/status')
def get_status(sid):
    sim = _sims().get(sid,'simulation_id')
    if not sim: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
    return jsonify({'success':True,'data':{'simulation_id':sid,'status':sim.status.value,
                    'profiles_count':len(sim.agent_profiles),'interviews_count':len(sim.interviews),
                    'has_synthesis':sim.final_synthesis is not None,'updated_at':sim.updated_at}})

def _interview_one(sim, agent_id, question):
    profile = next((p for p in sim.agent_profiles if str(p.get('agent_id'))==str(agent_id)), None)
    if not profile: return {'success':False,'error':f'Agent profile not found: {agent_id}'}
    agents = [a for a in JsonStore(current_app.config['AF_CONFIG'].AGENTS_FILE, Agent).list() if a.enabled]
    if not agents: return {'success':False,'error':'No enabled agents for interview'}
    ctx = (f"You are {profile.get('role_name','a financial analyst')}.\n"
           f"Your signal: {profile.get('signal','neutral')} @{profile.get('confidence',0)}% confidence.\n"
           f"Your reasoning: {profile.get('reasoning','')}\n"
           f"Key factors: {', '.join(profile.get('key_factors',[]))}\n"
           f"Butterfly chains: {', '.join(profile.get('butterflies',[]))}\n\n"
           f"Answer this directly and concisely:\n{question}")
    try:
        answer = call_llm(agents[0], f"You are {profile.get('role_name','a financial analyst')}. Be direct and concise.", ctx)
        return {'success':True,'agent_id':agent_id,'agent_name':profile.get('agent_name'),
                'role':profile.get('role'),'role_name':profile.get('role_name'),
                'question':question,'answer':answer,'signal':profile.get('signal'),
                'confidence':profile.get('confidence'),
                'timestamp':datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        return {'success':False,'agent_id':agent_id,'error':str(e)}

@simulation_bp.post('/<sid>/interview')
def interview_one(sid):
    try:
        d = request.get_json() or {}
        agent_id = str(d.get('agent_id',''))
        question = (d.get('question') or '').strip()
        if not agent_id: return jsonify({'success':False,'error':'agent_id required'}), 400
        if not question: return jsonify({'success':False,'error':'question required'}), 400
        ss = _sims(); sim = ss.get(sid,'simulation_id')
        if not sim: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
        if not sim.agent_profiles: return jsonify({'success':False,'error':'No profiles. Run /prepare first.'}), 400
        result = _interview_one(sim, agent_id, question)
        sim.interviews.append({'interview_id':f"iv_{len(sim.interviews)+1}",**result})
        ss.save(sim)
        return jsonify({'success':result.get('success',False),'data':result})
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'traceback':traceback.format_exc()}), 500

@simulation_bp.post('/<sid>/interview/batch')
def interview_batch(sid):
    try:
        d = request.get_json() or {}
        items = d.get('interviews',[])
        if not items: return jsonify({'success':False,'error':'interviews list required'}), 400
        ss = _sims(); sim = ss.get(sid,'simulation_id')
        if not sim: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
        if not sim.agent_profiles: return jsonify({'success':False,'error':'No profiles. Run /prepare first.'}), 400
        results = []
        for item in items:
            r = _interview_one(sim, str(item.get('agent_id','')), (item.get('question') or '').strip())
            results.append(r)
            sim.interviews.append({'interview_id':f"iv_{len(sim.interviews)+1}",**r})
        ss.save(sim)
        return jsonify({'success':True,'data':{'count':len(results),'results':results}})
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'traceback':traceback.format_exc()}), 500

@simulation_bp.post('/<sid>/interview/all')
def interview_all(sid):
    try:
        d = request.get_json() or {}
        question = (d.get('question') or '').strip()
        if not question: return jsonify({'success':False,'error':'question required'}), 400
        ss = _sims(); sim = ss.get(sid,'simulation_id')
        if not sim: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
        if not sim.agent_profiles: return jsonify({'success':False,'error':'No profiles. Run /prepare first.'}), 400
        results = []
        for profile in sim.agent_profiles:
            r = _interview_one(sim, str(profile.get('agent_id','')), question)
            results.append(r)
            sim.interviews.append({'interview_id':f"iv_{len(sim.interviews)+1}",**r})
        ss.save(sim)
        return jsonify({'success':True,'data':{'question':question,'count':len(results),'results':results}})
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'traceback':traceback.format_exc()}), 500

@simulation_bp.get('/<sid>/interview/history')
def interview_history(sid):
    sim = _sims().get(sid,'simulation_id')
    if not sim: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
    history = sim.interviews
    aid = request.args.get('agent_id')
    if aid: history = [h for h in history if str(h.get('agent_id'))==aid]
    return jsonify({'success':True,'data':history,'count':len(history)})
