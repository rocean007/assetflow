import logging, sys
from functools import lru_cache
FMT = '%(asctime)s [%(levelname)-5s] %(name)s - %(message)s'
@lru_cache(maxsize=None)
def get_logger(name, level='INFO'):
    log = logging.getLogger(name)
    if not log.handlers:
        h = logging.StreamHandler(sys.stdout)
        h.setFormatter(logging.Formatter(FMT, '%H:%M:%S'))
        log.addHandler(h)
        log.setLevel(getattr(logging, level.upper(), logging.INFO))
        log.propagate = False
    return log
