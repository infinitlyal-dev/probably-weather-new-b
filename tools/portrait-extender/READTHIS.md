# Portrait Extender

Outpaints PW background images to phone aspect ratio using fal.ai.

## Why

The image library has 128 images that aren't 9:19.5 phone ratio.
Cover-cropping cuts off 44–70% of each frame. This tool extends each
image vertically using fal.ai FLUX inpainting before we commit to all 128.

## Setup

```bash
cd tools/portrait-extender
cp .env.example .env
# open .env and paste your FAL_KEY

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`.env` is gitignored. Get a key at https://fal.ai/dashboard/keys.

## Run

From the repo root.

A few images:

```bash
python tools/portrait-extender/extend_script.py \
  --inputs assets/images/bg/wind/day_1.jpg \
           assets/images/bg/clear/day_5.jpg \
           assets/images/bg/cold/dawn_2.jpg
```

The full bad-crop batch (125 images, paths in `batch.txt`):

```bash
python tools/portrait-extender/extend_script.py \
  --inputs-file tools/portrait-extender/batch.txt
```

Resume a run that crashed midway — just re-run the same command. Already-extended
images skip without burning a fal.ai call.

Flags:

| flag | default | meaning |
|---|---|---|
| `--inputs` | one of these | one or more image paths relative to repo root |
| `--inputs-file` | one of these | text file with one image path per line (`#` comments + blanks ignored) |
| `--target-ratio` | `9:19.5` | width:height of the output canvas |
| `--output-dir` | `tools/portrait-extender/output` | where extended jpgs land |
| `--model` | `fal-ai/flux-general/inpainting` | fal.ai endpoint to call |
| `--sleep-between` | `2.0` | seconds between fal.ai calls (skipped images don't burn the gap) |
| `--regen-html-only` | off | rebuild `comparison.html` from disk without processing |

## What it produces

In `tools/portrait-extender/output/` (gitignored):

- `<folder>_<filename>_canvas.jpg` — the original padded onto the target canvas (debug)
- `<folder>_<filename>_mask.png` — the inpaint mask (debug)
- `<folder>_<filename>_extended.jpg` — the **result**
- `<folder>_<filename>_response.json` — raw fal.ai response
- `batch_log.txt` — TSV, one line per processed image: `STATUS<TAB>input<TAB>output<TAB>cost<TAB>elapsed<TAB>note`
- `failed.txt` — input paths that failed (deduped). Re-run with `--inputs-file failed.txt` to retry.
- `comparison.html` — side-by-side before/after at phone aspect ratio, grouped by folder, with a summary header (open on your phone)

## How outpainting works here

fal.ai's FLUX inpainting endpoint fills white-mask regions of an
image using the black-mask region as context. To outpaint, we:

1. Compute the target canvas (same width, taller height — 9:19.5).
2. Paste the original vertically centred on the canvas.
3. Fill the empty top/bottom with edge-replicated colour from the original
   (gives the model a soft starting tone instead of hard black).
4. Build a mask: white where we want generation, black over the original.
5. Send canvas + mask + a SA-flavoured prompt to fal.ai.

Prompt is tuned for SA weather scenes and includes a light hint
derived from the filename:

- `dawn_*` → golden hour soft light
- `day_*` → midday natural light
- `dusk_*` → warm sunset light
- `night_*` → dark sky stars

## Skipped images

Anything already portrait (`height > width * 1.1`) is skipped with a
note. Currently in the library the 768×1376 images (44 of 184) are
already taller-than-wide, so they'll skip. The 1024×1024 squares (105)
and the 1920×1080 landscape (39) and the 3 × 1376×768 outliers are the
real targets.

## Cost & speed

fal.ai bills per image. Cost is captured per-image in the `response.json`
and printed in the run summary. A flux-pro inpainting call is roughly
10–20 seconds and costs cents per image — multiply by 128 for the full batch.

## Troubleshooting

- `ERROR: FAL_KEY not set` — copy `.env.example` to `.env` and fill it in.
- `fal.ai returned no images` — check the response.json file written
  next to the canvas/mask. Usually a content-policy refusal or a bad
  model endpoint.
- Output looks weak at the seam — increase `num_inference_steps` in
  `extend_script.py` (currently 28) or experiment with a different
  model via `--model`.

## Picking a different model

Try in this order if the default underperforms:

```bash
--model fal-ai/flux-general/inpainting       # default
--model fal-ai/ideogram/v2/edit              # alternative w/ mask
--model fal-ai/recraft/v3/image-to-image     # alternative
```

The script always passes `image_url`, `mask_url`, `prompt`, `image_size`
— most fal.ai inpaint/edit endpoints accept that shape.

## Status

POC. Run on three test images first, eyeball `comparison.html`, then
batch the remaining ones if the quality holds up.
