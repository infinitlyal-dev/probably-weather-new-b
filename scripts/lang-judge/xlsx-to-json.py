# Exports the isiXhosa native-review merge sheet (review/Xhosa-Review-Merge.xlsx, July 2026: two native reviewers,
# A and B, 615 strings) to scripts/lang-judge/data/xh-review-merge.json, so the verdict builder can read it from Node.
# Cells are copied as they are; nothing is reworded.
#
#   python -I scripts/lang-judge/xlsx-to-json.py

import json
import os
import openpyxl

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
wb = openpyxl.load_workbook(os.path.join(ROOT, 'review', 'Xhosa-Review-Merge.xlsx'), data_only=True)


def rows(name, keys):
    out = []
    for i, r in enumerate(wb[name].iter_rows(values_only=True)):
        if i == 0 or not any(r):
            continue
        out.append({k: (str(v).strip() if v is not None else None) for k, v in zip(keys, r)})
    return out


data = {
    'source': 'review/Xhosa-Review-Merge.xlsx',
    'summary': [[str(c) if c is not None else None for c in r] for r in wb['SUMMARY'].iter_rows(values_only=True)],
    'apply': rows('APPLY', ['section', 'english', 'shipped', 'final', 'source', 'confidence', 'rationale', 'flags']),
    'approved': rows('APPROVED (no change)', ['section', 'english', 'shipped', 'basis']),
    'quarantine': rows('QUARANTINE (scrambled bin)', ['section', 'english', 'shipped', 'noteA', 'noteB', 'use']),
    'futureReview': rows('FUTURE-REVIEW', ['section', 'english', 'final', 'sourceConf', 'why']),
}
with open(os.path.join(ROOT, 'scripts', 'lang-judge', 'data', 'xh-review-merge.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
    f.write('\n')
print({k: len(v) for k, v in data.items() if isinstance(v, list)})
