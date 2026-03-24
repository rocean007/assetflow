from flask import request, jsonify
from . import market_bp
from ..services.data import price, history

@market_bp.get('/price/<sym>')
def get_price(sym):
    av = request.args.get('av_key','')
    p = price(sym.upper(), av or None)
    if not p: return jsonify({'success':False,'error':f'No price for {sym}'}), 404
    return jsonify({'success':True,'data':p})

@market_bp.get('/history/<sym>')
def get_history(sym):
    days = request.args.get('days',30,type=int)
    h = history(sym.upper(), days)
    return jsonify({'success':True,'data':h})
