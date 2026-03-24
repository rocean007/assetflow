from pathlib import Path
from ..utils.logger import get_logger
log = get_logger('af.files')

def extract(path: str) -> str:
    p = Path(path)
    if not p.exists(): return ''
    ext = p.suffix.lower()
    try:
        if ext == '.pdf':
            try:
                import PyPDF2
                with open(p,'rb') as f:
                    r = PyPDF2.PdfReader(f)
                    return '\n'.join(page.extract_text() or '' for page in r.pages)
            except ImportError:
                return f'[PDF: {p.name} - install PyPDF2]'
        elif ext in ('.docx','.doc'):
            try:
                import docx
                return '\n'.join(para.text for para in docx.Document(str(p)).paragraphs)
            except ImportError:
                return f'[DOCX: {p.name} - install python-docx]'
        elif ext == '.csv':
            import csv
            with open(p,encoding='utf-8',errors='ignore') as f:
                return '\n'.join(','.join(row) for row in list(csv.reader(f))[:500])
        elif ext == '.json':
            import json
            return json.dumps(json.loads(p.read_text()),indent=2)[:6000]
        else:
            return p.read_text(encoding='utf-8',errors='ignore')
    except Exception as e:
        log.warning(f'Could not parse {p.name}: {e}'); return ''
