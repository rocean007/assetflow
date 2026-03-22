
import threading
import traceback
from flask import request, jsonify, current_app
from . import analysis_bp
from ..models.agent import AgentManager
from ..models.task import TaskManager, TaskStatus, AnalysisStore
from ..services.orchestrator import run_full_analysis
from ..utils.logger import get_logger

logger = get_logger('assetflow.api.analysis')


def _get_store() -> AnalysisStore:
    cfg = current_app.config.get('AF_CONFIG')
    return AnalysisStore(cfg.ANALYSES_FILE)


def _get_manager() -> AgentManager:
    cfg = current_app.config.get('AF_CONFIG')
    return AgentManager(cfg.AGENTS_FILE)


# ─── RUN ANALYSIS ────────────────────────────────────────────────────────────

@analysis_bp.post('/run')
def run_analysis():
    """
    Start an analysis job asynchronously.

    Request JSON:
        {
            "symbol":   "AAPL",
            "name":     "Apple Inc.",          // optional
            "asset_type": "equity",            // optional
            "av_key":   "YOUR_AV_KEY"          // optional, for better price data
        }

    Returns:
        { "success": true, "data": { "task_id": "...", "message": "..." } }
    """
    try:
        data = request.get_json() or {}
        symbol = (data.get('symbol') or '').strip().upper()
        if not symbol:
            return jsonify({'success': False, 'error': 'symbol is required'}), 400

        agents = _get_manager().list_agents()
        enabled = [a for a in agents if a.enabled]
        if not enabled:
            return jsonify({
                'success': False,
                'error': 'No enabled agents. Go to the Agents tab and add at least one.'
            }), 400

        asset = {
            'symbol':     symbol,
            'name':       data.get('name', symbol),
            'asset_type': data.get('asset_type', 'equity'),
            'av_key':     data.get('av_key', ''),
        }

        task = TaskManager.create(f'Analysis: {symbol}')
        store = _get_store()

        logger.info(f'Starting analysis task {task.id} for {symbol} with {len(enabled)} agents')

        def background():
            run_full_analysis(asset, enabled, task, store)

        thread = threading.Thread(target=background, daemon=True)
        thread.start()

        return jsonify({
            'success': True,
            'data': {
                'task_id': task.id,
                'symbol':  symbol,
                'message': f'Analysis started for {symbol}. Query /api/analysis/task/{task.id} for progress.',
            }
        })

    except Exception as e:
        logger.error(f'run_analysis error: {e}')
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


# ─── TASK STATUS ─────────────────────────────────────────────────────────────

@analysis_bp.get('/task/<task_id>')
def get_task(task_id: str):
    """Query task status and result."""
    task = TaskManager.get(task_id)
    if not task:
        return jsonify({'success': False, 'error': f'Task not found: {task_id}'}), 404
    return jsonify({'success': True, 'data': task.to_dict()})


@analysis_bp.get('/tasks')
def list_tasks():
    """List all active tasks."""
    tasks = TaskManager.list_tasks()
    return jsonify({'success': True, 'data': [t.to_dict() for t in tasks], 'count': len(tasks)})


# ─── HISTORY ─────────────────────────────────────────────────────────────────

@analysis_bp.get('/history')
def get_history():
    """List past analyses (lightweight summaries)."""
    limit = request.args.get('limit', 50, type=int)
    summaries = _get_store().list(limit=limit)
    return jsonify({'success': True, 'data': summaries, 'count': len(summaries)})


@analysis_bp.get('/<analysis_id>')
def get_analysis(analysis_id: str):
    """Get full analysis by ID."""
    record = _get_store().get(analysis_id)
    if not record:
        return jsonify({'success': False, 'error': f'Analysis not found: {analysis_id}'}), 404
    return jsonify({'success': True, 'data': record})
