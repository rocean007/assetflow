from flask import request, jsonify
from . import market_bp
from ..services.data_collector import fetch_price, fetch_history
from ..utils.logger import get_logger
log = get_logger('assetflow.api.market')

@market_bp.get('/price/<symbol>')
def price(symbol):
    av_key = request.args.get('av_key','')
    p = fetch_price(symbol.upper(), av_key or None)
    if not p: return jsonify({'success':False,'error':f'Price unavailable: {symbol}'}), 404
    return jsonify({'success':True,'data':p})

@market_bp.get('/history/<symbol>')
def history(symbol):
    days = request.args.get('days',30,type=int)
    av_key = request.args.get('av_key','')
    h = fetch_history(symbol.upper(), days, av_key or None)
    return jsonify({'success':True,'data':h,'count':len(h)})
