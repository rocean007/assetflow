from flask import jsonify
from . import tasks_bp
from ..models.task import TaskManager

@tasks_bp.get('/')
def list_tasks():
    return jsonify({'success':True,'data':[t.to_dict() for t in TaskManager.list_all()]})

@tasks_bp.get('/<tid>')
def get_task(tid):
    t = TaskManager.get(tid)
    if not t: return jsonify({'success':False,'error':f'Not found: {tid}'}), 404
    return jsonify({'success':True,'data':t.to_dict()})
