"""
File Parser — extract plain text from uploaded supplementary files.
Supports: PDF, DOCX, TXT, MD, CSV, JSON
"""
import json, csv
from pathlib import Path
from ..utils.logger import get_logger
log = get_logger('assetflow.file_parser')

def extract_text(filepath: str) -> str:
    p = Path(filepath)
    if not p.exists():
        return ''
    suffix = p.suffix.lower()
    try:
        if suffix == '.pdf':
            return _pdf(p)
        elif suffix in ('.docx', '.doc'):
            return _docx(p)
        elif suffix == '.csv':
            return _csv(p)
        elif suffix == '.json':
            return _json(p)
        else:  # .txt, .md, .log, etc.
            return p.read_text(encoding='utf-8', errors='ignore')
    except Exception as e:
        log.warning(f'Could not parse {p.name}: {e}')
        return ''

def _pdf(p: Path) -> str:
    try:
        import PyPDF2
        text = []
        with open(p, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text.append(page.extract_text() or '')
        return '\n'.join(text)
    except ImportError:
        return f'[PDF: {p.name} — install PyPDF2 to parse]'

def _docx(p: Path) -> str:
    try:
        import docx
        doc = docx.Document(str(p))
        return '\n'.join(para.text for para in doc.paragraphs)
    except ImportError:
        return f'[DOCX: {p.name} — install python-docx to parse]'

def _csv(p: Path) -> str:
    lines = []
    with open(p, encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        for row in reader:
            lines.append(', '.join(row))
    return '\n'.join(lines[:500])  # cap at 500 rows

def _json(p: Path) -> str:
    try:
        data = json.loads(p.read_text(encoding='utf-8'))
        return json.dumps(data, indent=2)[:8000]
    except Exception:
        return p.read_text(encoding='utf-8', errors='ignore')[:8000]
