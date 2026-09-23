"""Score translations with SSA-COMET (isiZulu) or AfriCOMET (isiXhosa) — Al's ruling 2026-09-23.

  python score.py --model ssa --in items.jsonl --out scores.json      # isiZulu only
  python score.py --model afri --in items.jsonl --out scores.json     # isiXhosa only (needs "ref")
  items.jsonl: {"id", "lang", "src", "mt"[, "ref"]}  — "ref" absent means reference-free (QE):
               SSA-COMET-MTL supports QE; AfriCOMET-STL is reference-based only and refuses items
               without one.

Before loading, the checkpoint is hashed and compared with verified.json (written by
fetch_verify.py from the hashes Hugging Face publishes). Runs offline: the encoder's tokenizer and
config come from the verified local copy, nothing is fetched.
"""
import argparse, hashlib, json, os, sys

# The venv, the checkpoints and verified.json live OUTSIDE the repo (about 4.6 GB; OneDrive must not
# sync them): PW_COMET_HOME, default C:\Users\27741\pw-comet. The copy of verified.json beside this script is
# the record of what was checked.
HERE = os.environ.get('PW_COMET_HOME', r'C:\Users\27741\pw-comet')
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
MODELS = {
    'ssa': {'repo': 'McGill-NLP/ssa-comet-mtl', 'lang': 'zu', 'qe': True},
    'afri': {'repo': 'masakhane/africomet-stl-1.1', 'lang': 'xh', 'qe': False},
}
ENCODER = 'Davlan/afro-xlmr-large-76L'

ap = argparse.ArgumentParser()
ap.add_argument('--model', required=True, choices=MODELS)
ap.add_argument('--in', dest='inp', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--batch', type=int, default=16)
a = ap.parse_args()
a.inp, a.out = os.path.abspath(a.inp), os.path.abspath(a.out)
m = MODELS[a.model]

items = [json.loads(l) for l in open(a.inp, encoding='utf-8') if l.strip()]
wrong = [it['id'] for it in items if it.get('lang') != m['lang']]
if wrong:
    sys.exit(f"{m['repo']} is ruled for {m['lang']} only; {len(wrong)} items are another language — refusing")
if not m['qe'] and any(not it.get('ref') for it in items):
    sys.exit(f"{m['repo']} is reference-based: every item needs a human reference — refusing")

verified = json.load(open(os.path.join(HERE, 'verified.json')))
store = os.path.join(HERE, 'models')
ckpt = os.path.join(store, m['repo'].replace('/', '__'), 'checkpoints', 'model.ckpt')
want = verified[m['repo']]['files']['checkpoints/model.ckpt']['hash'].split(':', 1)[1]
h = hashlib.sha256()
with open(ckpt, 'rb') as f:
    for b in iter(lambda: f.read(1 << 22), b''):
        h.update(b)
if h.hexdigest() != want:
    sys.exit(f'{ckpt} does not match its published SHA-256 — refusing to load')
print(f"[comet] {m['repo']} checkpoint sha256 matches the published hash", file=sys.stderr, flush=True)

# The checkpoint names its encoder "Davlan/afro-xlmr-large-76L"; transformers resolves that as a local
# folder first, so run from a folder where that relative path holds the verified tokenizer + config.
enc_dir = os.path.join(store, 'local', *ENCODER.split('/'))
os.makedirs(enc_dir, exist_ok=True)
src_dir = os.path.join(store, ENCODER.replace('/', '__'))
for name in verified[ENCODER]['files']:
    s, d = os.path.join(src_dir, name), os.path.join(enc_dir, name)
    if not os.path.exists(d) or os.path.getsize(d) != os.path.getsize(s):
        with open(s, 'rb') as fi, open(d, 'wb') as fo:
            fo.write(fi.read())
os.chdir(os.path.join(store, 'local'))

import torch  # noqa: E402
from comet import load_from_checkpoint  # noqa: E402
torch.set_num_threads(max(1, (os.cpu_count() or 4) - 1))
model = load_from_checkpoint(ckpt, local_files_only=True)
data = [{'src': it['src'], 'mt': it['mt'], **({'ref': it['ref']} if it.get('ref') else {})} for it in items]
out = model.predict(data, batch_size=a.batch, gpus=0, progress_bar=False)
scores = [float(s) for s in out.scores]
json.dump([{'id': it['id'], 'score': s} for it, s in zip(items, scores)], open(a.out, 'w', encoding='utf-8'), indent=1)
print(f"[comet] {m['repo']}: {len(scores)} items scored, mean {sum(scores) / max(1, len(scores)):.4f}", file=sys.stderr)
