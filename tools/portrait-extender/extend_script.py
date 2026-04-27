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

    # Skip if a successful extended output already exists (resume-friendly).
    output_dir.mkdir(parents=True, exist_ok=True)
    slug = slug_from_path(input_path)
    existing = output_dir / f"{slug}_extended.jpg"
    if existing.exists():
        res.skipped = True
        res.error = "already extended — skipping"
        res.output_path = existing
        try:
            with Image.open(existing) as im:
                res.out_w, res.out_h = im.size
        except Exception:
            pass
        return res

    # Compute target canvas — same width, taller height
    target_w = res.src_w
    target_h = round(target_w * (target_ratio_h / target_ratio_w))

    # Build canvas + mask, save as temporary inputs the API can fetch
    canvas, mask, _ = build_canvas_and_mask(src, target_w, target_h)
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
# Batch log + failed list
# ---------------------------------------------------------------------------

BATCH_LOG = "batch_log.txt"
FAILED_LIST = "failed.txt"


def append_batch_log(output_dir: Path, r: Result) -> None:
    """Append a TSV row: STATUS\\tinput\\toutput\\tcost\\telapsed_s.

    STATUS is OK | FAIL | SKIP. Fields with no value are written as '-'.
    """
    if r.skipped:
        status = "SKIP"
    elif r.error or not r.output_path:
        status = "FAIL"
    else:
        status = "OK"
    output = str(r.output_path) if r.output_path else "-"
    cost = str(r.cost_usd) if isinstance(r.cost_usd, (int, float)) else "-"
    note = (r.error or "").replace("\t", " ").replace("\n", " ")
    line = f"{status}\t{r.input_path}\t{output}\t{cost}\t{r.elapsed_s}\t{note}\n"
    (output_dir / BATCH_LOG).open("a", encoding="utf-8").write(line)


def append_failed(output_dir: Path, input_path: Path) -> None:
    """Append the input path to failed.txt for retry. Dedup on read."""
    p = output_dir / FAILED_LIST
    existing = set()
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                existing.add(line)
    target = str(input_path)
    if target not in existing:
        p.open("a", encoding="utf-8").write(target + "\n")


# ---------------------------------------------------------------------------
# Comparison HTML
# ---------------------------------------------------------------------------


def _read_batch_log(output_dir: Path) -> dict[str, dict]:
    """Map original-input-path → latest log row. Resilient to repeated runs."""
    p = output_dir / BATCH_LOG
    rows: dict[str, dict] = {}
    if not p.exists():
        return rows
    for line in p.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        status, src, out, cost, elapsed, *rest = parts
        rows[src] = {
            "status": status,
            "src": src,
            "out": out,
            "cost": cost,
            "elapsed": elapsed,
            "note": (rest[0] if rest else ""),
        }
    return rows


