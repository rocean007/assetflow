"""
Orchestrator — 3-phase pipeline running in background thread.
Phase 1: all specialist agents write to SharedGraph concurrently
Phase 2: synthesizer(s) read complete graph -> verdict
Phase 3: optional super-synthesizer reconciles verdicts
"""
import time, uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from .data_collector import build_world_state, serialize
from .graph_builder import SharedGraph
from .agent_runner import run_agent, run_synthesizer, run_super_synthesizer
from .relevance import get_relevance_context
from ..models.task import TaskManager, TaskStatus
from ..utils.logger import get_logger
log = get_logger('assetflow.orchestrator')

MAX_W = 5

def _emit(task, status=None, progress=None, message=None, result=None, error=None):
    kw = {}
    if status   is not None: kw['status']   = status
    if progress is not None: kw['progress'] = progress
    if message  is not None: kw['message']  = message
    if result   is not None: kw['result']   = result
    if error    is not None: kw['error']    = error
    TaskManager.update(task.task_id, **kw)

def run_pipeline(asset: dict, agents: list, task, store, on_complete=None):
    t0 = time.time()
    analysis_id = f"an_{uuid.uuid4().hex[:10]}"
    try:
        enabled = [a for a in agents if a.enabled]
        if not enabled:
            raise ValueError("No enabled agents.")

        super_agents = [a for a in enabled if a.role == 'super_synthesizer']
        synth_agents  = [a for a in enabled if a.role == 'synthesizer']
        spec_agents   = [a for a in enabled if a.role not in ('synthesizer','super_synthesizer')]
        p1 = spec_agents or enabled
        synths = synth_agents or [p1[0]]
        super_a = super_agents[0] if super_agents else None

        def prog(pct, msg):
            _emit(task, status=TaskStatus.RUNNING, progress=pct, message=msg)
            log.info(f"[{task.task_id}] {pct}% - {msg}")

        # PHASE 0: FETCH ALL WORLD DATA
        prog(5, 'Fetching world data: price, news, weather, social, commodities...')
        extra_texts = asset.pop('extra_texts', [])
        ws = None
        try:
            ws = build_world_state(asset['symbol'], asset.get('av_key'), extra_texts)
        except Exception as e:
            log.warning(f'World state partial failure: {e}')

        weather_alerts = sum(1 for w in (ws or {}).get('weather',[]) if w.get('significant'))
        social_total   = (ws or {}).get('social',{}).get('stats',{}).get('total',0)
        prog(20, f"Data ready | {weather_alerts} weather alerts | {social_total} social posts")

        rel_ctx = get_relevance_context(asset['symbol'], asset.get('asset_type','equity'), extra_texts)
        ctx_cache = {}
        SPECIALIST_ROLES = ('macro','sentiment','supply_chain','technical','geopolitical','sector','social_sentiment')

        def ctx(role):
            if role not in ctx_cache:
                base = serialize(ws, role=role, compact=False)
                ctx_cache[role] = f"{rel_ctx}\n\n{base}"
            return ctx_cache[role]

        # PHASE 1: ALL AGENTS WRITE TO GRAPH
        graph = SharedGraph(asset)
        agent_outputs = []
        prog(22, f'[Phase 1] Starting {len(p1)} specialist agents...')

        with ThreadPoolExecutor(max_workers=MAX_W) as ex:
            fut_map = {ex.submit(run_agent, ag,
                                 ctx(ag.role if ag.role in SPECIALIST_ROLES else 'macro'),
                                 graph): i
                       for i, ag in enumerate(p1)}
            done = 0
            for fut in as_completed(fut_map):
                ag = p1[fut_map[fut]]; done += 1
                pct = 22 + int(done/len(p1)*40)
                try:
                    out = fut.result(); agent_outputs.append(out)
                    prog(pct, f"[Phase 1] {ag.name}: {out['signal']} @{out['confidence']}% ({done}/{len(p1)})")
                except Exception as e:
                    log.error(f"Agent {ag.name} failed: {e}")
                    agent_outputs.append({
                        'role':'specialist','role_name':ag.name,'agent_id':ag.agent_id,
                        'agent_name':ag.name,'signal':'neutral','confidence':0,
                        'reasoning':str(e)[:200],'keyFactors':[],'butterflies':[],'edgeClaims':[],'_error':True})

        flow = graph.to_flow(); st = flow['stats']
        prog(63, f"[Graph] {st['total_nodes']} nodes | {st['total_edges']} edges | {st['bull']}B/{st['bear']}Be/{st['neut']}N")

        # PHASE 2: SYNTHESIZERS READ GRAPH
        synth_results = []
        for i, synth in enumerate(synths):
            pct = 65 + int(i/len(synths)*22)
            prog(pct, f"[Phase 2] {synth.name} reading complete graph...")
            try:
                synth_results.append(run_synthesizer(synth, graph))
            except Exception as e:
                log.error(f"Synthesizer {synth.name} failed: {e}")
                t = st['total_agents'] or 1
                synth_results.append({
                    'agent_id':synth.agent_id,'agent_name':synth.name,
                    'upProbability':round(st['bull']/t*100),'downProbability':round(st['bear']/t*100),
                    'neutralProbability':round(st['neut']/t*100),
                    'primaryDirection':'up' if st['bull']>st['bear'] else 'down' if st['bear']>st['bull'] else 'sideways',
                    'confidence':30,'bullCase':'','bearCase':'','keyRisks':['Synth failed'],
                    'topCatalysts':[],'topButterflyEffects':[],'socialAssessment':'N/A',
                    'worldStateHighlights':'N/A','signalConflicts':'N/A',
                    'technicalPicture':'N/A','fundamentalPicture':'N/A',
                    'summary':f"Fallback: {st['bull']}B/{st['bear']}Be/{st['neut']}N",'_fallback':True})

        # PHASE 3: SUPER SYNTHESIZER
        if super_a and synth_results:
            prog(88, f"[Phase 3] {super_a.name} reconciling {len(synth_results)} verdicts...")
            try: final = run_super_synthesizer(super_a, synth_results)
            except: final = synth_results[0]
        elif len(synth_results) > 1:
            up = round(sum(r['upProbability']   for r in synth_results)/len(synth_results))
            dn = round(sum(r['downProbability'] for r in synth_results)/len(synth_results))
            final = {**synth_results[0],'upProbability':up,'downProbability':dn,
                     'neutralProbability':100-up-dn,'_merged':len(synth_results)}
        else:
            final = synth_results[0] if synth_results else {}

        ws_ = ws or {}
        snapshot = {
            'fetched_at':     ws_.get('fetched_at'),
            'weather_alerts': [{'region':w['name'],'importance':w['importance'],'alerts':w['alerts']}
                                for w in ws_.get('weather',[]) if w.get('significant')],
            'commodities':    ws_.get('commodities',[])[:14],
            'options':        ws_.get('options'),
            'analyst':        ws_.get('analyst'),
            'earnings':       ws_.get('earnings'),
            'social_stats':   ws_.get('social',{}).get('stats'),
        }
        duration_ms = int((time.time()-t0)*1000)

        record = {
            'id': analysis_id, 'asset': asset, 'price': ws_.get('price'),
            'agent_outputs': agent_outputs, 'synthesizer_outputs': synth_results,
            'synthesis': final, 'graph': flow, 'data_snapshot': snapshot,
            'stats': {
                'phase1_agents': len(p1), 'synth_agents': len(synths),
                'super_synth': bool(super_a), 'total_nodes': st['total_nodes'],
                'total_edges': st['total_edges'], 'bull': st['bull'],
                'bear': st['bear'], 'neut': st['neut'],
                'social_total': social_total, 'weather_alerts': weather_alerts,
            },
            'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'duration_ms': duration_ms,
        }
        store.save_raw(analysis_id, record)

        _emit(task, status=TaskStatus.COMPLETED, progress=100,
              message='Analysis complete.',
              result={'analysis_id': analysis_id, 'symbol': asset['symbol'],
                      'direction': final.get('primaryDirection'),
                      'up': final.get('upProbability'),
                      'down': final.get('downProbability'),
                      'confidence': final.get('confidence'),
                      'analysis': record})

        if on_complete:
            try: on_complete(analysis_id, record)
            except Exception as e: log.warning(f'on_complete error: {e}')

        log.info(f"Pipeline done: {analysis_id} in {duration_ms}ms")

    except Exception as e:
        import traceback as tb_mod
        tb = tb_mod.format_exc()
        log.error(f"Pipeline failed: {e}\n{tb}")
        _emit(task, status=TaskStatus.FAILED, progress=0,
              message=f'Failed: {str(e)}', error=tb)
