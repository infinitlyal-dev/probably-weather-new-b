#!/usr/bin/env python3
"""
Portrait Extender — fal.ai outpainting POC for Probably Weather.

Takes square or landscape weather background images and extends them
vertically to a phone aspect ratio (9:19.5 by default) using fal.ai
inpainting. Saves the extended images to an output dir and produces a
side-by-side comparison HTML page for review.

Default model: fal-ai/flux-general/inpainting
  - FLUX-family inpainting endpoint. To outpaint, the original is
    pasted onto a larger transparent canvas and a mask covers the
    empty (extend) regions. The model fills those regions using the
    visible original as context plus the prompt.
  - Override with --model. fal.ai's outpaint catalogue has shifted
    over time; if a "true" outpaint endpoint exists it should accept
    the same image_url + mask_url shape.

Usage:
    python extend_script.py \\
      --inputs assets/images/bg/wind/day_1.jpg \\
                assets/images/bg/clear/day_5.jpg \\
                assets/images/bg/cold/dawn_2.jpg

Reads FAL_KEY from .env (or environment).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from PIL import Image


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = Path("tools/portrait-extender/output")
DEFAULT_MODEL = "fal-ai/flux-general/inpainting"
DEFAULT_TARGET_RATIO = "9:19.5"
PORTRAIT_THRESHOLD = 1.1  # height > width * this = already portrait, skip


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@dataclass
class Result:
    input_path: Path
    skipped: bool = False
    error: Optional[str] = None
    src_w: int = 0
    src_h: int = 0
    out_w: int = 0
    out_h: int = 0
    output_path: Optional[Path] = None
    elapsed_s: float = 0.0
    cost_usd: Optional[float] = None
    response: dict = field(default_factory=dict)


def parse_ratio(s: str) -> tuple[float, float]:
    try:
        w, h = s.split(":")
        return float(w), float(h)
    except Exception as e:
        raise SystemExit(f"Invalid --target-ratio {s!r}: {e}")


def derive_time_of_day(filename: str) -> str:
    """Map filename prefix to a lighting hint for the prompt."""
    name = filename.lower()
    if name.startswith("dawn"):
        return "golden hour soft light"
    if name.startswith("dusk"):
        return "warm sunset light"
    if name.startswith("night"):
        return "dark sky stars"
    # day_* or day.jpg
    return "midday natural light"


def build_prompt(filename: str, condition_folder: str) -> str:
    """South African weather scene prompt that fits the target file."""
    light = derive_time_of_day(filename)
    return (
        "Extend this South African weather scene naturally, matching "
        "lighting, sky colour, and ground texture. Photorealistic, no "
        "people added, no text, no watermarks. "
        f"Condition: {condition_folder}. Light: {light}."
    )


def build_canvas_and_mask(
    src: Image.Image, target_w: int, target_h: int
) -> tuple[Image.Image, Image.Image, tuple[int, int]]:
    """Centre the original on a target-sized canvas and build the inpaint mask.

    Canvas: same width as target, original pasted vertically centred.
            Pixels outside the original are filled with edge-replicated
            colour (so the model has a soft hint to blend with).
    Mask:   white where the model should generate (above and below the
            original), black where the original sits.
    """
    src_w, src_h = src.size
    if src_w != target_w:
        # Resize original to match target width while keeping aspect
        new_h = round(src_h * target_w / src_w)
        src = src.resize((target_w, new_h), Image.LANCZOS)
        src_w, src_h = src.size

    # Centre vertically on the new canvas
    paste_y = max(0, (target_h - src_h) // 2)

    # Canvas: edge-replicate the top and bottom rows of the original so
    # the outpaint model gets a soft starting tone instead of pure black.
    canvas = Image.new("RGB", (target_w, target_h), (0, 0, 0))
    if paste_y > 0:
        top_row = src.crop((0, 0, src_w, 1)).resize((target_w, paste_y))
        canvas.paste(top_row, (0, 0))
    if paste_y + src_h < target_h:
        bottom_band = src.crop((0, src_h - 1, src_w, src_h)).resize(
            (target_w, target_h - (paste_y + src_h))
        )
        canvas.paste(bottom_band, (0, paste_y + src_h))
    canvas.paste(src, (0, paste_y))

    # Mask: white = generate, black = keep
    mask = Image.new("L", (target_w, target_h), 255)
    keep = Image.new("L", (src_w, src_h), 0)
    mask.paste(keep, (0, paste_y))

    return canvas, mask, (0, paste_y)


def slug_from_path(p: Path) -> str:
    """assets/images/bg/clear/day_5.jpg → clear_day_5"""
    parts = p.with_suffix("").parts
    return "_".join(parts[-2:])


# ---------------------------------------------------------------------------
# fal.ai call
# ---------------------------------------------------------------------------


def call_fal(
    model: str,
    canvas_path: Path,
    mask_path: Path,
    prompt: str,
    target_w: int,
    target_h: int,
):
    """Submit one outpaint job. Returns (image_bytes, raw_response)."""
    import fal_client  # imported here so missing dep is a friendly error

    canvas_url = fal_client.upload_file(str(canvas_path))
    mask_url = fal_client.upload_file(str(mask_path))

    arguments = {
        "image_url": canvas_url,
        "mask_url": mask_url,
        "prompt": prompt,
        "image_size": {"width": target_w, "height": target_h},
        "num_inference_steps": 28,
        "guidance_scale": 3.5,
    }

    handler = fal_client.subscribe(
        model,
        arguments=arguments,
        with_logs=False,
    )

    # Result shape: { "images": [{"url": "...", "width": ..., "height": ...}], ... }
    images = handler.get("images") or []
    if not images:
        raise RuntimeError(f"fal.ai returned no images: {handler}")

    img_url = images[0]["url"]

    # Download the result
    import urllib.request
    req = urllib.request.Request(img_url, headers={"User-Agent": "pw-portrait-extender/0.1"})
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read()

    return body, handler


# ---------------------------------------------------------------------------
# Per-image pipeline
# ---------------------------------------------------------------------------


def process_one(
    input_path: Path,
    output_dir: Path,
    target_ratio_w: float,
    target_ratio_h: float,
    model: str,
) -> Result:
    res = Result(input_path=input_path)
    start = time.time()

    if not input_path.exists():
        res.error = f"file not found: {input_path}"
        return res

    src = Image.open(input_path).convert("RGB")
    res.src_w, res.src_h = src.size

    # Skip if already portrait (height > width * threshold)
    if res.src_h > res.src_w * PORTRAIT_THRESHOLD:
        res.skipped = True
        res.error = "already portrait — skipping"
        return res

    # Compute target canvas — same width, taller height
    target_w = res.src_w
    target_h = round(target_w * (target_ratio_h / target_ratio_w))

    # Build canvas + mask, save as temporary inputs the API can fetch
    canvas, mask, _ = build_canvas_and_mask(src, target_w, target_h)
    output_dir.mkdir(parents=True, exist_ok=True)
    slug = slug_from_path(input_path)
    canvas_tmp = output_dir / f"{slug}_canvas.jpg"
    mask_tmp = output_dir / f"{slug}_mask.png"
    canvas.save(canvas_tmp, "JPEG", quality=95)
    mask.save(mask_tmp, "PNG")

    # Prompt
    folder = input_path.parent.name
    prompt = build_prompt(input_path.stem, folder)

    # Call fal.ai
    try:
        img_bytes, raw_response = call_fal(
            model, canvas_tmp, mask_tmp, prompt, target_w, target_h
        )
    except Exception as e:  # noqa: BLE001  — per-image isolation
        res.error = f"fal.ai error: {e}"
        res.elapsed_s = round(time.time() - start, 2)
        return res

    # Persist output and response
    out_path = output_dir / f"{slug}_extended.jpg"
    out_path.write_bytes(img_bytes)
    res.output_path = out_path
    res.response = raw_response if isinstance(raw_response, dict) else {"raw": str(raw_response)}
    (output_dir / f"{slug}_response.json").write_text(json.dumps(res.response, indent=2))

    # Read result dimensions
    try:
        with Image.open(out_path) as im:
            res.out_w, res.out_h = im.size
    except Exception:
        pass

    res.cost_usd = (
        res.response.get("cost") or res.response.get("price")
        if isinstance(res.response, dict)
        else None
    )
    res.elapsed_s = round(time.time() - start, 2)
    return res


# ---------------------------------------------------------------------------
# Comparison HTML
# ---------------------------------------------------------------------------


def write_comparison_html(results: list[Result], output_dir: Path) -> Path:
    """Side-by-side HTML viewer at phone aspect ratio for review."""
    rows = []
    for r in results:
        if r.skipped or r.error or not r.output_path:
            note = r.error or "skipped"
            rows.append(
                f"<div class='card error'><div class='cap'>{r.input_path}</div>"
                f"<div class='msg'>{note}</div></div>"
            )
            continue
        # Relative paths so the HTML opens locally
        try:
            src_rel = os.path.relpath(REPO_ROOT / r.input_path, output_dir)
        except ValueError:
            src_rel = str(r.input_path)
        out_rel = r.output_path.name  # lives next to the html
        rows.append(
            f"""
            <div class='card'>
              <div class='cap'>{r.input_path}</div>
              <div class='pair'>
                <figure><figcaption>before — {r.src_w}×{r.src_h}</figcaption>
                  <img src='{src_rel}' alt='before' />
                </figure>
                <figure><figcaption>after — {r.out_w}×{r.out_h}</figcaption>
                  <img src='{out_rel}' alt='after' />
                </figure>
              </div>
              <div class='meta'>{r.elapsed_s}s · cost {r.cost_usd or '—'}</div>
            </div>
            """
        )

    html = f"""<!doctype html>