def write_comparison_html(
    output_dir: Path,
    run_summary: Optional[dict] = None,
) -> Path:
    """Build the review page from disk: scans output_dir for *_extended.jpg
    and renders each with its source. Cards grouped by folder. Header
    summarises overall state.
    """
    log_rows = _read_batch_log(output_dir)

    # Build a map: extended-output-path → input-path (from the batch log).
    out_to_src: dict[str, str] = {}
    for src, row in log_rows.items():
        if row["status"] == "OK" and row["out"] != "-":
            out_to_src[Path(row["out"]).name] = src

    # Scan the output dir for actual *_extended.jpg.
    extended = sorted(output_dir.glob("*_extended.jpg"))

    # Group cards by folder (clear/cloudy/cold/...).
    groups: dict[str, list[str]] = {}
    total_cost = 0.0
    for ext_path in extended:
        # Resolve the original input path.
        src_str = out_to_src.get(ext_path.name)
        if src_str:
            src_path = Path(src_str)
            if not src_path.is_absolute():
                src_path = REPO_ROOT / src_path
            folder = Path(src_str).parent.name
        else:
            # Fall back to slug parsing — best effort.
            folder = "unknown"
            src_path = None

        # Get dims for both images.
        try:
            with Image.open(ext_path) as im:
                out_w, out_h = im.size
        except Exception:
            out_w, out_h = 0, 0
        if src_path and src_path.exists():
            try:
                with Image.open(src_path) as im:
                    src_w, src_h = im.size
            except Exception:
                src_w, src_h = 0, 0
        else:
            src_w, src_h = 0, 0

        # Pull cost / elapsed out of the log row.
        row = log_rows.get(src_str or "", {})
        cost_str = row.get("cost", "-")
        elapsed_str = row.get("elapsed", "-")
        try:
            total_cost += float(cost_str)
        except (TypeError, ValueError):
            pass

        try:
            src_rel = (
                os.path.relpath(src_path, output_dir) if src_path else "(missing)"
            )
        except ValueError:
            src_rel = str(src_path)
        out_rel = ext_path.name

        card = f"""
        <div class='card'>
          <div class='cap'>{src_str or ext_path.name}</div>
          <div class='pair'>
            <figure><figcaption>before — {src_w}×{src_h}</figcaption>
              <img src='{src_rel}' alt='before' loading='lazy' />
            </figure>
            <figure><figcaption>after — {out_w}×{out_h}</figcaption>
              <img src='{out_rel}' alt='after' loading='lazy' />
            </figure>
          </div>
          <div class='meta'>{elapsed_str}s · cost {cost_str}</div>
        </div>
        """
        groups.setdefault(folder, []).append(card)

    # Failed.txt cards (rendered after each folder, or in a dedicated bottom group).
    failed_paths: list[str] = []
    fpath = output_dir / FAILED_LIST
    if fpath.exists():
        seen: set[str] = set()
        for line in fpath.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and line not in seen:
                seen.add(line)
                failed_paths.append(line)

    failed_cards = []
    for f in failed_paths:
        row = log_rows.get(f, {})
        note = row.get("note") or row.get("status") or "failed"
        failed_cards.append(
            f"<div class='card error'><div class='cap'>{f}</div>"
            f"<div class='msg'>{note}</div></div>"
        )

    # Compose the body in a stable folder order.
    folder_order = ["clear", "cloudy", "cold", "fog", "heat", "rain", "storm", "wind", "default", "unknown"]
    body_chunks: list[str] = []
    for folder in folder_order:
        if folder not in groups:
            continue
        body_chunks.append(f"<h2 class='folder'>{folder} ({len(groups[folder])})</h2>")
        body_chunks.extend(groups[folder])
    if failed_cards:
        body_chunks.append(f"<h2 class='folder failed'>failed ({len(failed_cards)})</h2>")
        body_chunks.extend(failed_cards)

    # Header summary.
    total_done = len(extended)
    total_failed = len(failed_paths)
    run_bits = []
    if run_summary:
        if "elapsed_s" in run_summary:
            run_bits.append(f"this run {run_summary['elapsed_s']}s")
        if "ok" in run_summary:
            run_bits.append(f"{run_summary['ok']} ok / {run_summary.get('failed', 0)} failed / {run_summary.get('skipped', 0)} skipped")
    run_meta = " · ".join(run_bits) if run_bits else ""

    html = f"""<!doctype html>
<html lang='en'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <title>Portrait Extender — review</title>
  <style>
    body {{ background: #111; color: #eee; font-family: -apple-system, system-ui, sans-serif;
            margin: 0; padding: 1rem; }}
    h1 {{ margin: 0 0 0.25rem 0; font-size: 1.2rem; }}
    .summary {{ font-size: 0.85rem; opacity: 0.75; margin-bottom: 1.25rem; }}
    h2.folder {{ margin: 1.5rem 0 0.5rem 0; font-size: 0.95rem;
                 text-transform: uppercase; letter-spacing: 0.08em;
                 color: #ffd700; }}
    h2.folder.failed {{ color: #f88; }}
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
  <div class='summary'>
    {total_done} extended · {total_failed} failed · total cost {round(total_cost, 4) if total_cost else '—'}
    {(' · ' + run_meta) if run_meta else ''}
  </div>
  {''.join(body_chunks)}
</body>
</html>
"""
    out = output_dir / "comparison.html"
    out.write_text(html, encoding="utf-8")
    return out


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def load_inputs_file(path: Path) -> list[str]:
    """Read one input path per line. Blank lines and #-comments ignored."""
    raws: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        raws.append(s)
    return raws


