import json, time, threading, traceback
from pathlib import Path
from flask import request, jsonify, current_app, Response, stream_with_context
from werkzeug.utils import secure_filename
from . import sessions_bp
from ..models.session import Session, SessionStore, SessionStatus
from ..services.agent_store import AgentStore
from ..services.file_parser import extract

ALLOWED = {'.pdf','.docx','.txt','.md','.csv','.json','.doc'}

def _ss():
    cfg = current_app.config['AF_CFG']
    return SessionStore(cfg.SESSIONS_FILE)

def _as():
    cfg = current_app.config['AF_CFG']
    return AgentStore(cfg.AGENTS_FILE)

def _uploads(sid):
    cfg = current_app.config['AF_CFG']
    p = cfg.UPLOADS_DIR / sid
    p.mkdir(parents=True, exist_ok=True)
    return p

# LIST
@sessions_bp.get('/')
def list_sessions():
    limit = request.args.get('limit',50,type=int)
    return jsonify({'success':True,'data':[s.to_summary() for s in _ss().list(limit)]})

# CREATE + RUN (single endpoint, kicks off full pipeline immediately)
@sessions_bp.post('/')
def create_and_run():
    """
    Create a session and immediately start the analysis pipeline.
    Returns session_id immediately. Frontend polls /api/sessions/<id>/stream (SSE)
    or /api/sessions/<id> for status.
    """
    try:
        d = request.get_json() or {}
        symbol = (d.get('symbol') or '').strip().upper()
        if not symbol: return jsonify({'success':False,'error':'symbol required'}), 400

        agents = [a for a in _as().list() if a.enabled]
        if not agents: return jsonify({'success':False,'error':'No enabled agents. Add agents in the Agents tab.'}), 400

        sess = Session(
            name  = d.get('name', symbol),
            symbol= symbol,
            asset_type = d.get('asset_type','equity'),
            description= d.get('description',''),
            av_key     = d.get('av_key',''),
        )
        store = _ss()
        store.save(sess)

        def bg():
            from ..services.pipeline import run as run_pipeline
            extra_texts = []
            for fi in sess.files:
                txt = extract(fi.get('path',''))
                if txt.strip():
                    extra_texts.append(f"=== {fi['filename']} ===\n{txt}")
            run_pipeline(sess, agents, store, extra_texts)

        threading.Thread(target=bg, daemon=True).start()
        return jsonify({'success':True,'data':{'session_id':sess.session_id,
                        'message':f'Analysis started for {symbol}. Stream progress at /api/sessions/{sess.session_id}/stream'}})
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'tb':traceback.format_exc()}), 500

# GET (poll for status)
@sessions_bp.get('/<sid>')
def get_session(sid):
    s = _ss().get(sid)
    if not s: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
    return jsonify({'success':True,'data':s.to_dict()})

# DELETE
@sessions_bp.delete('/<sid>')
def delete_session(sid):
    ok = _ss().delete(sid)
    if not ok: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
    return jsonify({'success':True})

# SSE STREAM - real-time progress (no WebSocket needed, pure HTTP)
@sessions_bp.get('/<sid>/stream')
def stream(sid):
    """Server-Sent Events stream for real-time progress updates."""
    def generate():
        last_seen = None
        timeout = 300  # 5 minutes max
        t0 = time.time()
        while time.time() - t0 < timeout:
            s = _ss().get(sid)
            if not s:
                yield f'data: {json.dumps({"error":"session not found"})}\n\n'
                break
            state = s.to_summary()
            if state != last_seen:
                last_seen = state
                yield f'data: {json.dumps(state)}\n\n'
            if s.status in (SessionStatus.COMPLETED, SessionStatus.FAILED):
                # Send full data on completion
                yield f'data: {json.dumps({"done":True,"full":s.to_dict()})}\n\n'
                break
            time.sleep(1.5)
    return Response(stream_with_context(generate()),
                    mimetype='text/event-stream',
                    headers={'Cache-Control':'no-cache','X-Accel-Buffering':'no',
                             'Access-Control-Allow-Origin':'*'})