<html lang='en'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <title>Portrait Extender — review</title>
  <style>
    body {{ background: #111; color: #eee; font-family: -apple-system, system-ui, sans-serif;
            margin: 0; padding: 1rem; }}
    h1 {{ margin: 0 0 1rem 0; font-size: 1.1rem; opacity: 0.85; }}
    .card {{ background: #1a1a1a; border-radius: 12px; padding: 1rem;
             margin-bottom: 1.5rem; }}
    .cap {{ font-family: ui-monospace, monospace; font-size: 0.85rem;
            opacity: 0.8; margin-bottom: 0.5rem; word-break: break-all; }}
    .msg {{ color: #f88; font-size: 0.9rem; }}
    .pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }}
    figure {{ margin: 0; }}
    figcaption {{ font-size: 0.75rem; opacity: 0.65; margin-bottom: 4px; }}
    .pair img {{ width: 100%; aspect-ratio: 9 / 19.5; object-fit: contain;
                 background: #000; border-radius: 8px; display: block; }}
    .meta {{ margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.7; }}
    @media (max-width: 600px) {{
      .pair {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <h1>Portrait Extender — review</h1>
  {''.join(rows)}
</body>
</html>
"""
    out = output_dir / "comparison.html"
    out.write_text(html, encoding="utf-8")
    return out


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="fal.ai portrait extender POC")
    parser.add_argument("--inputs", nargs="+", required=True, help="image paths")
    parser.add_argument("--target-ratio", default=DEFAULT_TARGET_RATIO)
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--model", default=DEFAULT_MODEL)
    args = parser.parse_args()

    # Load .env located next to this script
    load_dotenv(Path(__file__).resolve().parent / ".env")
    fal_key = os.environ.get("FAL_KEY")
    if not fal_key:
        print(
            "ERROR: FAL_KEY not set. Copy .env.example to .env and fill it in,",
            "or export FAL_KEY in your shell.",
            file=sys.stderr,
        )
        return 2

    rw, rh = parse_ratio(args.target_ratio)
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = REPO_ROOT / output_dir

    inputs = []
    for raw in args.inputs:
        p = Path(raw)
        if not p.is_absolute():
            p = REPO_ROOT / p
        inputs.append(p)

    print(f"[run] model={args.model} ratio={args.target_ratio} output={output_dir}")
    print(f"[run] {len(inputs)} input(s)")

    overall_start = time.time()
    results: list[Result] = []
    total_cost = 0.0
    for p in inputs:
        print(f"\n[image] {p}")
        r = process_one(p, output_dir, rw, rh, args.model)
        results.append(r)
        if r.skipped:
            print(f"  skipped: {r.error}")
        elif r.error:
            print(f"  ERROR: {r.error}  (took {r.elapsed_s}s)")
        else:
            print(
                f"  before {r.src_w}x{r.src_h} → after {r.out_w}x{r.out_h}"
                f"  cost={r.cost_usd or '—'}  ({r.elapsed_s}s)"
            )
            print(f"  → {r.output_path}")
            if isinstance(r.cost_usd, (int, float)):
                total_cost += r.cost_usd

    html_path = write_comparison_html(results, output_dir)

    elapsed = round(time.time() - overall_start, 1)
    ok = sum(1 for r in results if r.output_path)
    failed = sum(1 for r in results if r.error and not r.skipped)
    skipped = sum(1 for r in results if r.skipped)

    print("\n" + "=" * 60)
    print(f"summary: {ok} extended, {failed} failed, {skipped} skipped")
    print(f"total cost: {total_cost or '—'}")
    print(f"comparison: {html_path}")
    print(f"elapsed: {elapsed}s")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
