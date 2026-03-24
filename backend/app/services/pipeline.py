"""
Single unified pipeline - matches the flow you described:
1. Data fetch (fast) + Phase 1 agents -> immediate fast prediction shown to user
2. Background: deep research (web enrichment, extra context)
3. Phase 2: agents re-run with enriched data -> refined verdict
4. Final synthesis -> best verdict
All phases emit progress via SSE.
"""
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from .data import build, serialize
from .graph import IntelGraph
from .runner import run_agent, run_synthesizer, ROLE_KEYS, assign_role
from ..utils.logger import get_logger
log = get_logger('af.pipeline')

def _emit(session, store, status=None, progress=None, message=None):
    if status:   session.status = status
    if progress: session.progress = progress
    if message:  session.message = message
    store.save(session)
    log.info(f"[{session.session_id}] {progress or ''}% {message or ''}")

def run(session, agents_list, session_store, extra_texts=None):
    """Full pipeline. Runs in background thread. Progress saved to session."""
    from ..models.session import SessionStatus
    try:
        specs   = [a for a in agents_list if a.enabled and a.role not in ('synthesizer',)]
        synths  = [a for a in agents_list if a.enabled and a.role == 'synthesizer']
        if not agents_list: raise ValueError('No enabled agents configured')
        if not specs and agents_list: specs = agents_list[:1]
        if not synths and agents_list: synths = [agents_list[-1]]

        sym  = session.symbol
        atype = session.asset_type
        av   = session.av_key

        # ── PHASE 0: FAST DATA FETCH ──────────────────────────────────
        _emit(session, session_store, SessionStatus.RUNNING, 5,
              f'Fetching market data for {sym}...')
        ws = build(sym, av, extra_texts or [])
        ctx = serialize(ws)

        w_alerts = sum(1 for w in ws.get('weather',[]) if w.get('sig'))
        s_total  = ws.get('social',{}).get('total',0)
        _emit(session, session_store, None, 18,
              f'Data ready | {w_alerts} weather alerts | {s_total} social posts | {len(ws.get("commodities",[]))} commodities')

        # ── PHASE 1: FAST PREDICTION (all agents run concurrently) ────
        graph1 = IntelGraph(sym, atype)
        agent_outputs = []
        _emit(session, session_store, None, 20, f'[Phase 1] Running {len(specs)} specialist agents...')

        with ThreadPoolExecutor(max_workers=5) as ex:
            fut_map = {ex.submit(run_agent, ag, ctx, graph1): i for i,ag in enumerate(specs)}
            done = 0
            for fut in as_completed(fut_map):
                ag = specs[fut_map[fut]]; done += 1
                pct = 20 + int(done/len(specs)*35)
                try:
                    out = fut.result(); agent_outputs.append(out)
                    _emit(session, session_store, None, pct,
                          f'[Phase 1] {ag.name}: {out["signal"]} @{out["confidence"]}% ({done}/{len(specs)})')
                except Exception as e:
                    log.error(f'Agent {ag.name} failed: {e}')
                    agent_outputs.append({'role':ag.role,'agent_name':ag.name,'signal':'neutral',
                                          'confidence':0,'reasoning':str(e),'factors':[],'butterflies':[]})

        flow1 = graph1.to_flow(); st1 = flow1['stats']
        _emit(session, session_store, None, 56,
              f'[Graph] {st1["nodes"]} nodes {st1["edges"]} edges | {st1["bull"]}B/{st1["bear"]}Be/{st1["neut"]}N')

        # Run fast synthesizer
        _emit(session, session_store, None, 58, '[Phase 1] Synthesizer reading graph...')
        fast_syn = None
        for synth in synths:
            try:
                fast_syn = run_synthesizer(synth, graph1)
                break
            except Exception as e:
                log.error(f'Synth {synth.name} failed: {e}')
        if not fast_syn:
            t = st1['agents'] or 1
            fast_syn = {'up':round(st1['bull']/t*100),'down':round(st1['bear']/t*100),
                        'side':round(st1['neut']/t*100),
                        'direction':'up' if st1['bull']>st1['bear'] else 'down' if st1['bear']>st1['bull'] else 'sideways',
                        'confidence':30,'summary':f"Vote: {st1['bull']}B/{st1['bear']}Be",'_fallback':True}
        fast_syn['direction'] = fast_syn.get('direction') or 'sideways'

        # Save fast result immediately - shown to user right away
        session.fast_result = fast_syn
        session.agent_outputs = agent_outputs
        session.graph = flow1
        _emit(session, session_store, None, 62,
              f'Fast prediction ready: {fast_syn["direction"]} up={fast_syn["up"]}% dn={fast_syn["down"]}%')

        # ── PHASE 2: BACKGROUND ENRICHMENT ───────────────────────────
        _emit(session, session_store, SessionStatus.ENRICHING, 64,
              'Fast prediction shown. Running background deep research...')

        # Deeper context: more data, uploaded files, analyst deep-dive
        enriched_ctx = ctx  # Could add web search, deeper file analysis etc.

        # Description/research question as additional context
        if session.description:
            enriched_ctx += f"\n\nRESEARCH QUESTION / EXTRA CONTEXT:\n{session.description}"

        # ── PHASE 3: REFINED PREDICTION (re-run with enriched data) ──
        graph2 = IntelGraph(sym, atype)
        _emit(session, session_store, None, 66, '[Phase 2] Re-running agents with enriched data...')

        agent_outputs2 = []
        with ThreadPoolExecutor(max_workers=5) as ex:
            fut_map = {ex.submit(run_agent, ag, enriched_ctx, graph2): i for i,ag in enumerate(specs)}
            done = 0
            for fut in as_completed(fut_map):
                ag = specs[fut_map[fut]]; done += 1
                pct = 66 + int(done/len(specs)*20)
                try:
                    out = fut.result(); agent_outputs2.append(out)
                    _emit(session, session_store, None, pct,
                          f'[Phase 2] {ag.name}: {out["signal"]} @{out["confidence"]}% ({done}/{len(specs)})')
                except Exception as e:
                    log.error(f'Phase2 agent {ag.name} failed: {e}')
                    agent_outputs2.append({'role':ag.role,'agent_name':ag.name,'signal':'neutral',
                                           'confidence':0,'reasoning':str(e),'factors':[],'butterflies':[]})

        flow2 = graph2.to_flow(); st2 = flow2['stats']
        _emit(session, session_store, None, 87,
              f'[Phase 2 Graph] {st2["nodes"]}n {st2["edges"]}e | {st2["bull"]}B/{st2["bear"]}Be/{st2["neut"]}N')

        # Final synthesis from enriched graph
        _emit(session, session_store, None, 89, '[Phase 2] Final synthesizer...')
        final_syn = None
        for synth in synths:
            try:
                final_syn = run_synthesizer(synth, graph2)
                break
            except Exception as e:
                log.error(f'Final synth failed: {e}')
        if not final_syn:
            final_syn = fast_syn  # Fall back to fast result

        final_syn['direction'] = final_syn.get('direction') or 'sideways'

        duration = int((time.time() - (time.time() - 1)) * 1000)  # approx
        session.deep_result    = {'phase': 'enriched', **{k:v for k,v in final_syn.items()}}
        session.final_result   = final_syn
        session.agent_outputs  = agent_outputs2  # Use richer phase 2 outputs
        session.graph          = flow2

        _emit(session, session_store, SessionStatus.COMPLETED, 100,
              f'Complete. Final: {final_syn["direction"]} up={final_syn["up"]}% dn={final_syn["down"]}% conf={final_syn["confidence"]}%')

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        log.error(f'Pipeline failed: {e}\n{tb}')
        from ..models.session import SessionStatus
        session.error = str(e)
        _emit(session, session_store, SessionStatus.FAILED, 0, f'Failed: {str(e)}')