# UPLOAD FILE
@sessions_bp.post('/<sid>/upload')
def upload(sid):
    try:
        store = _ss(); sess = store.get(sid)
        if not sess: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
        if 'file' not in request.files: return jsonify({'success':False,'error':'No file'}), 400
        file = request.files['file']
        if not file.filename: return jsonify({'success':False,'error':'Empty filename'}), 400
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED:
            return jsonify({'success':False,'error':f'Not allowed: {ext}'}), 400
        safe = secure_filename(file.filename)
        dest = _uploads(sid) / safe
        file.save(str(dest))
        info = {'filename':file.filename,'stored':safe,'size':dest.stat().st_size,'path':str(dest)}
        sess.files.append(info); store.save(sess)
        return jsonify({'success':True,'data':info})
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'tb':traceback.format_exc()}), 500

# INTERVIEW AGENT
@sessions_bp.post('/<sid>/interview')
def interview(sid):
    try:
        d = request.get_json() or {}
        question = (d.get('question') or '').strip()
        agent_role = d.get('role','')
        if not question: return jsonify({'success':False,'error':'question required'}), 400
        store = _ss(); sess = store.get(sid)
        if not sess: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
        if not sess.agent_outputs: return jsonify({'success':False,'error':'No agent outputs yet. Run analysis first.'}), 400
        # Find the target agent output
        outs = sess.agent_outputs
        if agent_role:
            target = next((o for o in outs if o.get('role')==agent_role), None) or outs[0]
        else:
            target = outs[0]
        # Use first available enabled agent for the LLM call
        agents = [a for a in AgentStore(current_app.config['AF_CFG'].AGENTS_FILE).list() if a.enabled]
        if not agents: return jsonify({'success':False,'error':'No enabled agents'}), 400
        from ..services.llm import call_llm
        ctx = (f"You are {target.get('role_name','a financial analyst')}.\n"
               f"Your signal on {sess.symbol}: {target.get('signal','neutral')} at {target.get('confidence',0)}% confidence.\n"
               f"Your reasoning: {target.get('reasoning','')}\n"
               f"Key factors: {', '.join(target.get('factors',[]))}\n"
               f"Butterfly chains: {', '.join(target.get('butterflies',[]))}\n\n"
               f"Answer this question based on your analysis:\n{question}")
        answer = call_llm(agents[0], f"You are {target.get('role_name','a financial analyst')}. Be direct and concise.", ctx)
        iv = {'role':target.get('role'),'role_name':target.get('role_name'),'question':question,
              'answer':answer,'ts':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
        sess.interviews.append(iv); store.save(sess)
        return jsonify({'success':True,'data':iv})
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'tb':traceback.format_exc()}), 500

# INTERVIEW ALL AGENTS with same question
@sessions_bp.post('/<sid>/interview/all')
def interview_all(sid):
    try:
        d = request.get_json() or {}
        question = (d.get('question') or '').strip()
        if not question: return jsonify({'success':False,'error':'question required'}), 400
        store = _ss(); sess = store.get(sid)
        if not sess: return jsonify({'success':False,'error':f'Not found: {sid}'}), 404
        if not sess.agent_outputs: return jsonify({'success':False,'error':'No agent outputs yet.'}), 400
        agents = [a for a in AgentStore(current_app.config['AF_CFG'].AGENTS_FILE).list() if a.enabled]
        if not agents: return jsonify({'success':False,'error':'No enabled agents'}), 400
        from ..services.llm import call_llm
        results = []
        for out in sess.agent_outputs:
            ctx = (f"You are {out.get('role_name','a financial analyst')}.\n"
                   f"Signal: {out.get('signal','neutral')} @{out.get('confidence',0)}%\n"
                   f"Reasoning: {out.get('reasoning','')}\n"
                   f"Factors: {', '.join(out.get('factors',[]))}\n\n"
                   f"Answer: {question}")
            try:
                ans = call_llm(agents[0], f"You are {out.get('role_name','analyst')}. Be concise.", ctx)
                iv = {'role':out.get('role'),'role_name':out.get('role_name'),'question':question,
                      'answer':ans,'ts':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
                sess.interviews.append(iv); results.append(iv)
            except Exception as e:
                results.append({'role':out.get('role'),'error':str(e)})
        store.save(sess)
        return jsonify({'success':True,'data':{'count':len(results),'results':results}})
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'tb':traceback.format_exc()}), 500
