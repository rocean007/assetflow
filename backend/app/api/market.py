"""
Market data proxy — quick price/history lookups for the frontend.
"""
from flask import request, jsonify
from . import market_bp
from ..services.data_collector import fetch_price, fetch_history
from ..utils.logger import get_logger

logger = get_logger('assetflow.api.market')


@market_bp.get('/price/<symbol>')
def get_price(symbol: str):
    """Get current price for a symbol."""
    av_key = request.args.get('av_key', '')
    price = fetch_price(symbol.upper(), av_key or None)
    if not price:
        return jsonify({'success': False, 'error': f'Price unavailable for {symbol}'}), 404
    return jsonify({'success': True, 'data': price})


@market_bp.get('/history/<symbol>')
def get_history(symbol: str):
    """Get OHLCV history for a symbol."""
    days   = request.args.get('days', 30, type=int)
    av_key = request.args.get('av_key', '')
    history = fetch_history(symbol.upper(), days, av_key or None)
    return jsonify({'success': True, 'data': history, 'count': len(history)})
