"""
Orchestrator — the three-phase analysis pipeline.
Matches MiroFish's build_task threading pattern.

Phase 1: All specialist agents run concurrently (ThreadPoolExecutor)
         Each writes to SharedGraph independently
Phase 2: Each synthesizer agent reads the complete graph
Phase 3: Optional super-synthesizer reconciles synthesizer verdicts
"""
import time
import uuid
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, Optional

from ..models.agent import Agent
from ..models.task import Task, TaskStatus, TaskManager, Analysis, AnalysisStore
from ..services.data_collector import build_world_state, serialize_world_state
from ..services.graph_builder import SharedGraph
from ..services.agent_runner import run_agent_write_to_graph, run_graph_synthesizer, run_super_synthesizer
from ..utils.logger import get_logger

logger = get_logger('assetflow.services.orchestrator')

MAX_CONCURRENT = 5


def _emit(task: Task, status: TaskStatus = None, progress: int = None, message: str = None,
          result: dict = None, error: str = None):
    """Update task and broadcast via SocketIO."""
    TaskManager.update(task.id, status=status, progress=progress,
                       message=message, result=result, error=error)


def run_full_analysis(
    asset: dict,
    agents: list[Agent],
    task: Task,
    analysis_store: AnalysisStore,
):
    """
    Full analysis pipeline. Runs in background thread.
    Progress is broadcast via SocketIO task updates.
    """
    t0 = time.time()
    analysis_id = str(uuid.uuid4())

    try:
        enabled = [a for a in agents if a.enabled]
        if not enabled:
            raise ValueError('No enabled agents. Add at least one in the Agents tab.')

        super_agents = [a for a in enabled if a.role == 'super_synthesizer']
        synth_agents  = [a for a in enabled if a.role == 'synthesizer']
        spec_agents   = [a for a in enabled if a.role not in ('synthesizer', 'super_synthesizer')]

        # Fallbacks
        phase1_agents = spec_agents or enabled
        synth_pool    = synth_agents or [phase1_agents[0]]
        super_agent   = super_agents[0] if super_agents else None

        total_steps = 4 + len(phase1_agents) + len(synth_pool) + (1 if super_agent else 0)
        step = [1]

        def progress(pct: int, msg: str):
            _emit(task, status=TaskStatus.RUNNING, progress=pct, message=msg)
            logger.info(f'[{task.id}] {pct}% — {msg}')

        # ── FETCH ALL WORLD DATA ──────────────────────────────────────
        progress(5, 'Fetching all world data (price, news, weather, social, commodities...).')
        world_state = None
        try:
            world_state = build_world_state(asset['symbol'], asset.get('av_key'))
        except Exception as e:
            logger.warning(f'World state partial failure: {e}')

        progress(20, f"Data ready ({world_state.get('fetch_elapsed_s','?')}s). "
                     f"Weather alerts: {sum(1 for w in (world_state or {}).get('weather',[]) if w.get('significant'))}. "
                     f"Social posts: {(world_state or {}).get('social',{}).get('stats',{}).get('total',0)}.")

        # ── PHASE 1: All agents write to graph ────────────────────────
        graph = SharedGraph(asset)
        agent_outputs = []
        progress(22, f'[Phase 1] Starting {len(phase1_agents)} specialist agents...')

        # Pre-build per-role context strings (avoid serializing for each agent)
        context_cache: dict[str, str] = {}
        def get_context(role: str) -> str:
            if role not in context_cache:
                context_cache[role] = serialize_world_state(world_state, role=role, compact=False)
            return context_cache[role]

        def run_one_agent(agent: Agent) -> dict:
            from ..services.agent_runner import assign_role
            role = assign_role(agent)
            ctx = get_context(role)
            return run_agent_write_to_graph(agent, ctx, graph)

        with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as ex:
            future_map = {ex.submit(run_one_agent, agent): i for i, agent in enumerate(phase1_agents)}
            done_count = 0
            for fut in as_completed(future_map):
                idx = future_map[fut]
                agent = phase1_agents[idx]
                done_count += 1
                pct = 22 + int((done_count / len(phase1_agents)) * 38)
                try:
                    result = fut.result()
                    agent_outputs.append(result)
                    progress(pct, f"[Phase 1] {agent.name}: {result['signal']} @ {result['confidence']}% ({done_count}/{len(phase1_agents)})")
                except Exception as e:
                    logger.error(f'Agent {agent.name} failed: {e}')
                    stub = {'role': 'specialist', 'role_name': agent.name, 'agent_id': agent.id,
                            'agent_name': agent.name, 'signal': 'neutral', 'confidence': 0,
                            'reasoning': f'Failed: {str(e)[:200]}', 'keyFactors': [], 'butterflies': [],
                            'edgeClaims': [], '_error': True}
                    agent_outputs.append(stub)
                    graph.add_signal(type('', (), {'agent_id': agent.id, 'agent_name': agent.name,
                                                    'role': 'specialist', 'role_name': agent.name,
                                                    'signal': 'neutral', 'confidence': 0,
                                                    'reasoning': str(e), 'key_factors': [],
                                                    'butterflies': []})())

        flow_graph = graph.to_flow_format()
        s = flow_graph['stats']
        progress(62, f"[Graph] {s['total_nodes']} nodes | {s['total_edges']} edges | "
                     f"{s['bull']}B / {s['bear']}Be / {s['neut']}N")

        # ── PHASE 2: Synthesizers read the graph ──────────────────────
        synth_results = []
        for i, synth in enumerate(synth_pool):
            pct = 64 + int((i / len(synth_pool)) * 25)
            progress(pct, f"[Phase 2] Synthesizer '{synth.name}' reading complete graph...")
            try:
                result = run_graph_synthesizer(synth, graph)
                synth_results.append(result)
            except Exception as e:
                logger.error(f'Synthesizer {synth.name} failed: {e}')
                # Math fallback
                t = s['total_agents'] or 1
                synth_results.append({
                    'agent_id': synth.id, 'agent_name': synth.name,
                    'upProbability': round(s['bull']/t*100), 'downProbability': round(s['bear']/t*100),
                    'neutralProbability': round(s['neut']/t*100),
                    'primaryDirection': 'up' if s['bull']>s['bear'] else 'down' if s['bear']>s['bull'] else 'sideways',
                    'confidence': 30, 'bullCase': f"{s['bull']}/{t} bullish.", 'bearCase': f"{s['bear']}/{t} bearish.",
                    'keyRisks': ['Synthesizer failed'], 'topCatalysts': [], 'topButterflyEffects': [],
                    'socialAssessment':'N/A','worldStateHighlights':'N/A','signalConflicts':'N/A',
                    'technicalPicture':'N/A','fundamentalPicture':'N/A',
                    'summary': f'Fallback: {s["bull"]}B/{s["bear"]}Be/{s["neut"]}N from {t} agents.',
                    '_fallback': True,
                })

        # ── PHASE 3: Super synthesizer (optional) ─────────────────────
        if super_agent and len(synth_results) > 0:
            progress(90, f"[Phase 3] Super synthesizer '{super_agent.name}' reconciling {len(synth_results)} verdicts...")
            try:
                final_synthesis = run_super_synthesizer(super_agent, synth_results)
            except Exception as e:
                logger.error(f'Super synthesizer failed: {e}')
                final_synthesis = synth_results[0]
        elif len(synth_results) > 1:
            # Average probabilities
            up = round(sum(r['upProbability']   for r in synth_results) / len(synth_results))
            dn = round(sum(r['downProbability'] for r in synth_results) / len(synth_results))
            final_synthesis = {**synth_results[0], 'upProbability': up, 'downProbability': dn,
                               'neutralProbability': 100-up-dn, '_merged': len(synth_results)}
        else:
            final_synthesis = synth_results[0] if synth_results else {}

        # ── Build data snapshot for UI ─────────────────────────────────
        ws = world_state or {}
        data_snapshot = {
            'fetched_at':     ws.get('fetched_at'),
            'weather_alerts': [{'region': w['name'], 'importance': w['importance'], 'alerts': w['alerts']}
                               for w in ws.get('weather', []) if w.get('significant')],
            'commodities':    ws.get('commodities', [])[:12],
            'shipping_bdi':   next((c for c in ws.get('commodities', []) if c['symbol'] == 'BDI'), None),
            'options':        ws.get('options'),
            'analyst':        ws.get('analyst'),
            'earnings':       ws.get('earnings'),
        }

        # ── Persist ────────────────────────────────────────────────────
        duration_ms = int((time.time() - t0) * 1000)
        analysis = Analysis(
            id=analysis_id, asset=asset, price=ws.get('price'),
            agent_outputs=agent_outputs, synthesizer_outputs=synth_results,
            synthesis=final_synthesis, graph=flow_graph,
            data_snapshot=data_snapshot,
            stats={
                'phase1_agents':    len(phase1_agents),
                'synth_agents':     len(synth_pool),
                'super_synth_used': bool(super_agent),
                'total_nodes':      s['total_nodes'],
                'total_edges':      s['total_edges'],
                'bull': s['bull'], 'bear': s['bear'], 'neut': s['neut'],
                'social_total':    ws.get('social',{}).get('stats',{}).get('total',0),
                'social_suspicious': ws.get('social',{}).get('stats',{}).get('suspicious',0),
                'weather_alerts':  len(data_snapshot['weather_alerts']),
                'data_sources':    '25+ categories',
            },
            duration_ms=duration_ms,
        )
        analysis_store.save(analysis)

        result_summary = {
            'analysis_id': analysis_id,
            'symbol': asset['symbol'],
            'direction': final_synthesis.get('primaryDirection'),
            'up_pct': final_synthesis.get('upProbability'),
            'down_pct': final_synthesis.get('downProbability'),
            'confidence': final_synthesis.get('confidence'),
        }

        _emit(task, status=TaskStatus.COMPLETED, progress=100,
              message='Analysis complete.', result={**result_summary, 'analysis': analysis.to_dict()})
        logger.info(f'Analysis {analysis_id} complete in {duration_ms}ms')

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f'Analysis failed: {e}\n{tb}')
        _emit(task, status=TaskStatus.FAILED, progress=0,
              message=f'Analysis failed: {str(e)}', error=tb)
