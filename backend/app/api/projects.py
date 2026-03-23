import os, traceback
from flask import request, jsonify, current_app
from werkzeug.utils import secure_filename
from . import projects_bp
from ..models.project import Project, ProjectStatus
from ..models.base import JsonStore
from ..services.file_parser import extract_text
from ..utils.logger import get_logger
log = get_logger('assetflow.api.projects')

ALLOWED = {'.pdf','.docx','.txt','.md','.csv','.json','.doc'}

def _store():
    return JsonStore(current_app.config['AF_CONFIG'].PROJECTS_FILE, Project)

@projects_bp.get('/')
def list_projects():
    limit = request.args.get('limit', 50, type=int)
    projects = _store().list(limit)
    return jsonify({'success':True,'data':[p.to_dict() for p in projects],'count':len(projects)})

@projects_bp.post('/')
def create_project():
    try:
        d = request.get_json() or {}
        symbol = (d.get('symbol') or '').strip().upper()
        if not symbol: return jsonify({'success':False,'error':'symbol required'}), 400
        p = Project(name=d.get('name',symbol), symbol=symbol, asset_name=d.get('asset_name',symbol),
                    asset_type=d.get('asset_type','equity'), av_key=d.get('av_key',''),
                    description=d.get('description',''))
        _store().save(p)
        log.info(f'Created project {p.project_id} for {symbol}')
        return jsonify({'success':True,'data':p.to_dict()}), 201
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'traceback':traceback.format_exc()}), 500

@projects_bp.get('/<pid>')
def get_project(pid):
    p = _store().get(pid, 'project_id')
    if not p: return jsonify({'success':False,'error':f'Not found: {pid}'}), 404
    return jsonify({'success':True,'data':p.to_dict()})

@projects_bp.put('/<pid>')
def update_project(pid):
    try:
        s = _store(); p = s.get(pid, 'project_id')
        if not p: return jsonify({'success':False,'error':f'Not found: {pid}'}), 404
        d = request.get_json() or {}
        for f in ('name','asset_name','asset_type','av_key','description'):
            if f in d: setattr(p, f, d[f])
        p.touch(); s.save(p)
        return jsonify({'success':True,'data':p.to_dict()})
    except Exception as e:
        return jsonify({'success':False,'error':str(e)}), 500

@projects_bp.delete('/<pid>')
def delete_project(pid):
    ok = _store().delete(pid, 'project_id')
    if not ok: return jsonify({'success':False,'error':f'Not found: {pid}'}), 404
    return jsonify({'success':True,'message':f'Deleted {pid}'})

@projects_bp.post('/<pid>/reset')
def reset_project(pid):
    s = _store(); p = s.get(pid, 'project_id')
    if not p: return jsonify({'success':False,'error':f'Not found: {pid}'}), 404
    p.status=ProjectStatus.CREATED; p.analysis_id=None; p.simulation_id=None
    p.error=None; p.agent_count=0; p.node_count=0; p.edge_count=0
    p.touch(); s.save(p)
    return jsonify({'success':True,'data':p.to_dict()})

@projects_bp.post('/<pid>/upload')
def upload_file(pid):
    """Upload supplementary research file to a project."""
    try:
        s = _store(); p = s.get(pid, 'project_id')
        if not p: return jsonify({'success':False,'error':f'Not found: {pid}'}), 404
        if 'file' not in request.files:
            return jsonify({'success':False,'error':'No file in request'}), 400
        file = request.files['file']
        if not file.filename: return jsonify({'success':False,'error':'Empty filename'}), 400
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED:
            return jsonify({'success':False,'error':f'File type not allowed: {ext}. Allowed: {sorted(ALLOWED)}'}), 400
        cfg = current_app.config['AF_CONFIG']
        upload_dir = cfg.UPLOADS_DIR / pid
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_name = secure_filename(file.filename)
        dest = upload_dir / safe_name
        file.save(str(dest))
        text_preview = extract_text(str(dest))[:300]
        info = {'filename':file.filename,'stored':safe_name,'size':dest.stat().st_size,
                'path':str(dest),'text_preview':text_preview}
        p.files.append(info); p.touch(); s.save(p)
        log.info(f'Uploaded {file.filename} to project {pid}')
        return jsonify({'success':True,'data':info})
    except Exception as e:
        return jsonify({'success':False,'error':str(e),'traceback':traceback.format_exc()}), 500

@projects_bp.delete('/<pid>/files/<filename>')
def delete_file(pid, filename):
    try:
        s = _store(); p = s.get(pid, 'project_id')
        if not p: return jsonify({'success':False,'error':f'Not found: {pid}'}), 404
        cfg = current_app.config['AF_CONFIG']
        dest = cfg.UPLOADS_DIR / pid / secure_filename(filename)
        if dest.exists(): dest.unlink()
        p.files = [f for f in p.files if f.get('stored') != secure_filename(filename)]
        p.touch(); s.save(p)
        return jsonify({'success':True,'message':f'Deleted {filename}'})
    except Exception as e:
        return jsonify({'success':False,'error':str(e)}), 500