def main() -> int:
    parser = argparse.ArgumentParser(description="fal.ai portrait extender POC")
    # Inputs are required UNLESS --regen-html-only is set; we validate that
    # below so the mutually-exclusive group itself is not required.
    g = parser.add_mutually_exclusive_group(required=False)
    g.add_argument("--inputs", nargs="+", help="image paths")
    g.add_argument("--inputs-file", help="text file with one image path per line")
    parser.add_argument("--target-ratio", default=DEFAULT_TARGET_RATIO)
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument(
        "--sleep-between",
        type=float,
        default=2.0,
        help="seconds to wait between fal.ai calls (default 2.0)",
    )
    parser.add_argument(
        "--regen-html-only",
        action="store_true",
        help="don't process anything, just rebuild comparison.html from disk",
    )
    args = parser.parse_args()

    # Load .env located next to this script
    load_dotenv(Path(__file__).resolve().parent / ".env")

    rw, rh = parse_ratio(args.target_ratio)
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = REPO_ROOT / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.regen_html_only:
        html_path = write_comparison_html(output_dir, run_summary=None)
        print(f"comparison: {html_path}")
        return 0

    if not args.inputs and not args.inputs_file:
        print("ERROR: pass --inputs or --inputs-file (or --regen-html-only).", file=sys.stderr)
        return 2

    fal_key = os.environ.get("FAL_KEY")
    if not fal_key:
        print(
            "ERROR: FAL_KEY not set. Copy .env.example to .env and fill it in,",
            "or export FAL_KEY in your shell.",
            file=sys.stderr,
        )
        return 2

    # Resolve inputs
    raw_inputs: list[str]
    if args.inputs_file:
        f = Path(args.inputs_file)
        if not f.is_absolute():
            f = REPO_ROOT / f
        if not f.exists():
            print(f"ERROR: --inputs-file not found: {f}", file=sys.stderr)
            return 2
        raw_inputs = load_inputs_file(f)
    else:
        raw_inputs = list(args.inputs)

    inputs: list[Path] = []
    for raw in raw_inputs:
        p = Path(raw)
        if not p.is_absolute():
            p = REPO_ROOT / p
        inputs.append(p)

    print(f"[run] model={args.model} ratio={args.target_ratio} output={output_dir}")
    print(f"[run] {len(inputs)} input(s)  sleep_between={args.sleep_between}s")

    overall_start = time.time()
    results: list[Result] = []
    total_cost = 0.0
    api_calls_made = 0  # only sleep between actual API calls

    for idx, p in enumerate(inputs, start=1):
        # Pace ourselves between real API calls (skips don't burn rate).
        # api_calls_made > 0 means we already burned one — gap before the next.
        if api_calls_made > 0 and args.sleep_between > 0:
            time.sleep(args.sleep_between)

        print(f"\n[image {idx}/{len(inputs)}] {p}")
        r = process_one(p, output_dir, rw, rh, args.model)
        results.append(r)
        append_batch_log(output_dir, r)

        if r.skipped:
            print(f"  skipped: {r.error}")
        elif r.error:
            print(f"  ERROR: {r.error}  (took {r.elapsed_s}s)")
            append_failed(output_dir, r.input_path)
            api_calls_made += 1  # we did try to call, just failed
        else:
            print(
                f"  before {r.src_w}x{r.src_h} → after {r.out_w}x{r.out_h}"
                f"  cost={r.cost_usd or '—'}  ({r.elapsed_s}s)"
            )
            print(f"  → {r.output_path}")
            if isinstance(r.cost_usd, (int, float)):
                total_cost += r.cost_usd
            api_calls_made += 1

    elapsed = round(time.time() - overall_start, 1)
    ok = sum(1 for r in results if r.output_path and not r.skipped)
    failed = sum(1 for r in results if r.error and not r.skipped)
    skipped = sum(1 for r in results if r.skipped)

    run_summary = {
        "elapsed_s": elapsed,
        "ok": ok,
        "failed": failed,
        "skipped": skipped,
    }
    html_path = write_comparison_html(output_dir, run_summary=run_summary)

    print("\n" + "=" * 60)
    print(f"{ok} processed, {failed} failed, ${round(total_cost, 4) if total_cost else '0 (no cost field on responses)'} spent, comparison page: {html_path}")
    print(f"summary: {ok} extended, {failed} failed, {skipped} skipped (this run)")
    print(f"elapsed: {elapsed}s")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
