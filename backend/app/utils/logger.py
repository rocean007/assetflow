"""
Structured logger — matches MiroFish logger pattern
"""
import logging
import sys
from functools import lru_cache

LOG_FORMAT = '%(asctime)s [%(levelname)s] %(name)s — %(message)s'
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'


@lru_cache(maxsize=None)
def get_logger(name: str, level: str = 'INFO') -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
        logger.addHandler(handler)
        logger.setLevel(getattr(logging, level.upper(), logging.INFO))
        logger.propagate = False
    return logger
