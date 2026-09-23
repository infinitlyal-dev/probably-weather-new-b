"""Fetch the two COMET checkpoints (and the tokenizer/config their encoder needs) from their
official Hugging Face repositories, pinned to a commit, and check every file against the hash
Hugging Face publishes for it BEFORE anything loads it. Al's ruling, 2026-09-23.

  SSA-COMET  McGill-NLP/ssa-comet-mtl      isiZulu only
  AfriCOMET  masakhane/africomet-stl-1.1    isiXhosa only
  encoder    Davlan/afro-xlmr-large-76L     tokenizer.json, tokenizer_config.json, config.json only
             (both checkpoints name it as pretrained_model; COMET builds the encoder from its config
             and loads the weights from the checkpoint, so the 2.2 GB encoder weights are NOT fetched)

LFS files are checked by SHA-256 (the lfs.oid in the repo tree); small git files by their git blob
SHA-1. Any mismatch deletes the file and exits non-zero.
"""
import hashlib, json, os, sys, urllib.request

# The venv, the checkpoints and verified.json live OUTSIDE the repo (about 4.6 GB; OneDrive must not
# sync them): PW_COMET_HOME, default C:\Users\27741\pw-comet. The copy of verified.json beside this script is
# the record of what was checked.
HERE = os.environ.get('PW_COMET_HOME', r'C:\Users\27741\pw-comet')
STORE = os.path.join(HERE, 'models')
REPOS = {
    'McGill-NLP/ssa-comet-mtl': ['hparams.yaml', 'checkpoints/model.ckpt'],
    'masakhane/africomet-stl-1.1': ['hparams.yaml', 'checkpoints/model.ckpt'],
    'Davlan/afro-xlmr-large-76L': ['config.json', 'tokenizer.json', 'tokenizer_config.json'],
}


def api(url):
    with urllib.request.urlopen(url) as r:
        return json.load(r)


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def git_blob_sha1(p):
    data = open(p, 'rb').read()
    return hashlib.sha1(b'blob %d\0' % len(data) + data).hexdigest()


record = {}
for repo, files in REPOS.items():
    info = api(f'https://huggingface.co/api/models/{repo}')
    rev = info['sha']
    tree = {f['path']: f for f in api(f'https://huggingface.co/api/models/{repo}/tree/{rev}?recursive=true')}
    record[repo] = {'revision': rev, 'files': {}}
    for name in files:
        meta = tree[name]
        dest = os.path.join(STORE, repo.replace('/', '__'), *name.split('/'))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        lfs = meta.get('lfs')
        want = lfs['oid'] if lfs else meta['oid']
        check = sha256 if lfs else git_blob_sha1
        if not (os.path.exists(dest) and os.path.getsize(dest) == meta['size'] and check(dest) == want):
            url = f'https://huggingface.co/{repo}/resolve/{rev}/{name}'
            print(f'fetching {repo}/{name} ({meta["size"]:,} bytes) @ {rev[:10]}', flush=True)
            urllib.request.urlretrieve(url, dest + '.part')
            os.replace(dest + '.part', dest)
        got = check(dest)
        if got != want:
            os.remove(dest)
            sys.exit(f'HASH MISMATCH {repo}/{name}: published {want}, got {got} — deleted')
        record[repo]['files'][name] = {'size': meta['size'], 'hash': ('sha256:' if lfs else 'git-sha1:') + want}
        print(f'ok {repo}/{name} {("sha256" if lfs else "git-sha1")} {want[:16]}…', flush=True)

json.dump(record, open(os.path.join(HERE, 'verified.json'), 'w'), indent=1)
print('all files match their published hashes -> verified.json')
